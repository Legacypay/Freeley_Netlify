/**
 * Netlify Function: getOrders
 *
 * Allows authenticated patients to see their orders/shipments from MDI.
 * REQUIRES a valid Supabase access token in the Authorization header.
 *
 * POST /.netlify/functions/getOrders
 * Headers: { Authorization: 'Bearer <supabase-access-token>' }
 *
 * Request Body:
 * {
 *   "patient_id": "uuid-here",       // optional if voucher_id/case_id provided
 *   "case_id": "uuid-here",          // optional
 *   "voucher_id": "uuid-here"        // optional — used to resolve patient_id from blob store
 * }
 *
 * Resolution order for patient_id: request body → mdi-orders blob (direct
 * voucher_id key) → mdi-orders blob scan (by case_id/patient_id).
 *
 * Data source: MDI's Partner Orders API
 * (GET /v1/partner/patients/{patient_id}/orders), with the last known order
 * list cached on the order blob record by mdiWebhook.js as a fallback for when
 * MDI is slow or unavailable.
 *
 * Never errors for "nothing to show yet" — a patient whose voucher hasn't been
 * redeemed, or whose pharmacy order hasn't been created, gets
 * { has_orders: false, orders: [] } with a 200, same as caseStatus.js.
 */

const { mdiRequest, CORS_HEADERS } = require('./lib/mdi-client');
const { verifySupabaseToken } = require('./lib/verify-supabase-token');
const { resolveOwnedOrder } = require('./lib/mdi-order-ownership');

// Map MDI order statuses to patient-friendly messages.
// MDI's documented enum is pending/received/ready/fulfilled, but the field is an
// open string — anything not listed here falls through to UNKNOWN_STATUS below
// rather than being mislabelled as one of these steps.
const ORDER_STATUS_MAP = {
  'pending': {
    status: 'pending',
    title: 'Order Placed',
    message: 'Your order has been placed and is waiting to be picked up by the pharmacy.',
    icon: '🧾'
  },
  'received': {
    status: 'received',
    title: 'Received by Pharmacy',
    message: 'The pharmacy has received your order and will begin preparing it shortly.',
    icon: '📥'
  },
  'processing': {
    status: 'processing',
    title: 'Being Prepared',
    message: 'The pharmacy is preparing your medication.',
    icon: '🔄'
  },
  'ready': {
    status: 'ready',
    title: 'Ready to Ship',
    message: 'Your medication is prepared and ready to leave the pharmacy.',
    icon: '📦'
  },
  'fulfilled': {
    status: 'shipped',
    title: 'On Its Way',
    message: 'Your order has shipped. Use the tracking details to follow your delivery.',
    icon: '🚚'
  },
  'shipped': {
    status: 'shipped',
    title: 'On Its Way',
    message: 'Your order has shipped. Use the tracking details to follow your delivery.',
    icon: '🚚'
  },
  'delivered': {
    status: 'delivered',
    title: 'Delivered',
    message: 'Your order has been delivered. Contact support if anything looks wrong.',
    icon: '🏠'
  },
  'cancelled': {
    status: 'cancelled',
    title: 'Order Cancelled',
    message: 'This order has been cancelled. Please contact support if you have questions.',
    icon: '❌'
  },
  'canceled': {
    status: 'cancelled',
    title: 'Order Cancelled',
    message: 'This order has been cancelled. Please contact support if you have questions.',
    icon: '❌'
  },
  'failed': {
    status: 'failed',
    title: 'Order Problem',
    message: 'There was a problem with this order. Our team is looking into it — please contact support.',
    icon: '⚠️'
  }
};

// Deliberate fallback for any status MDI sends that we don't recognise.
// Unlike caseStatus.js (which falls back to 'created'), an unknown ORDER status
// must never claim a specific fulfilment step — a wrong "Delivered"/"Shipped"
// on a medication order is a real patient-safety/trust problem. We say
// "processing" and echo the raw MDI status verbatim instead.
function unknownStatus(rawStatus) {
  return {
    status: 'processing',
    title: 'Processing',
    message: `We're processing this order. Current pharmacy status: ${rawStatus || 'unknown'}.`,
    icon: '🔄'
  };
}

// Map one raw MDI order into the patient-facing shape the hub renders.
// `billing` / card details are intentionally dropped — the hub doesn't need them.
function mapOrder(raw) {
  const rawStatus = typeof raw.status === 'string' ? raw.status : '';
  const friendly = ORDER_STATUS_MAP[rawStatus.toLowerCase()] || unknownStatus(rawStatus);

  // tracking is null (not {}) until MDI actually sets it
  let tracking = null;
  if (raw.tracking && (raw.tracking.number || raw.tracking.link)) {
    tracking = {
      number: raw.tracking.number || null,
      company: raw.tracking.company || null,
      link: raw.tracking.link || null
    };
  }

  return {
    order_id: raw.id || null,
    order_number: raw.order_number || null,
    case_id: raw.case_id || null,
    ...friendly,
    raw_status: rawStatus || null,
    tracking,
    products: (raw.products || []).map(p => ({
      name: p.name || null,
      image_url: p.image_url || null,
      amount: p.amount != null ? p.amount : 1
    })),
    payment_status: raw.payment_status || null,
    total_amount: raw.total_amount != null ? raw.total_amount : null,
    ordered_at: raw.order_created_at || raw.created_at || null,
    updated_at: raw.updated_at || null
  };
}

function emptyResponse() {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      has_orders: false,
      orders: [],
      last_updated: new Date().toISOString()
    })
  };
}

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
    // ── Step 1: Verify Supabase authentication ──────────────────
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const user = await verifySupabaseToken(idToken);
    if (!user) {
      console.warn('[GET ORDERS] Unauthorized access attempt — no valid Supabase token');
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Authentication required. Please sign in.' })
      };
    }

    console.log(`[GET ORDERS] Authenticated user: ${user.email}`);

    // ── Step 2: Parse request ───────────────────────────────────
    const { patient_id, case_id, voucher_id } = JSON.parse(event.body || '{}');

    // ── Step 2b: Resolve patient_id from a blob record OWNED by this user ──
    // patient_id/case_id/voucher_id are client-supplied and therefore untrusted —
    // without this check, any authenticated patient could pass another patient's
    // identifier and read their orders/tracking/medications. resolveOwnedOrder
    // only trusts a patient_id that comes from an mdi-orders record whose `email`
    // matches the verified Supabase session's email (lib/mdi-order-ownership.js).
    // A patient_id/case_id/voucher_id that doesn't resolve to an owned record is
    // treated the same as "nothing to show yet" — never leaked, never
    // distinguished from a 404.
    const ownedOrder = await resolveOwnedOrder({ voucher_id, patient_id, case_id }, user.email, '[GET ORDERS]');
    const resolvedPatientId = ownedOrder ? (ownedOrder.patient_id || null) : null;
    const cachedOrders = ownedOrder && Array.isArray(ownedOrder.orders) ? ownedOrder.orders : null;

    // No owned patient_id = voucher not redeemed yet, patient not created by MDI
    // yet, or the caller supplied an identifier that isn't theirs. All three are
    // handled identically — a normal pending state, not an error, and never
    // distinguishable from "that's not your order" to avoid an enumeration oracle.
    if (!resolvedPatientId) {
      console.log('[GET ORDERS] No owned patient_id resolved — returning empty order list');
      return emptyResponse();
    }

    // ── Step 3: Fetch the live order list from MDI ──────────────
    // Prefer live data; fall back to the webhook-cached list so a slow or down
    // MDI never turns into a 500 for the patient.
    let rawOrders = null;
    try {
      const response = await mdiRequest(
        'GET',
        `/v1/partner/patients/${resolvedPatientId}/orders?per_page=50`
      );
      if (response && Array.isArray(response.data)) {
        rawOrders = response.data;
        console.log(`[GET ORDERS] MDI returned ${rawOrders.length} order(s) for patient ${resolvedPatientId}`);
      } else {
        console.warn('[GET ORDERS] MDI response had no data array — falling back to cache');
      }
    } catch (err) {
      console.warn(`[GET ORDERS] Live MDI order fetch failed (falling back to cache): ${err.message}`);
    }

    if (!rawOrders) {
      rawOrders = Array.isArray(cachedOrders) ? cachedOrders : [];
      console.log(`[GET ORDERS] Using cached order list (${rawOrders.length} order(s))`);
    }

    // ── Step 4: Map into the patient-friendly shape ─────────────
    const orders = rawOrders.map(mapOrder);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        has_orders: orders.length > 0,
        orders,
        last_updated: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('[GET ORDERS] Error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unable to retrieve your orders. Please try again.' })
    };
  }
};
