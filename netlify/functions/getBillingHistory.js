/**
 * Netlify Function: getBillingHistory
 *
 * Fetches billing data from Stripe for the authenticated patient:
 * - Payment methods (saved cards)
 * - Charge/payment history with receipts
 *
 * POST /.netlify/functions/getBillingHistory
 * Headers: { Authorization: 'Bearer <supabase-access-token>' }
 * Body: { "email": "patient@email.com" }
 */

const { CORS_HEADERS } = require('./lib/mdi-client');
const { verifySupabaseToken } = require('./lib/verify-supabase-token');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    // Verify Supabase auth
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const user = await verifySupabaseToken(idToken);
    if (!user) {
      return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Authentication required.' }) };
    }

    const { email } = JSON.parse(event.body || '{}');
    const customerEmail = email || user.email;

    if (!customerEmail) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Email is required.' }) };
    }

    // Check if Stripe is configured
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.warn('[BILLING] STRIPE_SECRET_KEY not configured');
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ payment_methods: [], charges: [], message: 'Billing system not yet configured.' })
      };
    }

    const stripe = require('stripe')(stripeKey);

    console.log(`[BILLING] Looking up customer: ${customerEmail}`);

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });

    if (!customers.data || customers.data.length === 0) {
      console.log(`[BILLING] No Stripe customer found for: ${customerEmail}`);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ payment_methods: [], charges: [] })
      };
    }

    const customer = customers.data[0];
    console.log(`[BILLING] Found customer: ${customer.id}`);

    // Fetch payment methods
    let paymentMethods = [];
    try {
      const methods = await stripe.paymentMethods.list({
        customer: customer.id,
        type: 'card',
        limit: 5
      });
      paymentMethods = (methods.data || []).map(pm => ({
        id: pm.id,
        brand: pm.card.brand || 'card',
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
        is_default: pm.id === customer.invoice_settings?.default_payment_method
      }));
    } catch (e) {
      console.warn(`[BILLING] Payment methods fetch failed: ${e.message}`);
    }

    // Fetch charge history
    let charges = [];
    try {
      const chargeList = await stripe.charges.list({
        customer: customer.id,
        limit: 20
      });
      charges = (chargeList.data || []).map(ch => ({
        id: ch.id,
        amount: ch.amount / 100,
        currency: ch.currency,
        status: ch.status,
        description: ch.description || ch.statement_descriptor || 'Freeley Health',
        created: new Date(ch.created * 1000).toISOString(),
        receipt_url: ch.receipt_url || null,
        refunded: ch.refunded,
        paid: ch.paid
      }));
    } catch (e) {
      console.warn(`[BILLING] Charges fetch failed: ${e.message}`);
      
      // Fallback: try payment intents
      try {
        const piList = await stripe.paymentIntents.list({
          customer: customer.id,
          limit: 20
        });
        charges = (piList.data || []).filter(pi => pi.status === 'succeeded').map(pi => ({
          id: pi.id,
          amount: pi.amount / 100,
          currency: pi.currency,
          status: pi.status,
          description: pi.description || pi.metadata?.product_name || 'Freeley Health',
          created: new Date(pi.created * 1000).toISOString(),
          receipt_url: pi.charges?.data?.[0]?.receipt_url || null,
          refunded: false,
          paid: true
        }));
      } catch (e2) {
        console.warn(`[BILLING] PaymentIntents fetch also failed: ${e2.message}`);
      }
    }

    console.log(`[BILLING] Found ${paymentMethods.length} payment method(s), ${charges.length} charge(s)`);

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
      body: JSON.stringify({ error: 'Unable to retrieve billing history.' })
    };
  }
};
