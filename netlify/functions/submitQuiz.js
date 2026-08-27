/**
 * Netlify Function: submitQuiz
 * Called when a patient completes the Freeley checkout.
 * Creates a voucher in MDI via the partner voucher endpoint.
 *
 * UPDATED 2026-05-06: Migrated from deprecated two-step flow
 *   (POST /v1/patient/patients → POST /v1/patient/patients/{id}/cases)
 * to the documented partner voucher endpoint:
 *   POST /v1/partner/vouchers  (PostPartnerVoucherRequest schema)
 * Uses the `offerings` array to specify which product, NOT case_prescriptions
 * (partner_compound_id/partner_medication_id are not registered in MDI).
 *
 * POST /.netlify/functions/submitQuiz
 */

const { getStore } = require('@netlify/blobs');
const { mdiRequest, CORS_HEADERS } = require('./lib/mdi-client');
const { PRODUCTS, resolveProductKey } = require('./lib/products');
const { encryptRecord } = require('./lib/phi-crypto');
const { validateQuizSubmission } = require('./lib/validate-quiz');
const { resolveTestMode, buildVoucherPayload, parseVoucherResponse, demoMismatch } = require('./lib/mdi-voucher');

// MDI Partner ID — from the partner portal URL
const MDI_PARTNER_ID = process.env.MDI_PARTNER_ID || 'f81508d1-3c53-4849-a636-1e9050a68e00';
const MDI_PORTAL_URL = 'https://partners.mdintegrations.com/partner/' + MDI_PARTNER_ID;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    let data;
    try {
      data = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    const v = validateQuizSubmission(data);
    if (!v.ok) {
      console.warn('[SUBMIT QUIZ] Validation failed:', v.error);
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid submission. Please check your inputs and try again.' }) };
    }
    const { patient: patientData, product: productKey, dose, compound, quiz_answers, allergies, current_medications, medical_conditions } = data;
    // Explicit caller-supplied test marker (validated boolean in lib/validate-quiz.js).
    // Not the only test signal — see lib/mdi-voucher.js's resolveTestMode for the full
    // safe-by-default decision (MDI_LIVE_MODE/MDI_ALLOW_LIVE_ORDERS/email patterns).
    const explicitTest = data.is_test === true;

    // Resolve product key — handles legacy 'semaglutide'/'tirzepatide' keys,
    // dose-tiered lookups (e.g., semaglutide + dose 0.4 → semaglutide-s2) and the
    // coarse per-vertical keys the checkout sends ('hair-loss', 'longevity', …),
    // which need the compound / sex / age context to pick a specific offering.
    const resolvedKey = resolveProductKey(productKey, {
      dose,
      compound,
      sex: patientData.gender,
      dateOfBirth: patientData.date_of_birth
    });

    if (!resolvedKey || !PRODUCTS[resolvedKey]) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid product: "' + productKey + '". Valid options: ' + Object.keys(PRODUCTS).join(', ') }) };
    }

    const product = PRODUCTS[resolvedKey];

    // Guard: block submission for products on regulatory hold (e.g., GHK-Cu / LegitScript)
    if (product._hold) {
      console.warn('[SUBMIT QUIZ] Blocked submission for held product: ' + resolvedKey + ' — ' + (product._hold_reason || 'regulatory hold'));
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'This product is temporarily unavailable due to regulatory review. Please check back soon or contact support.' }) };
    }

    // Require questionnaire_id for MDI submission
    if (!product.questionnaire_id) {
      console.error('[SUBMIT QUIZ] Missing questionnaire_id for product: ' + resolvedKey);
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Product configuration error. Please contact support.' }) };
    }

    console.log('[SUBMIT QUIZ] Creating voucher: ' + patientData.email + ' | product: ' + resolvedKey + (productKey !== resolvedKey ? ' (from: ' + productKey + ', dose: ' + dose + ')' : ''));

    // ── Test vs. Live ──
    // SAFE BY DEFAULT: vouchers are test vouchers (demo:true + "TEST CASE" metadata)
    // unless MDI_LIVE_MODE=true AND MDI_ALLOW_LIVE_ORDERS=true. A caller can also force
    // test mode explicitly via `is_test: true` in the body. MDI bills every un-tagged
    // live encounter — see lib/mdi-voucher.js and docs/MDI_TESTING.md.
    const testMode = resolveTestMode({ email: patientData.email, explicitTest });

    // ── Build voucher payload (documented PostPartnerVoucherRequest schema) ──
    // /v1/partner/vouchers requires "Active" partner status (422 otherwise;
    // MDI confirmed Freeley went Active/live on 2026-08-21).
    const voucherPayload = buildVoucherPayload({
      product,
      testMode,
      metadata: 'freeley:' + resolvedKey + (dose ? ':' + dose : '')
    });

    console.log('[SUBMIT QUIZ] Submitting to MDI /v1/partner/vouchers | partner: ' + MDI_PARTNER_ID + ' | mode: ' + (testMode.isTest ? 'TEST' : 'LIVE') + ' (' + testMode.reason + ') | demo: ' + testMode.demo + ' | env: ' + (voucherPayload.environment_id || 'n/a') + ' | questionnaire: ' + product.questionnaire_id);
    console.log('[SUBMIT QUIZ] Full payload:', JSON.stringify(voucherPayload, null, 2));

    const result = await mdiRequest(
      'POST',
      '/v1/partner/vouchers',
      voucherPayload
    );

    // Docs return partner_voucher_id + onboarding_url. Patient creates their account
    // during onboarding, so patient_id is normally null at this point.
    const parsed = parseVoucherResponse(result);
    const voucherId = parsed.voucherId;
    const patientId = parsed.patientId;
    const onboardingUrl = parsed.onboardingUrl;
    if (!voucherId) {
      // MDI answered 2xx, so a voucher very likely EXISTS — we just can't read its id.
      // Must NOT go to the retry queue (would create duplicate, possibly billable, vouchers).
      console.error('[SUBMIT QUIZ] 🚨 MDI 2xx response had no voucher id — voucher may be orphaned:', JSON.stringify(result).slice(0, 500));
      try {
        await getStore('mdi-orphaned-vouchers').setJSON('orphan-' + Date.now(), { email: patientData.email, product_key: resolvedKey, payload: voucherPayload, response: result, created_at: new Date().toISOString() });
      } catch (e) { console.error('[SUBMIT QUIZ] Failed to record orphaned voucher:', e.message); }
      await alertOps('mdi_voucher_orphaned', { email: patientData.email, product: resolvedKey, response_keys: Object.keys(result || {}) });
      throw Object.assign(new Error('MDI voucher response missing id'), { statusCode: 422, nonRetryable: true });
    }
    console.log('[SUBMIT QUIZ] Voucher created: ' + voucherId + ' | demo: ' + parsed.demo + ' | env: ' + parsed.environmentId + ' | Patient: ' + (patientId || 'pending-onboarding') + ' | Onboarding: ' + onboardingUrl);
    if (process.env.MDI_DEBUG_LOG_RESPONSES === 'true') {
      console.log('[SUBMIT QUIZ] Full MDI response:', JSON.stringify(result, null, 2));
    }
    if (!testMode.isTest) {
      // Loud on purpose: every live voucher is a billable MDI encounter. If this
      // was manual QA, tag it "test case" in the portal immediately.
      console.warn('[SUBMIT QUIZ] ⚠️ LIVE VOUCHER CREATED (billable): ' + voucherId + ' — portal: ' + MDI_PORTAL_URL);
    }

    // Requested demo:true but MDI did not echo it → treat as a possible billable encounter.
    const mismatch = demoMismatch(testMode, parsed);
    if (mismatch) {
      console.error('[SUBMIT QUIZ] 🚨 DEMO MISMATCH: requested demo:true, MDI echoed demo:' + parsed.demo + ' for voucher ' + voucherId + ' — verify/tag in the MDI portal');
      await alertOps('mdi_demo_mismatch', { voucher_id: voucherId, email: patientData.email, product: resolvedKey, echoed_demo: parsed.demo, onboarding_url: onboardingUrl });
    }

    // ── Persist order↔encounter link for support lookups ──
    try {
      const orderStore = getStore('mdi-orders');
      await orderStore.setJSON(voucherId, {
        voucher_id: voucherId,
        patient_id: patientId,
        email: patientData.email,
        first_name: patientData.first_name,
        last_name: patientData.last_name,
        phone: patientData.phone_number || null,
        product_key: resolvedKey,
        original_product_key: productKey !== resolvedKey ? productKey : undefined,
        dose: dose || null,
        offering_id: product.offering_id,
        questionnaire_id: product.questionnaire_id,
        category: product.category,
        onboarding_url: onboardingUrl,
        environment: testMode.liveMode ? 'live' : 'sandbox',
        environment_id: parsed.environmentId,
        is_test: testMode.isTest,
        test_reason: testMode.isTest ? testMode.reason : undefined,
        demo: parsed.demo,
        demo_mismatch: mismatch || undefined,
        mdi_metadata: voucherPayload.metadata,
        case_id: parsed.caseId,
        created_at: new Date().toISOString()
      });
      console.log('[SUBMIT QUIZ] Order record saved: ' + voucherId);
    } catch (storeErr) {
      // Non-critical — log but don't fail the response
      console.warn('[SUBMIT QUIZ] Failed to save order record (non-critical):', storeErr.message);
    }

    // ── N8N Webhook (non-critical) ──
    const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
    if (WEBHOOK_URL) {
      try {
        await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: patientData.email, phone: patientData.phone_number, timestamp: new Date().toISOString(), source: 'Freeley_Quiz_MDI_Submission', product: resolvedKey, original_product: productKey !== resolvedKey ? productKey : undefined, dose: dose || undefined, mdi_patient_id: patientId, mdi_voucher_id: voucherId, environment: testMode.liveMode ? 'live' : 'sandbox', is_test: testMode.isTest, demo: parsed.demo })
        });
      } catch (e) {
        console.warn('[SUBMIT QUIZ] N8N webhook failed (non-critical):', e.message);
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, message: 'Your information has been submitted to a licensed physician for review.', patient_id: patientId, voucher_id: voucherId, onboarding_url: onboardingUrl, product: resolvedKey, estimated_review: '24-48 hours', is_test: testMode.isTest, demo: parsed.demo })
    };

  } catch (error) {
    console.error('[SUBMIT QUIZ] Error:', error);
    const statusCode = error.statusCode || 500;

    // ── Partner status detection ──
    // MDI confirmed Freeley went live/Active on 2026-08-21 ("Congratulations on going
    // live!"), so this branch should be dead in normal operation. Left in as a defensive
    // check in case the partner is ever moved back to "Integrating" (e.g. suspended) —
    // /v1/partner/vouchers returns 422 for that specific state regardless of demo flag.
    if (statusCode === 422 && error.message && error.message.includes('partner status')) {
      console.error('[SUBMIT QUIZ] ⚠️  MDI reports partner status is not Active (was expecting Active since 2026-08-21). Contact MDI.');
      return { statusCode: 503, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Our telehealth service is being activated. Please try again shortly or contact support.', internal_note: 'MDI partner status is not "Active" — contact MDI, this should not happen post go-live' }) };
    }

    // ── Queue for retry on transient failures (5xx, network errors) ──
    // Don't retry 4xx (client errors like bad payload) — those won't self-heal.
    // Never retry when MDI already created something we couldn't parse (nonRetryable).
    if (!error.nonRetryable && (statusCode >= 500 || statusCode === 0)) {
      try {
        const data = JSON.parse(event.body);
        const retryStore = getStore('pending-mdi-cases');
        const retryKey = 'quiz-' + Date.now() + '-' + (data.patient?.email || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
        // Stamp the test/live decision at queue time so retryPendingCases.js can honor
        // it instead of re-resolving from (possibly since-changed) env vars — a record
        // queued as test must never be silently promoted to a billable live encounter.
        const retryTestMode = resolveTestMode({ email: data.patient?.email, explicitTest: data.is_test === true });
        const retryRecord = {
          patient: data.patient,
          product: data.product,
          dose: data.dose || null,
          compound: data.compound || null,
          quiz_answers: data.quiz_answers || null,
          allergies: data.allergies || null,
          current_medications: data.current_medications || null,
          medical_conditions: data.medical_conditions || null,
          environment: retryTestMode.liveMode ? 'live' : 'sandbox',
          is_test: retryTestMode.isTest,
          status: 'pending',
          retry_count: 0,
          original_error: error.message,
          queued_at: new Date().toISOString()
        };
        await retryStore.setJSON(retryKey, encryptRecord(retryRecord));
        console.log('[SUBMIT QUIZ] Queued for retry: ' + retryKey);
      } catch (storeErr) {
        console.error('[SUBMIT QUIZ] Failed to queue for retry:', storeErr.message);
      }
    }

    return { statusCode, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unable to submit your information. Please try again or contact support.' }) };
  }
};

/** Best-effort ops alert via the n8n webhook (never throws). */
async function alertOps(eventType, data) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'submit_quiz', event_type: eventType, severity: 'critical', timestamp: new Date().toISOString(), ...data })
    });
  } catch (e) {
    console.warn('[SUBMIT QUIZ] Ops alert failed (non-critical):', e.message);
  }
}
