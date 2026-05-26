/**
 * Netlify Function: caseStatus
 *
 * Allows authenticated patients to check the status of their MDI case.
 * REQUIRES a valid Firebase ID token in the Authorization header.
 *
 * POST /.netlify/functions/caseStatus
 * Headers: { Authorization: 'Bearer <firebase-id-token>' }
 *
 * Request Body:
 * {
 *   "patient_id": "uuid-here",
 *   "case_id": "uuid-here",          // optional if voucher_id provided
 *   "voucher_id": "uuid-here"        // optional — used to resolve case_id from blob store
 * }
 *
 * If case_id is missing but voucher_id or patient_id is provided,
 * the function will attempt to resolve case_id from the mdi-orders
 * blob store before calling the MDI API.
 *
 * Returns a simplified, patient-friendly status.
 */

const { mdiRequest, CORS_HEADERS } = require('./lib/mdi-client');
const { verifyFirebaseToken } = require('./lib/verify-firebase-token');
const { getStore } = require('@netlify/blobs');

// Map MDI internal statuses to patient-friendly messages
const STATUS_MAP = {
  'created': {
    status: 'submitted',
    title: 'Submitted for Review',
    message: 'Your information has been submitted. A licensed physician will review your case shortly.',
    icon: '📝'
  },
  'assigned': {
    status: 'in_review',
    title: 'Under Physician Review',
    message: 'A licensed physician is currently reviewing your health information.',
    icon: '👨‍⚕️'
  },
  'waiting': {
    status: 'needs_info',
    title: 'Additional Information Needed',
    message: 'Your physician has a question for you. Please check your messages.',
    icon: '⏳'
  },
  'processing': {
    status: 'processing',
    title: 'Prescription Processing',
    message: 'Great news! Your prescription has been approved and is being processed by the pharmacy.',
    icon: '🔄'
  },
  'approved': {
    status: 'approved',
    title: 'Approved',
    message: 'Your case has been approved by the physician. Your prescription is being prepared.',
    icon: '✅'
  },
  'completed': {
    status: 'completed',
    title: 'Prescription Ready',
    message: 'Your prescription has been confirmed and your order is being prepared for shipment.',
    icon: '🎉'
  },
  'cancelled': {
    status: 'cancelled',
    title: 'Case Cancelled',
    message: 'This case has been cancelled. Please contact support if you have questions.',
    icon: '❌'
  },
  'support': {
    status: 'support',
    title: 'Under Support Review',
    message: 'Your case has been escalated to our support team. We\'ll be in touch soon.',
    icon: '🛟'
  }
};

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
      console.warn('[CASE STATUS] Unauthorized access attempt — no valid Firebase token');
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Authentication required. Please sign in.' })
      };
    }

    console.log(`[CASE STATUS] Authenticated user: ${user.email}`);

    // ── Step 2: Parse and validate request ──────────────────────
    const { patient_id, case_id, voucher_id } = JSON.parse(event.body);

    let resolvedPatientId = patient_id;
    let resolvedCaseId = case_id;

    // ── Step 2b: If case_id missing, resolve from blob store ───
    if (!resolvedCaseId && (voucher_id || resolvedPatientId)) {
      console.log(`[CASE STATUS] No case_id — resolving from blobs (voucher=${voucher_id || 'N/A'}, patient=${resolvedPatientId || 'N/A'})`);
      try {
        const store = getStore('mdi-orders');

        // Fast path: direct voucher_id lookup
        if (voucher_id) {
          try {
            const order = await store.get(voucher_id, { type: 'json' });
            if (order) {
              console.log(`[CASE STATUS] Found order by voucher_id: case_id=${order.case_id || 'none'}, status=${order.status}`);
              resolvedCaseId = order.case_id || null;
              resolvedPatientId = resolvedPatientId || order.patient_id;

              // If no case_id in the blob yet (webhook hasn't fired), return what we have
              if (!resolvedCaseId) {
                return {
                  statusCode: 200,
                  headers: CORS_HEADERS,
                  body: JSON.stringify({
                    status: order.status || 'submitted',
                    title: 'Submitted for Review',
                    message: 'Your information has been submitted. A licensed physician will review your case shortly.',
                    icon: '📝',
                    case_id: null,
                    patient_id: resolvedPatientId,
                    voucher_id: voucher_id,
                    clinician: null,
                    offerings: [],
                    last_updated: order.updated_at || order.created_at || null
                  })
                };
              }
            }
          } catch (e) {
            console.warn(`[CASE STATUS] Direct voucher lookup failed: ${e.message}`);
          }
        }

        // Fallback: scan by patient_id
        if (!resolvedCaseId && resolvedPatientId) {
          try {
            const { blobs } = await store.list();
            if (blobs && blobs.length > 0) {
              for (const blob of blobs) {
                try {
                  const order = await store.get(blob.key, { type: 'json' });
                  if (order && order.patient_id === resolvedPatientId) {
                    console.log(`[CASE STATUS] Found order by patient_id: ${blob.key}, case_id=${order.case_id || 'none'}`);
                    resolvedCaseId = order.case_id || null;
                    if (!resolvedCaseId) {
                      return {
                        statusCode: 200,
                        headers: CORS_HEADERS,
                        body: JSON.stringify({
                          status: order.status || 'submitted',
                          title: 'Submitted for Review',
                          message: 'Your information has been submitted. A licensed physician will review your case shortly.',
                          icon: '📝',
                          case_id: null,
                          patient_id: resolvedPatientId,
                          voucher_id: blob.key,
                          clinician: null,
                          offerings: [],
                          last_updated: order.updated_at || order.created_at || null
                        })
                      };
                    }
                    break;
                  }
                } catch { /* skip */ }
              }
            }
          } catch (e) {
            console.warn(`[CASE STATUS] Blob scan failed: ${e.message}`);
          }
        }
      } catch (blobErr) {
        console.warn(`[CASE STATUS] Blob store access failed: ${blobErr.message}`);
        // Continue — we might still have case_id from the original request
      }
    }

    // If we still don't have a case_id, return a "submitted/pending" status
    // rather than an error — the case may not have been created by MDI yet
    if (!resolvedCaseId) {
      console.log(`[CASE STATUS] No case_id resolved — returning pending status`);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          status: 'submitted',
          title: 'Submitted for Review',
          message: 'Your information has been submitted. A licensed physician will review your case shortly.',
          icon: '📝',
          case_id: null,
          patient_id: resolvedPatientId || null,
          voucher_id: voucher_id || null,
          clinician: null,
          offerings: [],
          last_updated: new Date().toISOString()
        })
      };
    }

    // ── Step 3: Fetch case details from MDI ─────────────────────
    const caseData = await mdiRequest(
      'GET',
      `/v1/patient/patients/${resolvedPatientId}/cases/${resolvedCaseId}`
    );

    // ── Step 4: Extract the status ──────────────────────────────
    const mdiStatus = caseData.case_status?.name?.toLowerCase() || 'created';
    const friendlyStatus = STATUS_MAP[mdiStatus] || STATUS_MAP['created'];

    // Extract clinician info (if assigned)
    let clinician = null;
    if (caseData.case_assignment?.clinician) {
      const doc = caseData.case_assignment.clinician;
      clinician = {
        name: doc.full_name,
        specialty: doc.clinician_specialty || doc.specialty,
        photo: doc.photo?.url_thumbnail || null
      };
    }

    // Extract prescription/offering info
    const offerings = (caseData.case_offerings || []).map(o => ({
      name: o.name || o.title,
      status: o.status || 'pending'
    }));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ...friendlyStatus,
        case_id: resolvedCaseId,
        patient_id: resolvedPatientId,
        clinician,
        offerings,
        last_updated: caseData.case_status?.updated_at || null
      })
    };

  } catch (error) {
    console.error('[CASE STATUS] Error:', error);

    if (error.statusCode === 404) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Case not found. Please check your case ID.' })
      };
    }

    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unable to retrieve case status. Please try again.' })
    };
  }
};

// Exported for reference only
exports.verifyFirebaseToken = verifyFirebaseToken;
