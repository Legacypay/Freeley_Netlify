/**
 * Netlify Function: patientCases
 *
 * Looks up a patient's MDI case(s) via the MDI Partner API.
 * This bridges the gap where checkout stores voucher_id + patient_id
 * but the hub needs case_id (which only arrives via webhook later).
 *
 * POST /.netlify/functions/patientCases
 * Headers: { Authorization: 'Bearer <firebase-id-token>' }
 *
 * Request Body:
 * {
 *   "patient_id": "uuid"   // MDI patient ID (required)
 * }
 *
 * Returns:
 * {
 *   "cases": [
 *     {
 *       "case_id": "uuid",
 *       "status": "assigned",
 *       "created_at": "...",
 *       "clinician": { "name": "...", "specialty": "..." }
 *     }
 *   ]
 * }
 */

const { mdiRequest, CORS_HEADERS } = require('./lib/mdi-client');
const { verifyFirebaseToken } = require('./lib/verify-firebase-token');

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
    // ── Step 1: Verify Firebase authentication ──────────────────
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const user = await verifyFirebaseToken(idToken);
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
    const { patient_id } = JSON.parse(event.body || '{}');

    if (!patient_id) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'patient_id is required.' })
      };
    }

    // ── Step 3: Fetch patient's cases from MDI API ──────────────
    // GET /v1/patient/patients/{patient_id}/cases returns all cases
    console.log(`[PATIENT CASES] Fetching cases for patient: ${patient_id}`);

    let casesData;
    try {
      casesData = await mdiRequest('GET', `/v1/patient/patients/${patient_id}/cases`);
    } catch (apiErr) {
      // If 404, patient has no cases yet
      if (apiErr.statusCode === 404) {
        console.log('[PATIENT CASES] No cases found for patient (404)');
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ cases: [] })
        };
      }
      throw apiErr;
    }

    // MDI may return an array directly or { data: [...] } or { cases: [...] }
    const rawCases = Array.isArray(casesData)
      ? casesData
      : (casesData.data || casesData.cases || [casesData]);

    const cases = rawCases.map(c => {
      let clinician = null;
      if (c.case_assignment?.clinician) {
        const doc = c.case_assignment.clinician;
        clinician = {
          name: doc.full_name || doc.name,
          specialty: doc.clinician_specialty || doc.specialty,
          photo: doc.photo?.url_thumbnail || null
        };
      }

      return {
        case_id: c.id || c.case_id,
        status: c.case_status?.name?.toLowerCase() || c.status || 'unknown',
        created_at: c.created_at || null,
        updated_at: c.case_status?.updated_at || c.updated_at || null,
        clinician,
        offerings: (c.case_offerings || []).map(o => ({
          name: o.name || o.title,
          status: o.status
        }))
      };
    });

    console.log(`[PATIENT CASES] Found ${cases.length} case(s) for patient ${patient_id}`);

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
