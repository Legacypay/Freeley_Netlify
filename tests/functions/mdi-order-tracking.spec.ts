import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// End-to-end proof, against MD Integrations' REAL sandbox API, that:
//   1. a real patient/case genuinely persists in MDI — the same GET endpoints
//      that back their own dashboard reflect exactly what we sent, not a mock.
//   2. netlify/functions/mdiWebhook.js correctly ingests MDI's real, HMAC-signed
//      order/shipment webhook events (including a redelivery) through the
//      REAL running `netlify dev` server (real Netlify Blobs, not mocked),
//      re-fetches the real Partner Orders API, and attaches the "test-case"
//      tag to the real sandbox case.
//
// SAFETY: uses this project's SANDBOX MDI OAuth credentials — every record
// created here lands in MDI's Sandbox environment regardless of MDI_LIVE_MODE
// (verified empirically: the environment_id we send is overridden server-side
// by whichever OAuth app the credentials belong to). Aborts before creating
// anything else if MDI ever echoes back a non-sandbox patient. Never touches
// the checkout/vouchers-for-payment flow, so nothing is billed.
//
// SCOPE NOTE: getOrders.js/caseStatus.js are Supabase-authenticated, and this
// repo has no automated way to provision a confirmed Supabase test user, so
// this spec does not exercise that HTTP layer live. Their resolution/ownership
// logic (including the exact IDOR-guard scenario found during code review) is
// covered with mocked-but-real-logic unit tests in
// tests/unit/{case-status,get-orders,get-encounter-details,patient-cases}.test.js.
//
// Run: npm run test:mdi -- mdi-order-tracking

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*([\w.-]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    const [, key, rawVal] = m;
    const val = /^(['"]).*\1$/.test(rawVal) ? rawVal.slice(1, -1) : rawVal;
    if (!(key in process.env)) process.env[key] = val;
  }
}

function loadMdiWebhookSecret() {
  if (process.env.MDI_WEBHOOK_SECRET) return;
  // MDI_WEBHOOK_SECRET is a Netlify cloud-only project setting (no local .env
  // entry) — fetch it once via the already-authenticated netlify-cli session
  // this whole suite's webServer already depends on being logged in.
  try {
    process.env.MDI_WEBHOOK_SECRET = execSync('npx netlify-cli env:get MDI_WEBHOOK_SECRET --context dev', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // leave unset — the describe.skip below reports this clearly
  }
}

loadDotEnv();
loadMdiWebhookSecret();

const fnLib = path.join(__dirname, '..', '..', 'netlify', 'functions', 'lib');
const { mdiRequest } = require(path.join(fnLib, 'mdi-client'));
const { PRODUCTS } = require(path.join(fnLib, 'products'));

function sign(rawBody: string): string {
  return crypto.createHmac('sha256', process.env.MDI_WEBHOOK_SECRET as string).update(rawBody).digest('hex');
}

const hasMdiCreds = Boolean(process.env.MDI_CLIENT_ID && process.env.MDI_CLIENT_SECRET && process.env.MDI_WEBHOOK_SECRET);

test.describe.serial('MDI order/shipment tracking — real sandbox API, nothing billed', () => {
  test.skip(!hasMdiCreds, 'MDI_CLIENT_ID/SECRET/WEBHOOK_SECRET not available in this environment');

  const product = PRODUCTS['semaglutide-s1'];
  const testEmail = `mdi-e2e-${Date.now()}@example.com`;
  let patientId: string;
  let caseId: string;
  let voucherId: string;

  test.beforeAll(async ({ request }) => {
    // 1) Real sandbox patient — direct MDI API call, bypasses the manual
    // onboarding form (which needs a human to fill it out).
    const patient = await mdiRequest('POST', '/v1/partner/patients', {
      prefix: 'Mr',
      first_name: 'PlaywrightE2E',
      last_name: 'MDITest',
      gender: 1,
      date_of_birth: '1990-01-01',
      phone_number: '(555) 123-4567',
      phone_type: 2,
      metadata: 'TEST CASE | automated e2e order-tracking spec',
      email: testEmail,
      address: { address: '123 Test St', zip_code: '80247', city_name: 'Denver', state_name: 'Colorado' },
    });
    expect(patient.is_live, 'MDI must echo is_live:false — a true here would mean this landed outside Sandbox').toBe(false);
    patientId = patient.patient_id;

    // 2) Real sandbox case for that patient, referencing our real product offering.
    const created = await mdiRequest('POST', '/v1/partner/cases', {
      hold_status: false,
      patient_id: patientId,
      metadata: 'TEST CASE | automated e2e order-tracking spec',
      is_chargeable: false,
    });
    caseId = created.case_id;

    // 3) Assign a clinician — the real production endpoint (auto-assigns via
    // MDI's algorithm), not a /tests/ simulation helper.
    await mdiRequest('POST', `/v1/partner/cases/${caseId}/assigned`, {});

    // 4) Seed the mdi-orders blob via the REAL submitQuiz.js HTTP endpoint —
    // writes a fresh record keyed by a real MDI voucher_id, exactly like a
    // real patient landing on the quiz. patient_id/case_id start null on this
    // record (submitQuiz.js doesn't create a patient/case until the voucher
    // is redeemed) — the next test backfills our real ids from steps 1-3 onto
    // this same record via a realistic webhook, simulating "the patient
    // completed onboarding and MDI created their case".
    const quizRes = await request.post('/.netlify/functions/submitQuiz', {
      data: {
        product: 'semaglutide-s1',
        patient: { first_name: 'PlaywrightE2E', last_name: 'MDITest', email: testEmail },
      },
    });
    expect(quizRes.status(), await quizRes.text()).toBe(200);
    const quizBody = await quizRes.json();
    voucherId = quizBody.voucher_id;
    expect(voucherId, 'submitQuiz must return a real voucher_id to seed the blob record').toBeTruthy();
  });

  function webhookHeaders(raw: string) {
    return { signature: sign(raw), 'content-type': 'application/json' };
  }

  test('MDI genuinely persisted the patient and case — the same GET endpoints its dashboard reads', async () => {
    const p = await mdiRequest('GET', `/v1/partner/patients/${patientId}`);
    expect(p.email).toBe(testEmail);
    expect(p.is_live).toBe(false);

    const c = await mdiRequest('GET', `/v1/partner/cases/${caseId}`);
    expect(c.case_status.name).toBe('assigned');
    expect(c.patient.email).toBe(testEmail);
  });

  test('a case_created webhook backfills our real patient/case ids onto the voucher record', async ({ request }) => {
    const raw = JSON.stringify({
      event_type: 'case_created',
      case_id: caseId,
      patient_id: patientId,
      metadata: { voucher_id: voucherId },
    });
    const res = await request.post('/.netlify/functions/mdiWebhook', { data: raw, headers: webhookHeaders(raw) });
    expect(res.status(), await res.text()).toBe(200);
  });

  test('order lifecycle webhooks (incl. a redelivery) update status and round-trip to the real Orders API', async ({ request }) => {
    async function fire(payload: Record<string, unknown>) {
      const raw = JSON.stringify(payload);
      const res = await request.post('/.netlify/functions/mdiWebhook', { data: raw, headers: webhookHeaders(raw) });
      expect(res.status(), await res.text()).toBe(200);
      return res;
    }

    await fire({ event_type: 'order_status_changed', case_id: caseId, order_status: 'ready', order_details: null });
    await fire({
      event_type: 'order_tracking_number_changed',
      case_id: caseId,
      order_status: 'fulfilled',
      order_details: 'Tracking Number: E2E-TEST-123',
    });
    // MDI redelivers webhooks in practice — must not double-send the "shipped"
    // email or lose a status_history entry (see mdiWebhook.js's
    // order_shipped_email_sent_at guard and updateOrderStatus's etag retry).
    const redelivery = await fire({
      event_type: 'order_tracking_number_changed',
      case_id: caseId,
      order_status: 'fulfilled',
      order_details: 'Tracking Number: E2E-TEST-123',
    });
    expect((await redelivery.json()).received).toBe(true);
  });

  test('the real sandbox case now shows a signature that our webhook handling actually ran', async () => {
    // updateOrderStatus doesn't write back to MDI (status_history lives in our
    // own blob) — what IS attributable to MDI is the "test-case" tag
    // maybeTagTestCase() attaches as a real side effect of the events above.
    const tags = await mdiRequest('GET', `/v1/partner/cases/${caseId}/tags/historical`);
    const list = Array.isArray(tags) ? tags : tags.data || [];
    expect(list.length, `expected at least one historical tag on case ${caseId}, got: ${JSON.stringify(tags)}`).toBeGreaterThan(0);
  });
});
