/**
 * Netlify Function: submitQuiz
 * Called when a patient completes the Freeley checkout.
 * Creates a patient + encounter in MDI via the partner voucher endpoint.
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
const { PRODUCTS, getPharmacyId, resolveProductKey } = require('./lib/products');

// MDI Partner ID — from the partner portal URL
const MDI_PARTNER_ID = process.env.MDI_PARTNER_ID || 'f81508d1-3c53-4849-a636-1e9050a68e00';

// MDI Environment IDs — discovered from portal Test Bench → Create Voucher
// The environment_id is REQUIRED for voucher creation per PostPartnerVoucherRequest schema.
// Switch to live environment once MDI moves partner status from "Integrating" to "Active".
const MDI_SANDBOX_ENV_ID = '6ab0181e-d52a-488f-a161-d64d576b2eba';
const MDI_ENVIRONMENT_ID = process.env.MDI_ENVIRONMENT_ID || MDI_SANDBOX_ENV_ID;

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

    const pharmacyId = getPharmacyId(resolvedKey);

    console.log('[SUBMIT QUIZ] Creating patient + encounter: ' + patientData.email + ' | product: ' + resolvedKey + (productKey !== resolvedKey ? ' (from: ' + productKey + ', dose: ' + dose + ')' : ''));

    // ── Build patient object per MDI PostVoucherPatientCaseRequest schema ──
    const patient = {
      first_name: patientData.first_name,
      last_name: patientData.last_name,
      email: patientData.email,
      date_of_birth: patientData.date_of_birth || null,
      gender: patientData.gender || 0,
      phone_number: patientData.phone_number || '',
      phone_type: '2', // mobile
      address: {
        address: patientData.address || '',
        address2: patientData.address2 || null,
        city_name: patientData.city || '',
        state_name: patientData.state || '',
        zip_code: patientData.zip_code || ''
      }
    };

    if (patientData.weight) patient.weight = patientData.weight;
    if (patientData.height) patient.height = patientData.height;

    // ── Build case_questions from quiz answers ──
    const caseQuestions = (quiz_answers || []).map((qa, idx) => ({
      question: qa.question,
      answer: String(qa.answer),
      type: qa.type || 'string',
      important: qa.important !== undefined ? qa.important : true,
      display_in_pdf: true,
      label: 'Q' + (idx + 1),
      metadata: 'freeley-quiz-' + resolvedKey
    }));

    // ── Build case object ──
    // NOTE: case_prescriptions requires partner_compound_id / partner_medication_id
    // but MDI offerings don't have these set (all null per API query 2026-05-06).
    // Instead, we use the top-level `offerings` array with the offering UUID,
    // which tells MDI which product to prescribe. Prescription details (quantity,
    // refills, directions, etc.) are configured on the offering in the MDI dashboard.
    const caseObj = {
      metadata: 'freeley|' + resolvedKey + '|' + patientData.email + '|' + Date.now(),
      is_additional_approval_needed: null,
      case_prescriptions: [],
      case_questions: caseQuestions,
      case_files: [],
      diseases: product.icd10 ? [{ icd10_code: product.icd10 }] : []
    };

    // ── Build completion_time (HH:MM:SS format, required by MDI) ──
    const now = new Date();
    const completionTime = String(now.getHours()).padStart(2, '0') + ':' +
                           String(now.getMinutes()).padStart(2, '0') + ':' +
                           String(now.getSeconds()).padStart(2, '0');

    // ── Single API call: POST /v1/partner/vouchers ──
    // Creates a voucher that generates the encounter (case) with the selected offering.
    // Per MDI PostPartnerVoucherRequest schema: offerings[] specifies the product,
    // case_prescriptions[] is left empty (no compounds/medications registered).
    // demo flag: set to true while partner is in test/sandbox status,
    // switch to false (or remove) once MDI activates the partner for live
    const isDemo = process.env.MDI_DEMO_MODE !== 'false';

    const voucherPayload = {
      questionnaire_id: product.questionnaire_id,
      environment_id: MDI_ENVIRONMENT_ID,
      completion_time: completionTime,
      preferred_pharmacy_id: pharmacyId || null,
      patient: patient,
      case: caseObj,
      offerings: [{ id: product.offering_id }],
      hold_status: false,
      demo: isDemo
    };

    console.log('[SUBMIT QUIZ] Submitting to MDI voucher endpoint for partner: ' + MDI_PARTNER_ID);

    const result = await mdiRequest(
      'POST',
      '/v1/partner/vouchers',
      voucherPayload
    );

    const encounterId = result.id;
    const patientId = result.patient_id;
    console.log('[SUBMIT QUIZ] Encounter created: ' + encounterId + ' | Patient: ' + patientId);

    // ── N8N Webhook (non-critical) ──
    const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
    if (WEBHOOK_URL) {
      try {
        await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: patientData.email, phone: patientData.phone_number, timestamp: new Date().toISOString(), source: 'Freeley_Quiz_MDI_Submission', product: resolvedKey, original_product: productKey !== resolvedKey ? productKey : undefined, dose: dose || undefined, mdi_patient_id: patientId, mdi_encounter_id: encounterId })
        });
      } catch (e) {
        console.warn('[SUBMIT QUIZ] N8N webhook failed (non-critical):', e.message);
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, message: 'Your information has been submitted to a licensed physician for review.', patient_id: patientId, case_id: encounterId, product: resolvedKey, estimated_review: '24-48 hours' })
    };

  } catch (error) {
    console.error('[SUBMIT QUIZ] Error:', error);
    const statusCode = error.statusCode || 500;
    return { statusCode, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unable to submit your information. Please try again or contact support.', details: process.env.NODE_ENV === 'development' ? error.message : undefined }) };
  }
};
