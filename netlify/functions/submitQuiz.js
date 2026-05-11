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

const { mdiRequest, CORS_HEADERS } = require('./lib/mdi-client');
const { PRODUCTS, resolveProductKey } = require('./lib/products');

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
    const data = JSON.parse(event.body);
    const { patient: patientData, product: productKey, dose, quiz_answers, allergies, current_medications, medical_conditions } = data;

    if (!patientData || !patientData.email || !patientData.first_name || !patientData.last_name) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Patient name and email are required.' }) };
    }

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

    // ── demo flag: true while partner is in "Integrating" status ──
    // Switch to false once MDI activates the partner for live production
    const isDemo = process.env.MDI_DEMO_MODE !== 'false';

    // ── Build voucher payload ──
    // Uses the 9 documented PostPartnerVoucherRequest fields PLUS environment_id.
    // environment_id is not in the documented schema but IS sent by the MDI portal's
    // own "Create Voucher" Test Bench tool. Without it, the API returns 422
    // "Can't create live voucher under the current partner status" even with demo:true.
    // The portal maps Environment="Sandbox" → environment_id=6ab0181e-...
    const environmentId = isDemo ? MDI_SANDBOX_ENV_ID : MDI_LIVE_ENV_ID;

    const voucherPayload = {
      patient_id: null,
      questionnaire_id: product.questionnaire_id,
      demo: isDemo,
      environment_id: environmentId,
      offerings: [{ id: product.offering_id }],
      hold_status: false,
      diseases: product.icd10 ? [{ icd10_code: product.icd10 }] : [],
      case_prescriptions: [],
      case_services: [],
      expires_at: null
    };

    console.log('[SUBMIT QUIZ] Submitting to MDI /v1/partner/vouchers | partner: ' + MDI_PARTNER_ID + ' | demo: ' + isDemo + ' | env: ' + environmentId + ' | offering: ' + product.offering_id + ' | questionnaire: ' + product.questionnaire_id);
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
    return { statusCode, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unable to submit your information. Please try again or contact support.', details: error.message, debug_status: statusCode, debug_demo: process.env.MDI_DEMO_MODE, debug_demo_flag: (process.env.MDI_DEMO_MODE !== 'false') }) };
  }
};
