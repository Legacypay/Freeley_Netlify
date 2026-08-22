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
const { mdiRequest, resolveMdiEnvironment, CORS_HEADERS } = require('./lib/mdi-client');
const { PRODUCTS, resolveProductKey } = require('./lib/products');
const { encryptRecord } = require('./lib/phi-crypto');
const { validateQuizSubmission } = require('./lib/validate-quiz');

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
    const { patient: patientData, product: productKey, dose, quiz_answers, allergies, current_medications, medical_conditions } = data;
    // Test submissions are forced to sandbox regardless of MDI_LIVE_MODE —
    // MDI bills every live encounter not tagged "test case" in the portal.
    const isTest = data.is_test === true;
    const TAG = isTest ? '[SUBMIT QUIZ][TEST CASE]' : '[SUBMIT QUIZ]';

    // Resolve product key — handles legacy 'semaglutide'/'tirzepatide' keys
    // and dose-tiered lookups (e.g., semaglutide + dose 0.4 → semaglutide-s2)
    const resolvedKey = resolveProductKey(productKey, dose);

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

    console.log(TAG + ' Creating voucher: ' + patientData.email + ' | product: ' + resolvedKey + (productKey !== resolvedKey ? ' (from: ' + productKey + ', dose: ' + dose + ')' : ''));

    // ── Sandbox vs. Live ──
    // Sandbox unless MDI_LIVE_MODE=true in Netlify env vars; tests always sandbox.
    const env = resolveMdiEnvironment({ isTest });

    // ── Build voucher payload ──
    // The /v1/partner/vouchers endpoint is the documented public API.
    // The portal's Test Bench uses /web/partners/{id}/vouchers (session auth only —
    // returns 401 with OAuth2 Bearer tokens, confirmed 2026-05-11).
    //
    // For partners in "Integrating" status, the /v1/ endpoint returns 422
    // "Can't create live voucher under the current partner status" regardless of
    // environment. Partner went "Active" on 2026-08-21.
    //
    // The payload below matches the portal's minimal working format:
    // questionnaire_id + environment_id + hold_status (discovered via network intercept).
    const voucherPayload = {
      questionnaire_id: product.questionnaire_id,
      environment_id: env.id,
      hold_status: false,
      // Include offering_id so clinicians know which specific product/dose was ordered
      offering_id: product.offering_id || undefined
    };

    console.log(TAG + ' Submitting to MDI /v1/partner/vouchers | partner: ' + MDI_PARTNER_ID + ' | env: ' + env.name + ' (' + env.id + ') | questionnaire: ' + product.questionnaire_id);
    console.log(TAG + ' Full payload:', JSON.stringify(voucherPayload, null, 2));

    const result = await mdiRequest(
      'POST',
      '/v1/partner/vouchers',
      voucherPayload
    );

    // result.id is the VOUCHER token. Patient creates their account during onboarding.
    // patient_id may be null if we sent patient_id: null (patient created at onboarding).
    const voucherId = result.id;
    const patientId = result.patient_id || null;
    const onboardingUrl = 'https://patient.mdintegrations.com?token=' + voucherId;
    console.log(TAG + ' Voucher created: ' + voucherId + ' | Patient: ' + (patientId || 'pending-onboarding') + ' | Onboarding: ' + onboardingUrl);
    console.log(TAG + ' Full MDI response:', JSON.stringify(result, null, 2));
    if (env.name === 'live') {
      // Loud on purpose: every live voucher is a billable MDI encounter. If this
      // was manual QA, tag it "test case" in the portal immediately.
      console.warn('[SUBMIT QUIZ] ⚠️ LIVE VOUCHER CREATED (billable): ' + voucherId + ' — portal: ' + MDI_PORTAL_URL);
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
        environment: env.name,
        is_test: isTest,
        created_at: new Date().toISOString()
      });
      console.log(TAG + ' Order record saved: ' + voucherId);
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
          body: JSON.stringify({ email: patientData.email, phone: patientData.phone_number, timestamp: new Date().toISOString(), source: 'Freeley_Quiz_MDI_Submission', product: resolvedKey, original_product: productKey !== resolvedKey ? productKey : undefined, dose: dose || undefined, mdi_patient_id: patientId, mdi_voucher_id: voucherId, environment: env.name, is_test: isTest })
        });
      } catch (e) {
        console.warn('[SUBMIT QUIZ] N8N webhook failed (non-critical):', e.message);
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, message: 'Your information has been submitted to a licensed physician for review.', patient_id: patientId, voucher_id: voucherId, onboarding_url: onboardingUrl, product: resolvedKey, estimated_review: '24-48 hours' })
    };

  } catch (error) {
    console.error('[SUBMIT QUIZ] Error:', error);
    const statusCode = error.statusCode || 500;

    // ── Partner status detection ──
    // MDI returns 422 when the partner is still in "Integrating" status.
    // The /v1/partner/vouchers endpoint requires "Active" partner status.
    if (statusCode === 422 && error.message && error.message.includes('partner status')) {
      console.error('[SUBMIT QUIZ] ⚠️  Partner is still in "Integrating" status. Contact MDI to activate for live voucher creation.');
      return { statusCode: 503, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Our telehealth service is being activated. Please try again shortly or contact support.', internal_note: 'MDI partner status is "Integrating" — needs activation for live API voucher creation' }) };
    }

    // ── Queue for retry on transient failures (5xx, network errors) ──
    // Don't retry 4xx (client errors like bad payload) — those won't self-heal.
    if (statusCode >= 500 || statusCode === 0) {
      try {
        const data = JSON.parse(event.body);
        const retryStore = getStore('pending-mdi-cases');
        const retryKey = 'quiz-' + Date.now() + '-' + (data.patient?.email || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
        // Stamp the environment at queue time so retryPendingCases never
        // silently promotes a sandbox/test submission to live later.
        const retryEnv = resolveMdiEnvironment({ isTest: data.is_test === true });
        const retryRecord = {
          patient: data.patient,
          product: data.product,
          dose: data.dose || null,
          quiz_answers: data.quiz_answers || null,
          allergies: data.allergies || null,
          current_medications: data.current_medications || null,
          medical_conditions: data.medical_conditions || null,
          environment: retryEnv.name,
          is_test: data.is_test === true,
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
