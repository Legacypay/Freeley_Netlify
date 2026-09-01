/**
 * Netlify Function: cancelSubscription
 *
 * Cancels a patient's recurring Authorize.Net subscription (ARB) — every
 * checkout plan is now a real subscription (see lib/authnet-arb.js), so this
 * is the "Cancel subscription" button's endpoint in the Hub's Billing tab.
 *
 * Ownership: exactly the same posture as getBillingHistory.js — the patient
 * can only ever cancel a subscription tied to one of THEIR OWN funnel_orders
 * rows (matched by the verified Supabase session email, never a client-
 * supplied one), enforced independently twice: once here by only looking up
 * the subscription id in that patient's own order list, and again inside the
 * cancel_my_subscription RPC itself, which joins on the caller's JWT email (see supabase/migrations/0009).
 *
 * POST /.netlify/functions/cancelSubscription
 * Headers: { Authorization: 'Bearer <supabase-access-token>' }
 * Body: { "authnet_subscription_id": "..." }
 */

const { CORS_HEADERS } = require('./lib/mdi-client');
const { verifySupabaseToken } = require('./lib/verify-supabase-token');
const { getMyFunnelOrders, cancelMySubscription } = require('./lib/funnel-orders');
const { cancelArbSubscription } = require('./lib/authnet-arb');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const user = await verifySupabaseToken(idToken);
    if (!user) {
      return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Authentication required.' }) };
    }
    const email = (user.email || '').toLowerCase().trim();
    if (!email) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Authenticated session has no email.' }) };
    }

    let subscriptionId;
    try { subscriptionId = String(JSON.parse(event.body || '{}').authnet_subscription_id || '').trim(); } catch { /* ignore */ }
    if (!subscriptionId) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'authnet_subscription_id is required.' }) };
    }

    // Ownership check #1: the subscription id must belong to one of THIS
    // patient's own orders and still be active — never trust the id alone.
    const orders = await getMyFunnelOrders(idToken);
    const owns = orders.some(o => o.authnet_subscription_id === subscriptionId && o.subscription_status === 'active');
    if (!owns) {
      console.warn(`[CANCEL SUBSCRIPTION] Refusing: subscription ${subscriptionId} not an active subscription owned by this session`);
      // Same non-distinguishing response whether the id doesn't exist, isn't
      // theirs, or is already canceled — never an enumeration oracle.
      return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'No active subscription found with that ID.' }) };
    }

    const result = await cancelArbSubscription(subscriptionId);
    if (!result.canceled) {
      console.error(`[CANCEL SUBSCRIPTION] Authorize.Net cancel failed for ${subscriptionId}: ${result.reason}`);
      return { statusCode: 502, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unable to cancel with the payment processor right now. Please try again or contact support.' }) };
    }

    // Ownership check #2 (defense in depth) happens again inside this RPC.
    const marked = await cancelMySubscription(idToken, subscriptionId);
    if (!marked) {
      // The cancellation with Authorize.Net already succeeded — the patient
      // will not be charged again regardless. Only our own record is stale.
      console.error(`[CANCEL SUBSCRIPTION] ⚠️ Canceled ${subscriptionId} at Authorize.Net but failed to update funnel_orders — reconcile manually`);
    }

    console.log(`[CANCEL SUBSCRIPTION] Canceled ${subscriptionId} for email#${require('crypto').createHash('sha256').update(email).digest('hex').slice(0, 10)}`);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ canceled: true }) };
  } catch (error) {
    console.error('[CANCEL SUBSCRIPTION] Error:', error);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unable to cancel subscription. Please try again.' }) };
  }
};
