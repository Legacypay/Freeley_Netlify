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

// MDI Partner ID — from the partner portal URL
const MDI_PARTNER_ID = process.env.MDI_PARTNER_ID || 'f81508d1-3c53-4849-a636-1e9050a68e00';

// MDI Environment IDs — discovered from portal Test Bench "Create Voucher" form.
// The portal sends environment_id to route vouchers to sandbox vs. live.
// While not in the documented PostPartnerVoucherRequest schema, the portal
// clearly uses it and it appears to be required for sandbox/demo voucher creation.
const MDI_SANDBOX_ENV_ID = '6ab0181e-d52a-488f-a161-d64d576b2eba';
const MDI_LIVE_ENV_ID = 'b374c499-638d-4e72-b844-4c68fcda2eff';

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

    console.log('[SUBMIT QUIZ] Creating voucher: ' + patientData.email + ' | product: ' + resolvedKey + (productKey !== resolvedKey ? ' (from: ' + productKey + ', dose: ' + dose + ')' : ''));

    // ── Sandbox vs. Live ──
    // Defaults to LIVE (production). Set MDI_DEMO_MODE=true in Netlify env
    // vars ONLY for sandbox/integration testing.
    const isDemo = process.env.MDI_DEMO_MODE === 'true';

    // ── Build voucher payload ──
    // The /v1/partner/vouchers endpoint is the documented public API.
    // The portal's Test Bench uses /web/partners/{id}/vouchers (session auth only —
    // returns 401 with OAuth2 Bearer tokens, confirmed 2026-05-11).
    //
    // For partners in "Integrating" status, the /v1/ endpoint returns 422
    // "Can't create live voucher under the current partner status" regardless of
    // demo flag. This appears to be a deliberate restriction — API voucher creation
    // requires "Active" partner status. During integration testing, vouchers can
    // only be created via the portal's Test Bench UI.
    //
    // The payload below matches the portal's minimal working format:
    // questionnaire_id + environment_id + hold_status (discovered via network intercept).
    // Once the partner status changes to "Active", this should work without the 422.
    const environmentId = isDemo ? MDI_SANDBOX_ENV_ID : MDI_LIVE_ENV_ID;

    const voucherPayload = {
      questionnaire_id: product.questionnaire_id,
      environment_id: environmentId,
      hold_status: false,
      // Include offering_id so clinicians know which specific product/dose was ordered
      offering_id: product.offering_id || undefined
    };

    console.log('[SUBMIT QUIZ] Submitting to MDI /v1/partner/vouchers | partner: ' + MDI_PARTNER_ID + ' | demo: ' + isDemo + ' | env: ' + environmentId + ' | questionnaire: ' + product.questionnaire_id);
    console.log('[SUBMIT QUIZ] Full payload:', JSON.stringify(voucherPayload, null, 2));

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
    console.log('[SUBMIT QUIZ] Voucher created: ' + voucherId + ' | Patient: ' + (patientId || 'pending-onboarding') + ' | Onboarding: ' + onboardingUrl);
    console.log('[SUBMIT QUIZ] Full MDI response:', JSON.stringify(result, null, 2));

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
        environment: isDemo ? 'sandbox' : 'live',
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
          body: JSON.stringify({ email: patientData.email, phone: patientData.phone_number, timestamp: new Date().toISOString(), source: 'Freeley_Quiz_MDI_Submission', product: resolvedKey, original_product: productKey !== resolvedKey ? productKey : undefined, dose: dose || undefined, mdi_patient_id: patientId, mdi_voucher_id: voucherId })
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
        const retryRecord = {
          patient: data.patient,
          product: data.product,
          dose: data.dose || null,
          quiz_answers: data.quiz_answers || null,
          allergies: data.allergies || null,
          current_medications: data.current_medications || null,
          medical_conditions: data.medical_conditions || null,
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
