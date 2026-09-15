/**
 * Admin-only bulk enrollment into the `lead-nurture` campaign — the way the
 * existing `waitlist` Supabase table gets onto the new flow.
 *
 * That table can't be read from here: Supabase RLS has no anon-readable policy
 * on it and this repo deliberately holds no service-role key (see
 * supabase/AGENTS.md). So the operator exports the waitlist from the Supabase
 * dashboard and POSTs the addresses here, in batches of up to 300:
 *
 *   curl -X POST https://freeley.com/.netlify/functions/importLeadNurture \
 *     -H 'content-type: application/json' \
 *     -H "x-admin-secret: $ADMIN_IMPORT_SECRET" \
 *     -d '{"emails":["a@example.com","b@example.com"]}'
 *
 * Waitlist contacts have no first name and no stated vertical, so they enroll
 * with empty data — the templates fall back to "Hi there," and A4 renders its
 * Weight loss variant (lib/email-templates/campaign-render.js's
 * resolveVariant). Enrollment is idempotent per address: an already-active
 * journey is reported as `alreadyActive`, never restarted.
 *
 * Fail-closed: without ADMIN_IMPORT_SECRET set in the environment this
 * endpoint returns 403 to everyone, including a caller sending no header.
 */

const crypto = require('crypto');
const { allow } = require('./lib/rate-limit');
const { connectBlobs } = require('./lib/blobs');
const { enrollJourney } = require('./lib/email/engine');

const MAX_BATCH = 300;

/** Length-independent compare so the secret can't be probed a character at a time. */
function secretMatches(provided) {
  const expected = process.env.ADMIN_IMPORT_SECRET;
  if (!expected || !provided) return false;
  const a = crypto.createHash('sha256').update(String(provided)).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function isPlausibleEmail(value) {
  const email = String(value || '').trim();
  return email.length >= 6 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

exports.handler = async (event) => {
  connectBlobs(event);

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  if (!secretMatches(event.headers['x-admin-secret'])) {
    console.warn('[IMPORT LEAD NURTURE] Rejected: bad or missing x-admin-secret');
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  // Admin bulk op, not a public endpoint — a handful of calls a minute is
  // plenty for pasting in batches by hand.
  if (!(await allow(event, { key: 'import-lead-nurture', limit: 5, windowSec: 60 }))) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  let emails;
  try {
    emails = JSON.parse(event.body || '{}').emails;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body must be JSON: { "emails": ["a@example.com", …] }' }) };
  }
  if (!Array.isArray(emails)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body must be JSON: { "emails": ["a@example.com", …] }' }) };
  }
  if (emails.length > MAX_BATCH) {
    return { statusCode: 400, body: JSON.stringify({ error: `${emails.length} addresses is too many — split into batches of ${MAX_BATCH} or fewer.` }) };
  }

  const counts = { requested: emails.length, enrolled: 0, alreadyActive: 0, skippedInvalid: 0, suppressed: 0, failed: 0 };

  for (const raw of emails) {
    if (!isPlausibleEmail(raw)) {
      counts.skippedInvalid++;
      continue;
    }
    try {
      const result = await enrollJourney('lead-nurture', { email: String(raw).trim(), data: {} });
      if (result.enrolled) counts.enrolled++;
      else if (result.reason === 'already-active') counts.alreadyActive++;
      else if (result.reason === 'suppressed') counts.suppressed++;
      else counts.failed++;
    } catch (e) {
      counts.failed++;
      console.warn('[IMPORT LEAD NURTURE] Enrollment threw:', e.message);
    }
  }

  console.log(`[IMPORT LEAD NURTURE] ${JSON.stringify(counts)}`);
  return { statusCode: 200, body: JSON.stringify(counts) };
};
