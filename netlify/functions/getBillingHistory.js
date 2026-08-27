/**
 * Netlify Function: getBillingHistory
 *
 * Billing data for the authenticated patient's Hub "Billing" tab:
 * - charges: from Supabase `funnel_orders` (every approved Authorize.Net
 *   charge is recorded there by create-authnet-transaction.js), plus any
 *   legacy Stripe charges if STRIPE_SECRET_KEY is still set — Stripe was the
 *   original processor and old customers may have history there.
 * - payment_methods: Authorize.Net never stores the card (Accept.js tokenizes
 *   it one-time in the browser), so this is only ever populated from legacy
 *   Stripe customers. Empty is the normal state for Authorize.Net patients.
 *
 * Ownership: orders are looked up STRICTLY by the verified Supabase session
 * email. The `email` field the client sends is ignored (same IDOR posture as
 * patientCases.js) — honoring it would let one patient read another's receipts.
 *
 * POST /.netlify/functions/getBillingHistory
 * Headers: { Authorization: 'Bearer <supabase-access-token>' }
 */

const { CORS_HEADERS } = require('./lib/mdi-client');
const { verifySupabaseToken } = require('./lib/verify-supabase-token');
const { getFunnelOrdersForEmail } = require('./lib/funnel-orders');

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

    const customerEmail = (user.email || '').toLowerCase().trim();
    if (!customerEmail) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Authenticated session has no email.' }) };
    }

    let requestedEmail;
    try { requestedEmail = JSON.parse(event.body || '{}').email; } catch { /* ignore */ }
    if (requestedEmail && String(requestedEmail).toLowerCase().trim() !== customerEmail) {
      console.warn('[BILLING] Ignoring client-supplied email — using authenticated session email');
    }

    // ── Authorize.Net-era purchases (Supabase funnel_orders) ──
    const orders = await getFunnelOrdersForEmail(customerEmail);
    const charges = orders.map(o => ({
      id: o.gateway_transaction_id || o.id,
      amount: (o.amount_cents || 0) / 100,
      currency: 'usd',
      status: o.status,
      description: o.product_name || 'Freeley Health',
      created: o.created_at,
      receipt_url: null, // Authorize.Net emails its own receipt; no hosted PDF
      refunded: o.status === 'refunded',
      paid: o.status === 'paid'
    }));
    console.log(`[BILLING] funnel_orders: ${charges.length} charge(s)`);

    // ── Legacy Stripe history (only if Stripe is still configured) ──
    let paymentMethods = [];
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      try {
        const stripe = require('stripe')(stripeKey);
        const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
        const customer = customers.data && customers.data[0];
        if (customer) {
          const methods = await stripe.paymentMethods.list({ customer: customer.id, type: 'card', limit: 10 });
          paymentMethods = (methods.data || []).map(pm => ({
            id: pm.id,
            brand: pm.card?.brand,
            last4: pm.card?.last4,
            exp_month: pm.card?.exp_month,
            exp_year: pm.card?.exp_year,
            is_default: pm.id === customer.invoice_settings?.default_payment_method
          }));
          const chargeList = await stripe.charges.list({ customer: customer.id, limit: 20 });
          for (const ch of chargeList.data || []) {
            charges.push({
              id: ch.id,
              amount: ch.amount / 100,
              currency: ch.currency,
              status: ch.status,
              description: ch.description || ch.statement_descriptor || 'Freeley Health',
              created: new Date(ch.created * 1000).toISOString(),
              receipt_url: ch.receipt_url || null,
              refunded: ch.refunded,
              paid: ch.paid
            });
          }
          console.log(`[BILLING] Stripe legacy: ${paymentMethods.length} method(s), ${(chargeList.data || []).length} charge(s)`);
        }
      } catch (e) {
        // Legacy source is best-effort; the Supabase charges above still return.
        console.warn(`[BILLING] Stripe legacy lookup failed (non-blocking): ${e.message}`);
      }
    }

    charges.sort((a, b) => new Date(b.created) - new Date(a.created));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ payment_methods: paymentMethods, charges })
    };

  } catch (error) {
    console.error('[BILLING] Error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unable to load billing history. Please try again.' })
    };
  }
};
