/**
 * Email engine — the one place every transactional send and every drip
 * journey (enroll/cancel/schedule) goes through. Built entirely on Netlify
 * Blobs + Resend; no new infrastructure, no service-role keys, matching this
 * repo's existing patterns (retryPendingCases.js's queue-in-Blobs approach,
 * lib/mdi-voucher.js's test-email gating).
 *
 * IMPORTANT — callers using legacy v1 `exports.handler` functions must call
 * `connectBlobs(event)` (lib/blobs.js) before any function in this module,
 * exactly like every other Blobs-touching handler in this codebase.
 *
 * Blob store "email-engine" layout:
 *   contacts/<emailHash>            { email, first_name, source, vertical, created_at }
 *   journeys/<emailHash>/<name>     { status: 'active'|'cancelled', enrolled_at, enrollment_id }
 *   queue/<dueISO>__<uuid>          { to, template, data, journey?, enrollment_id?, step?, kind, dedupe_key }
 *   sent/<dedupeKey>                { at, resend_id }
 *   suppression/<emailHash>         { reason: 'unsubscribed'|'bounced'|'complained', at }
 *
 * Global store in production keeps real send history around across deploys;
 * everywhere else uses a deploy-scoped store so test sends from preview/dev
 * builds never mix with production data (same convention the Netlify Blobs
 * docs recommend for keeping non-prod data isolated).
 */

const crypto = require('crypto');
const { getStore, getDeployStore } = require('@netlify/blobs');
const { sendResendEmail } = require('../resend-client');
const { TEMPLATES } = require('../email-templates');
const { JOURNEYS } = require('./journeys');
const { buildUnsubscribeUrl } = require('./unsubscribe');
const { assertNoPhi } = require('./phi-guard');
const { htmlToText } = require('./text');

const STORE_NAME = 'email-engine';

// Drip sends only land inside this local hour-of-day window (America/New_York,
// where the clinical/support team is based) — never a 3am marketing email.
const SEND_WINDOW = { timeZone: 'America/New_York', startHour: 9, endHour: 20 };

// `process.env.CONTEXT` is not reliably populated at runtime inside Netlify
// Functions (confirmed here: processEmailQueue's scheduled runs crashed on
// getDeployStore's missing region on every 10-minute run from 2026-09-14
// launch through 2026-09-15, because CONTEXT was never 'production' even
// though scheduled functions only ever execute against the production
// deploy). Defaulting to production and only opting into the deploy-scoped
// store for explicitly-recognized preview contexts keeps manual test sends
// from a deploy preview isolated, while making the scheduled production path
// fail-safe regardless of whether CONTEXT shows up.
function isPreviewContext() {
  return process.env.CONTEXT === 'deploy-preview' || process.env.CONTEXT === 'branch-deploy';
}

function getEmailStore() {
  return isPreviewContext() ? getDeployStore(STORE_NAME) : getStore(STORE_NAME);
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function emailHash(email) {
  return crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

/** Short, log-safe tag — never log a raw email address (matches repo convention). */
function emailLogTag(email) {
  return emailHash(email).slice(0, 10);
}

function sanitizeKey(key) {
  return String(key).replace(/[^a-zA-Z0-9:_.-]/g, '_');
}

function testAddressPatterns() {
  return String(process.env.MDI_TEST_EMAIL_PATTERNS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function isTestAddress(email) {
  const e = normalizeEmail(email);
  return testAddressPatterns().some(p => e.includes(p));
}

/**
 * Gate on whether an email actually goes out over the wire. In production,
 * always. Everywhere else, only to addresses matching MDI_TEST_EMAIL_PATTERNS
 * (the same allow-list the MDI voucher flow already uses for its own test
 * detection) — and EMAIL_DRY_RUN=true suppresses every real send regardless
 * of environment, for local iteration on copy/rendering.
 */
function shouldActuallySend(email) {
  if (process.env.EMAIL_DRY_RUN === 'true') return false;
  if (!isPreviewContext()) return true;
  return isTestAddress(email);
}

function hourInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).formatToParts(date);
  const hour = parts.find(p => p.type === 'hour');
  return hour ? parseInt(hour.value, 10) % 24 : date.getUTCHours();
}

function withinSendWindow(date) {
  const h = hourInTimeZone(date, SEND_WINDOW.timeZone);
  return h >= SEND_WINDOW.startHour && h < SEND_WINDOW.endHour;
}

/** Walks forward in whole hours (DST-safe via Intl) until inside the send window. */
function nextSendWindowStart(date) {
  let d = new Date(date);
  for (let i = 0; i < 48 && !withinSendWindow(d); i++) {
    d = new Date(d.getTime() + 60 * 60 * 1000);
  }
  return d;
}

// ── Suppression list ──────────────────────────────────────────────
/**
 * @param {string} email
 * @param {'transactional'|'marketing'} [kind='marketing']
 *   A marketing unsubscribe only opts someone out of marketing/journey
 *   emails — it must never block an account-critical transactional email
 *   (order confirmation, Hub welcome). A bounce/complaint is different: the
 *   address is known-bad or actively hostile, so it blocks everything.
 */
async function isSuppressed(email, kind = 'marketing') {
  const store = getEmailStore();
  const rec = await store.get('suppression/' + emailHash(email), { type: 'json' });
  if (!rec) return false;
  if (kind === 'transactional') return rec.reason === 'bounced' || rec.reason === 'complained';
  return true;
}

/** @param {'unsubscribed'|'bounced'|'complained'} reason */
async function suppress(email, reason) {
  const store = getEmailStore();
  await store.setJSON('suppression/' + emailHash(email), { reason, at: new Date().toISOString() });
  console.log(`[EMAIL ENGINE] Suppressed email#${emailLogTag(email)} (${reason})`);
}

// ── Dedupe ─────────────────────────────────────────────────────────
async function alreadySent(dedupeKey) {
  const store = getEmailStore();
  const rec = await store.get('sent/' + sanitizeKey(dedupeKey), { type: 'json' });
  return Boolean(rec);
}

async function markSent(dedupeKey, resendId) {
  const store = getEmailStore();
  await store.setJSON('sent/' + sanitizeKey(dedupeKey), { at: new Date().toISOString(), resend_id: resendId || null });
}

// ── Contacts (best-effort address book, used for journey enrollment) ──
async function upsertContact(email, fields = {}) {
  const store = getEmailStore();
  const key = 'contacts/' + emailHash(email);
  const existing = (await store.get(key, { type: 'json' })) || { email: normalizeEmail(email), created_at: new Date().toISOString() };
  await store.setJSON(key, { ...existing, ...fields, email: normalizeEmail(email) });
}

// ── Subscription → contact mapping ──────────────────────────────────
// Authorize.Net's ARB webhooks (authcapture.created for a recurring
// transaction, subscription.suspended/terminated/cancelled) identify the
// subscription only by its own id — never the patient's email. Recorded
// once, right when create-authnet-transaction.js creates the ARB
// subscription, so authnetWebhook.js can look the patient back up later.
async function recordSubscription(subscriptionId, { email, firstName, planMonths }) {
  if (!subscriptionId || !email) return;
  const store = getEmailStore();
  await store.setJSON('subscriptions/' + subscriptionId, {
    email: normalizeEmail(email),
    first_name: firstName || null,
    plan_months: planMonths || null,
    started_at: new Date().toISOString()
  });
}

async function getSubscription(subscriptionId) {
  if (!subscriptionId) return null;
  const store = getEmailStore();
  return store.get('subscriptions/' + subscriptionId, { type: 'json' });
}

// ── One-off transactional/marketing sends ───────────────────────────
/**
 * @param {object} args
 * @param {string} args.template   key into lib/email-templates' TEMPLATES registry
 * @param {string} args.to
 * @param {object} [args.data]     passed straight to the template's render()
 * @param {string} args.dedupeKey  required — prevents a redelivered webhook from double-sending
 * @param {'transactional'|'marketing'} [args.kind='transactional']
 * @returns {Promise<{sent: boolean, reason?: string, id?: string}>} never throws
 */
async function sendTransactional({ template, to, data = {}, dedupeKey, kind = 'transactional' }) {
  if (!to || !template || !dedupeKey) {
    console.warn('[EMAIL ENGINE] Missing to/template/dedupeKey — refusing to send');
    return { sent: false, reason: 'missing-args' };
  }
  const tag = emailLogTag(to);
  try {
    if (await isSuppressed(to, kind)) {
      console.log(`[EMAIL ENGINE] Skip ${template} → email#${tag}: suppressed`);
      return { sent: false, reason: 'suppressed' };
    }
    if (await alreadySent(dedupeKey)) {
      console.log(`[EMAIL ENGINE] Skip ${template} → email#${tag}: already sent (${dedupeKey})`);
      return { sent: false, reason: 'duplicate' };
    }

    const renderer = TEMPLATES[template];
    if (!renderer) {
      console.error(`[EMAIL ENGINE] Unknown template: ${template}`);
      return { sent: false, reason: 'unknown-template' };
    }

    const unsubscribeUrl = kind === 'marketing' ? buildUnsubscribeUrl(to) : null;
    const rendered = renderer({ ...data, unsubscribeUrl });

    if (!assertNoPhi(rendered.html, template)) {
      return { sent: false, reason: 'phi-guard-blocked' };
    }

    if (!shouldActuallySend(to)) {
      console.log(`[EMAIL ENGINE] DRY RUN would send "${template}" → email#${tag} | subject: ${rendered.subject}`);
      await markSent(dedupeKey, 'dry-run');
      return { sent: false, reason: 'dry-run' };
    }

    const result = await sendResendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: htmlToText(rendered.html),
      idempotencyKey: sanitizeKey(dedupeKey),
      tags: [{ name: 'template', value: template }],
      ...(kind === 'marketing' && unsubscribeUrl
        ? { headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
        : {})
    });

    if (result.sent) {
      await markSent(dedupeKey, result.id);
      console.log(`[EMAIL ENGINE] Sent "${template}" → email#${tag} (${result.id || 'no-id'})`);
    } else {
      console.warn(`[EMAIL ENGINE] Send failed for "${template}" → email#${tag}: ${result.reason}`);
    }
    return result;
  } catch (e) {
    console.error(`[EMAIL ENGINE] sendTransactional threw for "${template}":`, e.message);
    return { sent: false, reason: e.message };
  }
}

// ── Drip journeys ────────────────────────────────────────────────────
/**
 * Enrolls an address in a named journey, scheduling every step as a queue
 * item up front (processEmailQueue drains them as they come due). A no-op
 * if that journey is already active for this address, unless `force`.
 *
 * @param {string} journeyName
 * @param {object} args
 * @param {string} args.email
 * @param {object} [args.data]    template data carried through every step
 * @param {{delayMs:number, template:string}[]} [args.steps] override the
 *   journey's static schedule (used by refill-reminder, whose cadence
 *   depends on the purchased plan)
 * @param {boolean} [args.force]  re-enroll even if already active (restarts the clock)
 */
async function enrollJourney(journeyName, { email, data = {}, steps: overrideSteps, force = false } = {}) {
  if (!email) return { enrolled: false, reason: 'missing-email' };
  const journey = JOURNEYS[journeyName];
  if (!journey) {
    console.error(`[EMAIL ENGINE] Unknown journey: ${journeyName}`);
    return { enrolled: false, reason: 'unknown-journey' };
  }
  if (await isSuppressed(email)) {
    return { enrolled: false, reason: 'suppressed' };
  }

  const store = getEmailStore();
  const hash = emailHash(email);
  const journeyKey = `journeys/${hash}/${journeyName}`;
  const existing = await store.get(journeyKey, { type: 'json' });
  if (existing && existing.status === 'active' && !force) {
    return { enrolled: false, reason: 'already-active' };
  }

  const steps = overrideSteps && overrideSteps.length ? overrideSteps : journey.steps;
  if (!steps.length) {
    console.warn(`[EMAIL ENGINE] enrollJourney("${journeyName}") called with no steps — nothing scheduled`);
    return { enrolled: false, reason: 'no-steps' };
  }

  const now = Date.now();
  const enrollmentId = crypto.randomUUID();

  await store.setJSON(journeyKey, {
    status: 'active',
    enrolled_at: new Date(now).toISOString(),
    enrollment_id: enrollmentId
  });
  await upsertContact(email, { source: journeyName });

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const rawDue = new Date(now + step.delayMs);
    const due = withinSendWindow(rawDue) ? rawDue : nextSendWindowStart(rawDue);
    const queueKey = `queue/${due.toISOString()}__${crypto.randomUUID()}`;
    await store.setJSON(queueKey, {
      to: normalizeEmail(email),
      template: step.template,
      data,
      journey: journeyName,
      enrollment_id: enrollmentId,
      step: i,
      kind: journey.kind || 'marketing',
      dedupe_key: `${journeyName}:${enrollmentId}:${i}`
    });
  }

  console.log(`[EMAIL ENGINE] Enrolled email#${emailLogTag(email)} in "${journeyName}" (${steps.length} step(s))`);
  return { enrolled: true, enrollment_id: enrollmentId };
}

/** Marks a journey cancelled; any already-queued step for it is skipped by processEmailQueue. */
async function cancelJourney(journeyName, email) {
  if (!email) return { cancelled: false, reason: 'missing-email' };
  const store = getEmailStore();
  const journeyKey = `journeys/${emailHash(email)}/${journeyName}`;
  const existing = await store.get(journeyKey, { type: 'json' });
  if (!existing || existing.status !== 'active') {
    return { cancelled: false, reason: 'not-active' };
  }
  await store.setJSON(journeyKey, { ...existing, status: 'cancelled', cancelled_at: new Date().toISOString() });
  console.log(`[EMAIL ENGINE] Cancelled journey "${journeyName}" for email#${emailLogTag(email)}`);
  return { cancelled: true };
}

/** @returns {Promise<object|null>} the journey record, or null if never enrolled */
async function getJourneyStatus(journeyName, email) {
  const store = getEmailStore();
  return store.get(`journeys/${emailHash(email)}/${journeyName}`, { type: 'json' });
}

module.exports = {
  getEmailStore,
  emailHash,
  emailLogTag,
  isTestAddress,
  shouldActuallySend,
  withinSendWindow,
  nextSendWindowStart,
  isSuppressed,
  suppress,
  alreadySent,
  markSent,
  upsertContact,
  recordSubscription,
  getSubscription,
  sendTransactional,
  enrollJourney,
  cancelJourney,
  getJourneyStatus
};
