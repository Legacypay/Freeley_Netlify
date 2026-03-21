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

// Pricing must match frontend exactly
const PRICING = {
  'weight-loss': {
    semaglutide: {
      1: 194.29, 3: 149.29, 6: 124.29, 12: 99.29
    },
    tirzepatide: {
      1: 274.29, 3: 214.29, 6: 194.29, 12: 174.29
    }
  },
  'ed': {
    default: {
      1: 89, 3: 79, 6: 69, 12: 59
    }
  },
  'longevity': {
    default: {
      1: 149, 3: 129, 6: 109, 12: 99
    }
  },
  'hair-loss': {
    default: {
      1: 49, 3: 39, 6: 34, 12: 29
    }
  }
};

// Human-readable names for Stripe metadata
const TREATMENT_NAMES = {
  'weight-loss': 'GLP-1 Weight Loss Program',
  'ed': 'Sexual Wellness Protocol',
  'longevity': 'Longevity Optimization Stack',
  'hair-loss': 'Hair Loss Treatment'
};

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { treatment, plan_months, compound, customer_email } = JSON.parse(event.body);

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
        total: (monthlyPrice * months).toFixed(2)
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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Payment processing failed'
      })
    };
  }
};
