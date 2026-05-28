/**
 * Netlify Function: patientCases
 *
 * Looks up a patient's MDI case data. Supports three lookup modes:
 *   1. voucher_id — fast blob lookup
 *   2. patient_id — blob scan
 *   3. email — MDI API search via partner/vouchers
 *
 * POST /.netlify/functions/patientCases
 * Headers: { Authorization: 'Bearer <firebase-id-token>' }
 *
 * Request Body:
 * {
 *   "patient_id": "uuid",        // MDI patient ID
 *   "voucher_id": "uuid",        // MDI voucher ID (optional, faster lookup)
 *   "email": "user@example.com"  // Patient email for MDI API search
 * }
 */

const { CORS_HEADERS, mdiRequest } = require('./lib/mdi-client');
const { verifyFirebaseToken } = require('./lib/verify-firebase-token');

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
    const { patient_id, voucher_id, email } = JSON.parse(event.body || '{}');

    if (!patient_id && !voucher_id && !email) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'patient_id, voucher_id, or email is required.' })
      };
    }

    console.log(`[PATIENT CASES] Looking up: patient=${patient_id || 'N/A'}, voucher=${voucher_id || 'N/A'}, email=${email || 'N/A'}`);

    const cases = [];

    // ── Step 3a: Try blob store first (fast path) ──────────────
    let blobsAvailable = false;
    if (voucher_id || patient_id) {
      try {
        const { getStore } = require('@netlify/blobs');
        const store = getStore('mdi-orders');

        if (voucher_id) {
          try {
            const order = await store.get(voucher_id, { type: 'json' });
            if (order) {
              console.log(`[PATIENT CASES] Found order by voucher_id: ${voucher_id}`);
              cases.push(orderToCase(order, voucher_id));
            }
          } catch (e) {
            console.warn(`[PATIENT CASES] Direct voucher lookup failed: ${e.message}`);
          }
        }

        if (cases.length === 0 && patient_id) {
          try {
            const { blobs } = await store.list();
            if (blobs && blobs.length > 0) {
              for (const blob of blobs) {
                try {
                  const order = await store.get(blob.key, { type: 'json' });
                  if (order && order.patient_id === patient_id) {
                    cases.push(orderToCase(order, blob.key));
                    break;
                  }
                } catch { /* skip */ }
              }
            }
          } catch (e) {
            console.warn(`[PATIENT CASES] Blob scan failed: ${e.message}`);
          }
        }

        blobsAvailable = true;
      } catch (e) {
        console.warn(`[PATIENT CASES] Blobs unavailable: ${e.message}`);
      }
    }

    // ── Step 3b: Email lookup via MDI API ───────────────────────
    if (cases.length === 0 && email) {
      console.log(`[PATIENT CASES] Searching MDI API for email: ${email}`);
      try {
        const rawResponse = await mdiRequest('GET', `/v1/partner/vouchers?email=${encodeURIComponent(email)}`);
        
        // LOG RAW RESPONSE for field mapping
        console.log('[PATIENT CASES] Raw MDI response keys:', JSON.stringify(Object.keys(rawResponse)));
        const voucherList = rawResponse.data || rawResponse.vouchers || (Array.isArray(rawResponse) ? rawResponse : []);
        
        if (voucherList.length > 0) {
          // Log first voucher's complete structure for field mapping
          console.log('[PATIENT CASES] First voucher ALL KEYS:', JSON.stringify(Object.keys(voucherList[0])));
          console.log('[PATIENT CASES] First voucher RAW:', JSON.stringify(voucherList[0]).slice(0, 2000));
        }

        for (const v of voucherList) {
          cases.push({
            case_id: v.encounter_id || v.case_id || null,
            patient_id: v.patient_id || v.patient?.id || null,
            voucher_id: v.id || v.voucher_id || null,
            product_key: v.product_key || v.offering_key || null,
            product_name: v.offering_name || v.product_name || v.offering?.name || null,
            status: v.encounter_status || v.status || 'pending',
            encounter_status: v.encounter_status || null,
            created_at: v.created_at || null,
            updated_at: v.updated_at || null
          });
        }

        if (cases.length > 0) {
          console.log(`[PATIENT CASES] Found ${cases.length} voucher(s) via MDI API`);
        } else {
          console.log(`[PATIENT CASES] No vouchers found via MDI API for: ${email}`);
        }
      } catch (e) {
        console.warn(`[PATIENT CASES] MDI voucher search failed: ${e.message}`);

        // Fallback: try partner/encounters endpoint
        try {
          const encounters = await mdiRequest('GET', `/v1/partner/encounters?email=${encodeURIComponent(email)}`);
          const encounterList = encounters.data || encounters.encounters || (Array.isArray(encounters) ? encounters : []);

          if (encounterList.length > 0) {
            console.log('[PATIENT CASES] First encounter ALL KEYS:', JSON.stringify(Object.keys(encounterList[0])));
            console.log('[PATIENT CASES] First encounter RAW:', JSON.stringify(encounterList[0]).slice(0, 2000));
          }

          for (const enc of encounterList) {
            cases.push({
              case_id: enc.id || enc.encounter_id || null,
              patient_id: enc.patient_id || enc.patient?.id || null,
              voucher_id: enc.voucher_id || null,
              product_key: enc.product_key || enc.offering_key || null,
              product_name: enc.offering_name || enc.product_name || enc.offering?.name || null,
              status: enc.status || 'pending',
              encounter_status: enc.status || null,
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
    voucher_id: voucherId,
    product_key: order.product_key || null,
    product_name: order.product_name || null,
    status: order.status || 'pending',
    created_at: order.created_at || null,
    updated_at: order.updated_at || null
  };
}
