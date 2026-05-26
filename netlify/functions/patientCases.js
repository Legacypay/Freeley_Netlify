/**
 * Netlify Function: patientCases
 *
 * Looks up a patient's MDI case data from the mdi-orders blob store.
 * This bridges the gap where checkout stores voucher_id + patient_id
 * but the hub needs case_id (which only arrives via webhook later).
 *
 * POST /.netlify/functions/patientCases
 * Headers: { Authorization: 'Bearer <firebase-id-token>' }
 *
 * Request Body:
 * {
 *   "patient_id": "uuid",        // MDI patient ID
 *   "voucher_id": "uuid"         // MDI voucher ID (optional, faster lookup)
 * }
 */

const { CORS_HEADERS } = require('./lib/mdi-client');
const { verifyFirebaseToken } = require('./lib/verify-firebase-token');
const { getStore } = require('@netlify/blobs');

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
    const { patient_id, voucher_id } = JSON.parse(event.body || '{}');

    if (!patient_id && !voucher_id) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'patient_id or voucher_id is required.' })
      };
    }

    // ── Step 3: Search mdi-orders blob store ────────────────────
    console.log(`[PATIENT CASES] Looking up: patient=${patient_id || 'N/A'}, voucher=${voucher_id || 'N/A'}`);

    const store = getStore('mdi-orders');
    const cases = [];

    // Fast path: direct voucher_id lookup
    if (voucher_id) {
      try {
        const order = await store.get(voucher_id, { type: 'json' });
        if (order) {
          console.log(`[PATIENT CASES] Found order by voucher_id: ${voucher_id}, case_id: ${order.case_id || 'none'}`);
          cases.push(orderToCase(order, voucher_id));
        }
      } catch (e) {
        console.warn(`[PATIENT CASES] Direct voucher lookup failed: ${e.message}`);
      }
    }

    // If no direct match, scan by patient_id
    if (cases.length === 0 && patient_id) {
      try {
        const { blobs } = await store.list();
        if (blobs && blobs.length > 0) {
          for (const blob of blobs) {
            try {
              const order = await store.get(blob.key, { type: 'json' });
              if (order && order.patient_id === patient_id) {
                console.log(`[PATIENT CASES] Found order by patient_id: ${blob.key}, case_id: ${order.case_id || 'none'}`);
                cases.push(orderToCase(order, blob.key));
                break; // Return most recent match
              }
            } catch { /* skip */ }
          }
        }
      } catch (e) {
        console.warn(`[PATIENT CASES] Blob scan failed: ${e.message}`);
      }
    }

    console.log(`[PATIENT CASES] Found ${cases.length} case(s)`);

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
    status: order.status || 'pending',
    created_at: order.created_at || null,
    updated_at: order.updated_at || null
  };
}
