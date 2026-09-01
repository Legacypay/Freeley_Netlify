/**
 * MDI voucher helpers — single place that decides test-vs-live and builds the
 * POST /v1/partner/vouchers payload. Used by submitQuiz.js and retryPendingCases.js.
 *
 * Source of truth: MDI partner API docs (Postman collection 14212272/2s8Yt1r9B8),
 * "Partners > Vouchers > Create voucher". Documented request fields:
 *   questionnaire_id (uuid, required), patient_id, hold_status (bool),
 *   demo (bool: "Demo vouchers will not create any patient or cases and will not expire"),
 *   expires_at, offerings[] ({ id, product? }), diseases[], metadata (string 255), pharmacy_id.
 * Documented response: { partner_voucher_id, onboarding_url, demo, case_id, environment_id, metadata, ... }
 *
 * ── Test / live decision ─────────────────────────────────────────
 * SAFE BY DEFAULT: every voucher is a TEST voucher unless BOTH
 *   MDI_LIVE_MODE=true  AND  MDI_ALLOW_LIVE_ORDERS=true
 * are set. MDI bills every un-tagged live encounter, so going live is an
 * explicit two-flag decision, never an accident.
 *
 * Env vars:
 *   MDI_LIVE_MODE           'true' → partner is Active / use live environment id (existing flag)
 *   MDI_ALLOW_LIVE_ORDERS   'true' → actually permit un-tagged live vouchers (NEW, default off)
 *   MDI_FORCE_TEST          'true' → kill switch: force test mode even if the two above are on
 *   MDI_TEST_EMAIL_PATTERNS comma-separated, case-insensitive substrings; matching patient
 *                           emails are always test orders (e.g. "@freeley.com,+test@")
 *   MDI_TEST_FULL_FLOW      'true' → test vouchers are NOT demo (real patient + case are created
 *                           so onboarding/clinician flow can be exercised) but carry
 *                           metadata "TEST CASE | …" and get the "test-case" tag via mdiWebhook.
 *                           Default off → demo:true (nothing is created, nothing is billed).
 *   MDI_SEND_ENVIRONMENT_ID 'false' → omit the undocumented environment_id field. Default: send it
 *                           (current production behaviour, discovered from the portal Test Bench).
 *   MDI_SANDBOX_ENV_ID      MDI environment_id to send for sandbox/test vouchers (see below)
 *   MDI_LIVE_ENV_ID         MDI environment_id to send for live vouchers (see below)
 */

// MDI Environment IDs — discovered from portal Test Bench "Create Voucher" form.
// Not part of the public PostPartnerVoucherRequest schema; kept for compatibility.
// Read fresh from env on every call (not a module-load-time snapshot) so a changed
// env var takes effect without a cold restart; the literals are only a fallback for
// this project's already-provisioned ids — never hardcode a different partner's ids.
function sandboxEnvId() { return process.env.MDI_SANDBOX_ENV_ID || '6ab0181e-d52a-488f-a161-d64d576b2eba'; }
function liveEnvId() { return process.env.MDI_LIVE_ENV_ID || 'b374c499-638d-4e72-b844-4c68fcda2eff'; }

const METADATA_MAX = 255;
const TEST_PREFIX = 'TEST CASE';

function flag(name) {
  return String(process.env[name] || '').trim().toLowerCase() === 'true';
}

function testEmailPatterns() {
  return String(process.env.MDI_TEST_EMAIL_PATTERNS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Decide whether an order must be treated as a test order.
 * @param {{ email?: string, explicitTest?: boolean }} [opts] explicitTest: caller-supplied
 *   `is_test: true` (e.g. the request body, validated in lib/validate-quiz.js) — an even
 *   more direct signal than email-pattern matching, checked right after the kill switch.
 * @returns {{ isTest: boolean, reason: string, demo: boolean, fullFlow: boolean, liveMode: boolean }}
 */
function resolveTestMode(opts = {}) {
  const liveMode = flag('MDI_LIVE_MODE');
  const allowLive = flag('MDI_ALLOW_LIVE_ORDERS');
  const forceTest = flag('MDI_FORCE_TEST');
  const fullFlow = flag('MDI_TEST_FULL_FLOW');
  const email = String(opts.email || '').toLowerCase();
  const emailMatch = email ? testEmailPatterns().find(p => email.includes(p)) : undefined;
  const explicitTest = opts.explicitTest === true;

  let isTest = true;
  let reason;
  if (forceTest) {
    reason = 'MDI_FORCE_TEST';
  } else if (explicitTest) {
    reason = 'explicit-is_test-flag';
  } else if (emailMatch) {
    reason = 'test-email:' + emailMatch;
  } else if (!liveMode) {
    reason = 'MDI_LIVE_MODE!=true';
  } else if (!allowLive) {
    reason = 'MDI_ALLOW_LIVE_ORDERS!=true';
  } else {
    isTest = false;
    reason = 'live';
  }

  return { isTest, reason, demo: isTest && !fullFlow, fullFlow, liveMode };
}

function buildMetadata(isTest, metadata) {
  const base = metadata ? String(metadata) : '';
  if (!isTest) return base ? base.slice(0, METADATA_MAX) : null;
  // Truncate the suffix, never the prefix — "TEST CASE" must always survive.
  const sep = ' | ';
  const room = METADATA_MAX - TEST_PREFIX.length - sep.length;
  const value = base ? TEST_PREFIX + sep + base.slice(0, room) : TEST_PREFIX;
  if (!value.startsWith(TEST_PREFIX)) throw new Error('buildMetadata: TEST prefix lost');
  return value;
}

/**
 * Build the documented /v1/partner/vouchers request body.
 * @param {{ product: { questionnaire_id: string, offering_id?: string }, testMode: ReturnType<typeof resolveTestMode>, metadata?: string }} args
 */
function buildVoucherPayload({ product, testMode, metadata, patientId, prefilledQuestions }) {
  if (!product || !product.questionnaire_id) {
    throw new Error('buildVoucherPayload: product.questionnaire_id is required');
  }
  const payload = {
    questionnaire_id: product.questionnaire_id,
    hold_status: false,
    metadata: buildMetadata(testMode.isTest, metadata)
  };
  if (product.offering_id) {
    payload.offerings = [{ id: product.offering_id }];
  }
  // Documented optional fields (Partners › Vouchers › Create voucher):
  //   patient_id           — bind the voucher to an already-created MDI patient so
  //                          onboarding does not ask for demographics again and we
  //                          know the patient_id before any webhook arrives.
  //   prefilled_questions  — pre-answered intake questions stored with the voucher
  //                          (the funnel quiz answers + allergies/meds/conditions).
  // Never sent on demo vouchers: MDI creates nothing for those, so binding a real
  // patient to one would only clutter the record.
  if (patientId && !testMode.demo) {
    payload.patient_id = patientId;
  }
  if (Array.isArray(prefilledQuestions) && prefilledQuestions.length && !testMode.demo) {
    payload.prefilled_questions = prefilledQuestions;
  }
  if (testMode.demo) {
    payload.demo = true;
  }
  if (process.env.MDI_SEND_ENVIRONMENT_ID !== 'false') {
    payload.environment_id = testMode.liveMode ? liveEnvId() : sandboxEnvId();
  }
  return payload;
}

/**
 * Normalise the voucher response. Docs return `partner_voucher_id` + `onboarding_url`;
 * older code assumed `id`, so both are accepted.
 */
function parseVoucherResponse(result) {
  const r = result || {};
  const voucherId = r.partner_voucher_id || r.voucher_id || r.id || null;
  const onboardingUrl = r.onboarding_url || (voucherId ? 'https://patient.mdintegrations.com?token=' + voucherId : null);
  return {
    voucherId,
    onboardingUrl,
    patientId: r.patient_id || (r.payload && r.payload.patient_id) || null,
    caseId: r.case_id || null,
    environmentId: r.environment_id || null,
    // true / false as echoed by MDI; null when MDI did not echo the field at all
    demo: typeof r.demo === 'boolean' ? r.demo : null,
    metadata: r.metadata ?? null
  };
}

/**
 * True when we asked for a demo voucher but MDI did not echo `demo: true`.
 * Callers must treat this as a possible billable encounter and alert.
 */
function demoMismatch(testMode, parsed) {
  return Boolean(testMode && testMode.demo && parsed && parsed.demo !== true);
}

module.exports = {
  resolveTestMode,
  buildVoucherPayload,
  parseVoucherResponse,
  demoMismatch,
  TEST_PREFIX,
  getSandboxEnvId: sandboxEnvId,
  getLiveEnvId: liveEnvId,
  // Snapshot getters — kept as plain values too for callers that just want the
  // *current* id once (scripts, docs). Prefer getSandboxEnvId()/getLiveEnvId()
  // in any code path that runs for the lifetime of a long-lived process.
  get MDI_SANDBOX_ENV_ID() { return sandboxEnvId(); },
  get MDI_LIVE_ENV_ID() { return liveEnvId(); }
};
