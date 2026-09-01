/**
 * Records a completed purchase in Supabase's `public.funnel_orders` table.
 *
 * Called ONLY from the server, right after a payment gateway confirms an
 * approved charge (create-authnet-transaction.js). Never from the browser:
 * the amount and status must stay server-authoritative, and the
 * `save_funnel_order` RPC has no way to re-verify a charge actually happened.
 *
 * Uses the public anon key + a SECURITY DEFINER RPC — the same pattern as the
 * quiz's `save_funnel_lead` — so no Supabase service-role key needs to exist
 * in the function environment.
 *
 * READS and the cancel WRITE (Hub billing) are different: they run AS THE
 * PATIENT. getMyFunnelOrders / cancelMySubscription forward the patient's own
 * Supabase access token, and the RPCs (migration 0009) take the email from
 * auth.jwt() — there is no email parameter anyone could point at someone else.
 *
 * Best-effort by design: a Supabase outage must never fail a charge that
 * Authorize.Net already accepted. Callers should treat a null return as
 * "not recorded" and log it, nothing more.
 */

const { createClient } = require('@supabase/supabase-js');

let client = null;
function getClient() {
  if (client) return client;
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

/**
 * A Supabase client that acts AS the signed-in patient: PostgREST evaluates
 * auth.jwt() from this Authorization header, so the JWT-bound RPCs below can
 * only ever see/update rows joined to that patient's own email.
 */
function getUserClient(accessToken) {
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !accessToken) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + accessToken } }
  });
}

/**
 * @param {object} order
 * @param {string|null} order.leadId           funnel_leads.id (= the quiz's session id), or null
 * @param {number}      order.planMonths
 * @param {number}      order.amountCents
 * @param {'paid'|'pending'|'failed'|'refunded'} order.status
 * @param {string}      order.gateway           e.g. 'authorize_net'
 * @param {string}      order.gatewayTransactionId
 * @param {object}      [order.billing]         { firstName, lastName, address, city, state, zip, dateOfBirth }
 * @param {object}      [order.card]            { brand, last4, customerProfileId, paymentProfileId } — gateway refs + masked display only, never PAN
 * @param {string|null} [order.authnetSubscriptionId] the Authorize.Net ARB subscription id for this plan's
 *                      recurring schedule (see lib/authnet-arb.js), or null if none was created
 * @returns {Promise<string|null>} the funnel_orders.id, or null if not recorded
 */
async function saveFunnelOrder(order) {
  const supabase = getClient();
  if (!supabase) {
    console.warn('[FUNNEL ORDERS] PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY not set — order not recorded');
    return null;
  }
  const b = order.billing || {};
  const c = order.card || {};
  const { data, error } = await supabase.rpc('save_funnel_order', {
    p_lead_id: order.leadId || null,
    p_plan_months: order.planMonths,
    p_amount_cents: order.amountCents,
    p_status: order.status,
    p_gateway: order.gateway,
    p_gateway_transaction_id: order.gatewayTransactionId,
    p_first_name: b.firstName || null,
    p_last_name: b.lastName || null,
    p_address: b.address || null,
    p_city: b.city || null,
    p_us_state: b.state || null,
    p_zip: b.zip || null,
    p_date_of_birth: b.dateOfBirth || null,
    p_product_name: order.productName || null,
    p_treatment: order.treatment || null,
    p_card_brand: c.brand || null,
    p_card_last4: c.last4 || null,
    p_customer_profile_id: c.customerProfileId ? String(c.customerProfileId) : null,
    p_payment_profile_id: c.paymentProfileId ? String(c.paymentProfileId) : null,
    p_authnet_subscription_id: order.authnetSubscriptionId ? String(order.authnetSubscriptionId) : null
  });
  if (error) {
    console.error('[FUNNEL ORDERS] save_funnel_order failed:', error.message);
    return null;
  }
  return data || null;
}

/**
 * Purchases for the Hub's Billing tab, for the patient whose access token this
 * is. The email is NOT a parameter anywhere — the RPC reads it from the JWT.
 * @param {string} accessToken the verified Supabase access token from the request
 * @returns {Promise<Array<object>>} newest first; [] on any failure
 */
async function getMyFunnelOrders(accessToken) {
  const supabase = getUserClient(accessToken);
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_my_funnel_orders');
  if (error) {
    console.error('[FUNNEL ORDERS] get_my_funnel_orders failed:', error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

/**
 * Marks one of the calling patient's OWN subscriptions canceled in Supabase
 * (Authorize.Net is canceled separately by cancelSubscription.js). The RPC
 * joins on the JWT's email, so it can never touch another patient's row.
 * @returns {Promise<boolean>} true only if a row was actually found and marked canceled
 */
async function cancelMySubscription(accessToken, authnetSubscriptionId) {
  const supabase = getUserClient(accessToken);
  if (!supabase || !authnetSubscriptionId) return false;
  const { data, error } = await supabase.rpc('cancel_my_subscription', {
    p_authnet_subscription_id: String(authnetSubscriptionId)
  });
  if (error) {
    console.error('[FUNNEL ORDERS] cancel_my_subscription failed:', error.message);
    return false;
  }
  return data === true;
}

module.exports = { saveFunnelOrder, getMyFunnelOrders, cancelMySubscription };
