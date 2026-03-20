/**
 * Netlify Function: submitQuiz
 * 
 * Called when a patient completes the Freeley quiz.
 * Creates a patient in MDI and submits a case with the selected medication.
 * 
 * POST /.netlify/functions/submitQuiz
 * 
 * Request Body:
 * {
 *   "patient": {
 *     "first_name": "John",
 *     "last_name": "Doe",
 *     "email": "john@example.com",
 *     "date_of_birth": "1985-06-15",
 *     "gender": 1,
 *     "phone_number": "(555) 123-4567",
 *     "address": "123 Main St",
 *     "city": "Miami",
 *     "state": "FL",
 *     "zip_code": "33101"
 *   },
 *   "product": "semaglutide",
 *   "quiz_answers": [
 *     { "question": "Current weight (lbs)?", "answer": "220", "type": "number" },
 *     { "question": "BMI over 27?", "answer": "true", "type": "boolean" }
 *   ],
 *   "allergies": "None",
 *   "current_medications": "None",
 *   "medical_conditions": "None"
 * }
 */

const { mdiRequest, CORS_HEADERS } = require('./lib/mdi-client');
const { PRODUCTS, getPharmacyId } = require('./lib/products');

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const { patient: patientData, product: productKey, quiz_answers, allergies, current_medications, medical_conditions } = data;

    // ── Validate required fields ──────────────────────────────
    if (!patientData || !patientData.email || !patientData.first_name || !patientData.last_name) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Patient name and email are required.' })
      };
    }

    if (!productKey || !PRODUCTS[productKey]) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: `Invalid product: "${productKey}". Valid options: ${Object.keys(PRODUCTS).join(', ')}`
        })
      };
    }

    const product = PRODUCTS[productKey];
    const pharmacyId = getPharmacyId(productKey);

    // ── Step 1: Create or update patient in MDI ───────────────
    console.log(`[SUBMIT QUIZ] Creating patient: ${patientData.email}`);

    const patientPayload = {
      first_name: patientData.first_name,
      last_name: patientData.last_name,
      email: patientData.email,
      date_of_birth: patientData.date_of_birth,
      gender: patientData.gender || 0, // 0 = not known (ISO 5218)
      phone_number: patientData.phone_number,
      phone_type: 2, // cell
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

    // Add weight/height if provided in quiz
    if (patientData.weight) patientPayload.weight = patientData.weight;
    if (patientData.height) patientPayload.height = patientData.height;

    const patientResult = await mdiRequest(
      'POST',
      '/v1/patient/patients',
      patientPayload
    );

    const patientId = patientResult.patient_id;
    console.log(`[SUBMIT QUIZ] Patient created: ${patientId}`);

    // ── Step 2: Build quiz questions for the case ─────────────
    const caseQuestions = (quiz_answers || []).map((qa, idx) => ({
      question: qa.question,
      answer: String(qa.answer),
      type: qa.type || 'string',
      important: qa.important !== undefined ? qa.important : true,
      display_in_pdf: true,
      label: `Q${idx + 1}`,
      metadata: `freeley-quiz-${productKey}`
    }));

    // ── Step 3: Create the case with prescription ─────────────
    console.log(`[SUBMIT QUIZ] Creating case for product: ${productKey}`);

    const casePayload = {
      preferred_pharmacy_id: pharmacyId,
      case: {
        metadata: `freeley|${productKey}|${patientData.email}|${Date.now()}`,
        case_prescriptions: [
          {
            partner_compound_id: product.partner_compound_id,
            refills: product.default_refills,
            quantity: product.default_quantity,
            days_supply: product.default_days_supply,
            directions: product.default_directions,
            pharmacy_notes: product.pharmacy_notes,
            no_substitutions: true
          }
        ],
        case_questions: caseQuestions,
        // Add disease if the product has one configured
        diseases: product.disease_id ? [{ disease_id: product.disease_id }] : []
      }
    };

    const caseResult = await mdiRequest(
      'POST',
      `/v1/patient/patients/${patientId}/cases`,
      casePayload
    );

    const caseId = caseResult.case_id;
    console.log(`[SUBMIT QUIZ] Case created: ${caseId}`);

    // ── Step 4: Also fire existing lead capture webhook ────────
    const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
    if (WEBHOOK_URL) {
      try {
        await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: patientData.email,
            phone: patientData.phone_number,
            timestamp: new Date().toISOString(),
            source: 'Freeley_Quiz_MDI_Submission',
            product: productKey,
            mdi_patient_id: patientId,
            mdi_case_id: caseId
          })
        });
      } catch (e) {
        console.warn('[SUBMIT QUIZ] N8N webhook failed (non-critical):', e.message);
      }
    }

    // ── Return success ────────────────────────────────────────
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        message: 'Your information has been submitted to a licensed physician for review.',
        patient_id: patientId,
        case_id: caseId,
        product: productKey,
        estimated_review: '24-48 hours'
      })
    };

  } catch (error) {
    console.error('[SUBMIT QUIZ] Error:', error);

    const statusCode = error.statusCode || 500;
    return {
      statusCode,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Unable to submit your information. Please try again or contact support.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
