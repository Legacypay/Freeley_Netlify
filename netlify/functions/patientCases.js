/**
 * Netlify Function: patientCases
 *
 * Looks up a patient's MDI case data. Supports three lookup modes:
 *   1. voucher_id — fast blob lookup
 *   2. patient_id — blob scan
 *   3. email — MDI API search via partner/vouchers
 *
 * POST /.netlify/functions/patientCases
 * Headers: { Authorization: 'Bearer <supabase-access-token>' }
 *
 * Request Body:
 * {
 *   "patient_id": "uuid",        // MDI patient ID
 *   "voucher_id": "uuid",        // MDI voucher ID (optional, faster lookup)
 *   "email": "user@example.com"  // Patient email for MDI API search
 * }
 */

const { CORS_HEADERS, mdiRequest } = require('./lib/mdi-client');
const { verifySupabaseToken } = require('./lib/verify-supabase-token');
const { resolveOwnedOrder } = require('./lib/mdi-order-ownership');

// Map MDI questionnaire IDs to patient-friendly product names
const QUESTIONNAIRE_PRODUCT_MAP = {
  'c77365a4-2945-41cc-bb4e-aa2f4db3fd2d': 'Semaglutide',
  '6a2a9f59-da27-495f-8ae6-e1f0203b1693': 'Tirzepatide',
  'f3c247d5-9c9a-473b-a813-46e8d96dcfcc': 'NAD+ Injection',
  '0c7cc2e5-3cab-4d00-861b-a185c8c7534d': 'Sermorelin Injectable',
  '6c017f64-2003-43f5-a9e2-70edc45a9779': 'Sermorelin Troche',
  '15347393-f6ac-4de8-9df9-d17668688334': 'Sermorelin Nasal Spray',
  '46b72995-1283-437f-b1c6-88e39bb75769': 'Glutathione Troche',
  '909332c3-8d98-4d51-83de-6876c2b21e09': 'Glutathione Injectable',
  '41b11b51-e34a-44ca-8c5e-ef55143b489b': 'Hair Growth Tablet',
  '216e49e4-09b5-4cb6-b1c2-93375d75dcac': 'Ivy Hair Tablet',
  '57cdb9de-d40f-40a6-8eea-603f238fd1e3': 'Willow Hair Tablet',
  'e79bf378-05a9-47e5-bff6-cf92a9199785': 'VitalPeptide Hair Therapy',
  'd384fb1d-4217-4f87-9877-40c283e34f48': 'Tadalafil',
  '0ce92a4d-d479-4e01-82ec-03c364cdad1f': 'Olympus Peak',
  '38f85c79-7d25-46f4-afd1-eae54d91b446': 'Olympus'
};

// Map questionnaire IDs to product categories for image display
const QUESTIONNAIRE_CATEGORY_MAP = {
  'c77365a4-2945-41cc-bb4e-aa2f4db3fd2d': 'weight-loss',
  '6a2a9f59-da27-495f-8ae6-e1f0203b1693': 'weight-loss',
  'f3c247d5-9c9a-473b-a813-46e8d96dcfcc': 'longevity',
  '0c7cc2e5-3cab-4d00-861b-a185c8c7534d': 'longevity',
  '6c017f64-2003-43f5-a9e2-70edc45a9779': 'longevity',
  '15347393-f6ac-4de8-9df9-d17668688334': 'longevity',
  '46b72995-1283-437f-b1c6-88e39bb75769': 'longevity',
  '909332c3-8d98-4d51-83de-6876c2b21e09': 'longevity',
  '41b11b51-e34a-44ca-8c5e-ef55143b489b': 'hair-loss',
  '216e49e4-09b5-4cb6-b1c2-93375d75dcac': 'hair-loss',
  '57cdb9de-d40f-40a6-8eea-603f238fd1e3': 'hair-loss',
  'e79bf378-05a9-47e5-bff6-cf92a9199785': 'hair-loss',
  'd384fb1d-4217-4f87-9877-40c283e34f48': 'sexual-wellness',
  '0ce92a4d-d479-4e01-82ec-03c364cdad1f': 'sexual-wellness',
  '38f85c79-7d25-46f4-afd1-eae54d91b446': 'sexual-wellness'
};

exports.handler = async (event) => {
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
    // ── Step 1: Verify Supabase authentication ──────────────────
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const user = await verifySupabaseToken(idToken);
    if (!user) {
      console.warn('[PATIENT CASES] Unauthorized access attempt');
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Authentication required. Please sign in.' })
      };
    }

    console.log(`[PATIENT CASES] Authenticated user: ${user.email}`);

    // ── Step 2: Parse request ───────────────────────────────────
    const { patient_id, voucher_id, email: requestedEmail } = JSON.parse(event.body || '{}');
    const userEmail = (user.email || '').toLowerCase().trim();

    if (requestedEmail && requestedEmail.toLowerCase().trim() !== userEmail) {
      // The client-supplied email is untrusted — searching MDI by an arbitrary
      // email would let one authenticated patient look up another patient's
      // cases. Always search under the verified Supabase session's own email;
      // just log the mismatch for visibility.
      console.warn(`[PATIENT CASES] Ignoring requested email (${requestedEmail}) — using authenticated session email instead`);
    }

    if (!patient_id && !voucher_id && !userEmail) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'patient_id, voucher_id, or an authenticated session email is required.' })
      };
    }

    console.log(`[PATIENT CASES] Looking up: patient=${patient_id || 'N/A'}, voucher=${voucher_id || 'N/A'}, email=${userEmail || 'N/A'}`);

    const cases = [];

    // ── Step 3a: Try blob store first (fast path) ───────────────
    // patient_id/voucher_id are client-supplied and therefore untrusted —
    // resolveOwnedOrder only trusts a blob record whose `email` matches the
    // authenticated session (lib/mdi-order-ownership.js).
    if (voucher_id || patient_id) {
      const order = await resolveOwnedOrder({ voucher_id, patient_id }, userEmail, '[PATIENT CASES]');
      if (order) {
        cases.push(orderToCase(order, order.voucher_id || voucher_id));
      }
    }

    // ── Step 3b: Email lookup via MDI API ────────────────────────
    // Always searches the AUTHENTICATED user's own email — never the
    // client-supplied `email` field (see the ownership note above).
    if (cases.length === 0 && userEmail) {
      console.log(`[PATIENT CASES] Searching MDI API for authenticated email`);
      try {
        const rawResponse = await mdiRequest('GET', `/v1/partner/vouchers?email=${encodeURIComponent(userEmail)}`);
        const voucherList = rawResponse.data || rawResponse.vouchers || (Array.isArray(rawResponse) ? rawResponse : []);

        for (const v of voucherList) {
          // MDI voucher fields (from API response):
          //   id, status, case_id, partner_questionnaire_id, 
          //   patient (nested object with id, email, etc.),
          //   metadata, pharmacy_name, created_at, updated_at
          const questionnaireId = v.partner_questionnaire_id || null;
          const patientObj = v.patient || {};

          cases.push({
            case_id: v.case_id || null,
            patient_id: patientObj.id || patientObj.uuid || null,
            patient_email: patientObj.email || null,
            voucher_id: v.id || null,
            questionnaire_id: questionnaireId,
            product_name: QUESTIONNAIRE_PRODUCT_MAP[questionnaireId] || null,
            product_category: QUESTIONNAIRE_CATEGORY_MAP[questionnaireId] || null,
            status: v.status || 'pending',
            pharmacy_name: v.pharmacy_name || null,
            onboarding_url: v.onboarding_url || null,
            is_expired: v.is_expired || v.expired || false,
            created_at: v.created_at || null,
            updated_at: v.updated_at || null
          });
        }

        if (cases.length > 0) {
          console.log(`[PATIENT CASES] Found ${cases.length} voucher(s) via MDI API`);
          // Log first case for debugging
          const first = cases[0];
          console.log(`[PATIENT CASES] First: patient_id=${first.patient_id}, product=${first.product_name}, status=${first.status}`);
        } else {
          console.log(`[PATIENT CASES] No vouchers found via MDI API for authenticated email`);
        }
      } catch (e) {
        console.warn(`[PATIENT CASES] MDI voucher search failed: ${e.message}`);

        // Fallback: try partner/encounters endpoint
        try {
          const encounters = await mdiRequest('GET', `/v1/partner/encounters?email=${encodeURIComponent(userEmail)}`);
          const encounterList = encounters.data || encounters.encounters || (Array.isArray(encounters) ? encounters : []);

          for (const enc of encounterList) {
            const qId = enc.partner_questionnaire_id || null;
            cases.push({
              case_id: enc.id || enc.case_id || null,
              patient_id: enc.patient_id || (enc.patient && enc.patient.id) || null,
              patient_email: (enc.patient && enc.patient.email) || null,
              voucher_id: enc.voucher_id || null,
              questionnaire_id: qId,
              product_name: QUESTIONNAIRE_PRODUCT_MAP[qId] || null,
              product_category: QUESTIONNAIRE_CATEGORY_MAP[qId] || null,
              status: enc.status || 'pending',
              pharmacy_name: enc.pharmacy_name || null,
              onboarding_url: null,
              is_expired: false,
              created_at: enc.created_at || null,
              updated_at: enc.updated_at || null
            });
          }

          if (cases.length > 0) {
            console.log(`[PATIENT CASES] Found ${cases.length} encounter(s) via MDI API`);
          }
        } catch (e2) {
          console.warn(`[PATIENT CASES] MDI encounter search also failed: ${e2.message}`);
        }
      }
    }

    console.log(`[PATIENT CASES] Returning ${cases.length} case(s)`);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ cases })
    };

  } catch (error) {
    console.error('[PATIENT CASES] Error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unable to retrieve cases. Please try again.' })
    };
  }
};

function orderToCase(order, voucherId) {
  return {
    case_id: order.case_id || null,
    patient_id: order.patient_id || null,
    patient_email: order.email || null,
    voucher_id: voucherId,
    questionnaire_id: order.questionnaire_id || null,
    product_name: order.product_name || QUESTIONNAIRE_PRODUCT_MAP[order.questionnaire_id] || null,
    product_category: order.product_category || QUESTIONNAIRE_CATEGORY_MAP[order.questionnaire_id] || null,
    status: order.status || 'pending',
    pharmacy_name: null,
    onboarding_url: null,
    is_expired: false,
    created_at: order.created_at || null,
    updated_at: order.updated_at || null
  };
}
