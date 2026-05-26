/**
 * Netlify Function: patientCases
 *
 * Looks up a patient's MDI case(s) from the mdi-orders blob store.
 * This bridges the gap where checkout stores voucher_id + patient_id
 * but the hub needs case_id (which only arrives via webhook later).
 *
 * POST /.netlify/functions/patientCases
 * Headers: { Authorization: 'Bearer <firebase-id-token>' }
 *
 * Request Body (at least one identifier required):
 * {
 *   "patient_id": "uuid",        // MDI patient ID
 *   "voucher_id": "uuid",        // MDI voucher ID (optional, faster lookup)
 *   "email": "user@example.com"  // Firebase email (optional fallback)
 * }
 *
 * Returns:
 * {
 *   "cases": [
 *     {
 *       "case_id": "uuid",
 *       "patient_id": "uuid",
 *       "voucher_id": "uuid",
 *       "product_key": "tirzepatide",
 *       "status": "approved",
 *       "created_at": "...",
 *       "updated_at": "..."
 *     }
 *   ]
 * }
 */

const { CORS_HEADERS } = require('./lib/mdi-client');
const { verifyFirebaseToken } = require('./lib/verify-firebase-token');
const { getStore } = require('@netlify/blobs');

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
    const { patient_id, voucher_id, email } = JSON.parse(event.body || '{}');

    if (!patient_id && !voucher_id && !email) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'At least one of patient_id, voucher_id, or email is required.' })
      };
    }

    // ── Step 3: Search mdi-orders blob store ────────────────────
    const store = getStore('mdi-orders');
    const { blobs } = await store.list();
    const cases = [];

    if (!blobs || blobs.length === 0) {
      console.log('[PATIENT CASES] No orders in store');
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ cases: [] })
      };
    }

    // Fast path: direct voucher_id lookup
    if (voucher_id) {
      try {
        const order = await store.get(voucher_id, { type: 'json' });
        if (order) {
          cases.push({
            case_id: order.case_id || null,
            patient_id: order.patient_id || patient_id,
            voucher_id: voucher_id,
            product_key: order.product_key || null,
            product_name: order.product_name || null,
            status: order.status || 'pending',
            first_name: order.first_name || null,
            email: order.email || null,
            created_at: order.created_at || null,
            updated_at: order.updated_at || null,
            status_history: order.status_history || []
          });
        }
      } catch { /* not found */ }
    }

    // If no direct match, scan by patient_id or email
    if (cases.length === 0) {
      for (const blob of blobs) {
        try {
          const order = await store.get(blob.key, { type: 'json' });
          if (!order) continue;

          const match =
            (patient_id && order.patient_id === patient_id) ||
            (email && order.email === email);

          if (match) {
            cases.push({
              case_id: order.case_id || null,
              patient_id: order.patient_id || patient_id,
              voucher_id: blob.key,
              product_key: order.product_key || null,
              product_name: order.product_name || null,
              status: order.status || 'pending',
              first_name: order.first_name || null,
              email: order.email || null,
              created_at: order.created_at || null,
              updated_at: order.updated_at || null,
              status_history: order.status_history || []
            });
          }
        } catch { /* skip corrupted entries */ }
      }
    }

    console.log(`[PATIENT CASES] Found ${cases.length} case(s) for patient=${patient_id || 'N/A'}, voucher=${voucher_id || 'N/A'}`);

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
