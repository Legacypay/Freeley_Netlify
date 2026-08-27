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
 * @param {object} order
 * @param {string|null} order.leadId           funnel_leads.id (= the quiz's session id), or null
 * @param {number}      order.planMonths
 * @param {number}      order.amountCents
 * @param {'paid'|'pending'|'failed'|'refunded'} order.status
 * @param {string}      order.gateway           e.g. 'authorize_net'
 * @param {string}      order.gatewayTransactionId
 * @param {object}      [order.billing]         { firstName, lastName, address, city, state, zip, dateOfBirth }
 * @returns {Promise<string|null>} the funnel_orders.id, or null if not recorded
 */
async function saveFunnelOrder(order) {
  const supabase = getClient();
  if (!supabase) {
    console.warn('[FUNNEL ORDERS] PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY not set — order not recorded');
    return null;
  }
  const b = order.billing || {};
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
    p_date_of_birth: b.dateOfBirth || null
  });
  if (error) {
    console.error('[FUNNEL ORDERS] save_funnel_order failed:', error.message);
    return null;
  }
  return data || null;
}

module.exports = { saveFunnelOrder };
