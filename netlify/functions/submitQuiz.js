/**
 * Netlify Function: submitQuiz
 * Called when a patient completes the Freeley checkout.
 * Creates a patient in MDI and submits a case with the selected medication.
 *
 * POST /.netlify/functions/submitQuiz
 */

const { mdiRequest, CORS_HEADERS } = require('./lib/mdi-client');
const { PRODUCTS, getPharmacyId, resolveProductKey } = require('./lib/products');

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

    const pharmacyId = getPharmacyId(resolvedKey);

    console.log('[SUBMIT QUIZ] Creating patient: ' + patientData.email + ' | product: ' + resolvedKey + (productKey !== resolvedKey ? ' (from: ' + productKey + ', dose: ' + dose + ')' : ''));

    const patientPayload = {
      first_name: patientData.first_name,
      last_name: patientData.last_name,
      email: patientData.email,
      date_of_birth: patientData.date_of_birth,
      gender: patientData.gender || 0,
      phone_number: patientData.phone_number,
      phone_type: 2,
      address: {
        address: patientData.address,
        city_name: patientData.city,
        state_name: patientData.state,
        zip_code: patientData.zip_code
      },
      allergies: allergies || 'None reported',
      current_medications: current_medications || 'None reported',
      medical_conditions: medical_conditions || 'None reported',
      pregnancy: false
    };

    if (patientData.weight) patientPayload.weight = patientData.weight;
    if (patientData.height) patientPayload.height = patientData.height;

    const patientResult = await mdiRequest('POST', '/v1/patient/patients', patientPayload);
    const patientId = patientResult.patient_id;
    console.log('[SUBMIT QUIZ] Patient created: ' + patientId);

    const caseQuestions = (quiz_answers || []).map((qa, idx) => ({
      question: qa.question,
      answer: String(qa.answer),
      type: qa.type || 'string',
      important: qa.important !== undefined ? qa.important : true,
      display_in_pdf: true,
      label: 'Q' + (idx + 1),
      metadata: 'freeley-quiz-' + resolvedKey
    }));

    console.log('[SUBMIT QUIZ] Creating case for product: ' + resolvedKey);

    const casePayload = {
      preferred_pharmacy_id: pharmacyId,
      case: {
        metadata: 'freeley|' + resolvedKey + '|' + patientData.email + '|' + Date.now(),
        case_prescriptions: [
          {
            partner_compound_id: product.offering_id,
            refills: product.default_refills,
            quantity: product.default_quantity,
            days_supply: product.default_days_supply,
            directions: product.default_directions,
            no_substitutions: true
          }
        ],
        case_questions: caseQuestions,
        diseases: product.icd10 ? [{ icd10_code: product.icd10 }] : []
      }
    };

    const caseResult = await mdiRequest('POST', '/v1/patient/patients/' + patientId + '/cases', casePayload);
    const caseId = caseResult.case_id;
    console.log('[SUBMIT QUIZ] Case created: ' + caseId);

    const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
    if (WEBHOOK_URL) {
      try {
        await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: patientData.email, phone: patientData.phone_number, timestamp: new Date().toISOString(), source: 'Freeley_Quiz_MDI_Submission', product: resolvedKey, original_product: productKey !== resolvedKey ? productKey : undefined, dose: dose || undefined, mdi_patient_id: patientId, mdi_case_id: caseId })
        });
      } catch (e) {
        console.warn('[SUBMIT QUIZ] N8N webhook failed (non-critical):', e.message);
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, message: 'Your information has been submitted to a licensed physician for review.', patient_id: patientId, case_id: caseId, product: resolvedKey, estimated_review: '24-48 hours' })
    };

  } catch (error) {
    console.error('[SUBMIT QUIZ] Error:', error);
    const statusCode = error.statusCode || 500;
    return { statusCode, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unable to submit your information. Please try again or contact support.', details: process.env.NODE_ENV === 'development' ? error.message : undefined }) };
  }
};
