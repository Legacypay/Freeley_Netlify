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

// Environment IDs (matching submitQuiz.js)
const MDI_SANDBOX_ENV_ID = '6ab0181e-d52a-488f-a161-d64d576b2eba';
const MDI_LIVE_ENV_ID = 'b374c499-638d-4e72-b844-4c68fcda2eff';

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
    const { patient_id, voucher_id } = JSON.parse(event.body || '{}');

    if (!patient_id) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'patient_id is required.' })
      };
    }

    // ── Step 3: Look up via MDI Partner API ─────────────────────
    // Strategy: Use the partner voucher endpoint to get voucher details
    // which includes the case_id, then fetch the full case.
    console.log(`[PATIENT CASES] Looking up cases for patient: ${patient_id}, voucher: ${voucher_id || 'N/A'}`);

    const cases = [];

    // Try Partner voucher endpoint if we have a voucher_id
    if (voucher_id) {
      try {
        const partnerId = process.env.MDI_PARTNER_ID || 'f81508d1-3c53-4849-a636-1e9050a68e00';
        const isLive = process.env.MDI_LIVE_MODE === 'true';
        const envId = isLive ? MDI_LIVE_ENV_ID : MDI_SANDBOX_ENV_ID;
        if (partnerId && envId) {
          const voucherData = await mdiRequest('GET', `/v1/partner/partners/${partnerId}/environments/${envId}/vouchers/${voucher_id}`);
          console.log(`[PATIENT CASES] Voucher response keys: ${Object.keys(voucherData || {}).join(', ')}`);

          const caseId = voucherData.case_id || voucherData.encounter_id || (voucherData.case && voucherData.case.id);
          if (caseId) {
            // Now fetch the full case details
            try {
              const caseData = await mdiRequest('GET', `/v1/patient/patients/${patient_id}/cases/${caseId}`);
              let clinician = null;
              if (caseData.case_assignment?.clinician) {
                const doc = caseData.case_assignment.clinician;
                clinician = {
                  name: doc.full_name || doc.name,
                  specialty: doc.clinician_specialty || doc.specialty,
                  photo: doc.photo?.url_thumbnail || null
                };
              }
              cases.push({
                case_id: caseId,
                status: caseData.case_status?.name?.toLowerCase() || 'unknown',
                created_at: caseData.created_at || null,
                updated_at: caseData.case_status?.updated_at || caseData.updated_at || null,
                clinician,
                offerings: (caseData.case_offerings || []).map(o => ({
                  name: o.name || o.title,
                  status: o.status
                }))
              });
            } catch (caseErr) {
              console.warn(`[PATIENT CASES] Could not fetch full case ${caseId}:`, caseErr.message);
              // Still return the case_id even without full details
              cases.push({ case_id: caseId, status: 'unknown' });
            }
          } else {
            console.log('[PATIENT CASES] Voucher found but no case_id yet (patient may not have completed intake)');
            // Return voucher info without a case
            cases.push({
              case_id: null,
              status: voucherData.status || 'voucher_pending',
              voucher_status: voucherData.status,
              created_at: voucherData.created_at || null
            });
          }
        }
      } catch (voucherErr) {
        console.warn(`[PATIENT CASES] Voucher lookup failed:`, voucherErr.message);
      }
    }

    // Fallback: try listing encounters via partner endpoint
    if (cases.length === 0) {
      try {
        const partnerId = process.env.MDI_PARTNER_ID || 'f81508d1-3c53-4849-a636-1e9050a68e00';
        const isLive = process.env.MDI_LIVE_MODE === 'true';
        const envId = isLive ? MDI_LIVE_ENV_ID : MDI_SANDBOX_ENV_ID;
        if (partnerId && envId) {
          // Try partner encounters endpoint with patient_id filter
          const encounters = await mdiRequest('GET', `/v1/partner/partners/${partnerId}/environments/${envId}/encounters?patient_id=${patient_id}`);
          const rawList = Array.isArray(encounters) ? encounters : (encounters.data || encounters.encounters || []);

          for (const enc of rawList) {
            cases.push({
              case_id: enc.id || enc.case_id || enc.encounter_id,
              status: enc.status?.toLowerCase() || enc.case_status?.name?.toLowerCase() || 'unknown',
              created_at: enc.created_at || null,
              updated_at: enc.updated_at || null,
              clinician: null
            });
          }
        }
      } catch (encErr) {
        console.warn(`[PATIENT CASES] Encounters lookup failed:`, encErr.message);
      }
    }

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
