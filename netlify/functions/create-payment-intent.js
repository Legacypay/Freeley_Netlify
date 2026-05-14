/**
 * Stripe PaymentIntent Creator — Netlify Serverless Function
 * 
 * Creates a PaymentIntent for the Freeley checkout flow.
 * The secret key is stored as a Netlify environment variable (STRIPE_SECRET_KEY).
 * 
 * POST /.netlify/functions/create-payment-intent
 * Body: { treatment, plan_months, compound }
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { allow } = require('./lib/rate-limit');

// Single source of truth — shared with frontend (see pricing.json in repo root)
const pricingData = require('../../pricing.json');
const { treatment_names: TREATMENT_NAMES, _meta, ...categories } = pricingData;
const PRICING = categories;

exports.handler = async (event) => {
  // CORS headers — locked to production domain (was wildcard '*')
  const ALLOWED_ORIGINS = ['https://freeley.com', 'https://www.freeley.com'];
  const reqOrigin = (event.headers && event.headers.origin) || '';
  const corsOrigin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0];
  const headers = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Rate limit: 10 payment intents / minute / IP. Stripe charges per attempt,
  // and unauthenticated callers shouldn't be able to spin up unlimited intents.
  const allowed = await allow(event, { key: 'create-payment-intent', limit: 10, windowSec: 60 });
  if (!allowed) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }) };
  }

  try {
    const { treatment, plan_months, compound, customer_email, attribution } = JSON.parse(event.body);

    // Validate treatment type
    if (!PRICING[treatment]) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid treatment type' })
      };
    }

    // Determine compound key
    let compoundKey = 'default';
    if (treatment === 'weight-loss') {
      compoundKey = (compound === 'tirzepatide' || compound === 'tirz') ? 'tirzepatide' : 'semaglutide';
    }

    // Get pricing
    const priceTier = PRICING[treatment][compoundKey] || PRICING[treatment]['default'];
    if (!priceTier) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid compound' })
      };
    }

    const months = parseInt(plan_months);
    const monthlyPrice = priceTier[months];
    if (!monthlyPrice) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid plan duration' })
      };
    }

    // Calculate total in cents (Stripe uses smallest currency unit)
    const totalCents = Math.round(monthlyPrice * months * 100);

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        treatment: treatment,
        treatment_name: TREATMENT_NAMES[treatment] || treatment,
        compound: compoundKey,
        plan_months: months.toString(),
        monthly_price: monthlyPrice.toString(),
        total: (monthlyPrice * months).toFixed(2),
        // Attribution context — used by stripeWebhook to fire server-side
        // conversion events (Meta CAPI, GA4 Measurement Protocol). Stripe
        // metadata accepts up to 50 keys, 500 chars per value.
        ...(attribution && typeof attribution === 'object'
          ? Object.fromEntries(
              Object.entries(attribution)
                .filter(([k, v]) => typeof k === 'string' && k.startsWith('attr_') && v != null)
                .slice(0, 30)
                .map(([k, v]) => [k, String(v).slice(0, 500)])
            )
          : {})
      },
      ...(customer_email && { receipt_email: customer_email }),
      description: `${TREATMENT_NAMES[treatment] || treatment} — ${months} month${months > 1 ? 's' : ''} @ $${monthlyPrice}/mo`
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        amount: totalCents,
        id: paymentIntent.id
      })
    };

  } catch (error) {
    console.error('Stripe error:', error);
    // Don't leak Stripe/internal error messages to the client. Full
    // error is logged server-side; client gets a generic message.
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Unable to process payment. Please try again or contact support.'
      })
    };
  }
};
