/**
 * Authorize.Net Transaction Creator — Netlify Serverless Function
 *
 * Replaces create-payment-intent.js (Stripe). Charges a card via the
 * Authorize.Net "createTransactionRequest" API using an Accept.js opaque
 * data token (the card number never touches our server — Accept.js
 * tokenizes it in the browser).
 *
 * POST /.netlify/functions/create-authnet-transaction
 * Body: {
 *   treatment, plan_months, compound,        // → server computes the price
 *   opaqueData: { dataDescriptor, dataValue },// from Accept.js
 *   attribution: { attr_* },                  // for server-side conversion
 *   email, firstName, lastName, phone, zip,   // for billTo + conversion
 *   lead_id?, address?, city?, state?,        // for the funnel_orders record
 *   date_of_birth?                            //   (Supabase, see lib/funnel-orders.js)
 * }
 *
 * Returns: { approved:true, transactionId, amount } on success,
 *          { approved:false, error } on decline/error.
 *
 * Required Netlify env vars:
 *   AUTHNET_API_LOGIN_ID     - API Login ID (also used client-side by Accept.js)
 *   AUTHNET_TRANSACTION_KEY  - Transaction Key  ← SECRET, server-only
 *   AUTHNET_ENV              - "production" (default) | "sandbox"
 *
 * The price is ALWAYS computed server-side from pricing.json. The client
 * never sends a dollar amount — exactly like the old Stripe function.
 */

const { allow } = require('./lib/rate-limit');
const { fireConversion } = require('./lib/conversion-tracker');
const { saveFunnelOrder } = require('./lib/funnel-orders');
const { ensureHubAccount } = require('./lib/hub-account');
const { findPromo, discountCents } = require('./lib/promos');

// Single source of truth for pricing — shared with the frontend display.
const pricingData = require('../../pricing.json');
const { treatment_names: TREATMENT_NAMES, _meta, promos: _promos, ...categories } = pricingData;
const PRICING = categories;

// Authorize.Net endpoints. Production credentials → api.authorize.net.
// (A separate sandbox account would use apitest.authorize.net.)
const ENDPOINTS = {
  production: 'https://api.authorize.net/xml/v1/request.api',
  sandbox: 'https://apitest.authorize.net/xml/v1/request.api'
};

exports.handler = async (event) => {
  const ALLOWED_ORIGINS = ['https://freeley.com', 'https://www.freeley.com'];
  // `netlify dev`/`netlify functions:serve` set NETLIFY_DEV=true — never in
  // production — so local testing (astro dev on a different port than the
  // functions server) can reach this function without a temporary edit.
  if (process.env.NETLIFY_DEV === 'true') {
    ALLOWED_ORIGINS.push('http://localhost:4321', 'http://localhost:8888');
  }
  const reqOrigin = (event.headers && event.headers.origin) || '';
  const corsOrigin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0];
  const headers = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Rate limit: 10 charge attempts / minute / IP.
  const allowed = await allow(event, { key: 'create-authnet-transaction', limit: 10, windowSec: 60 });
  if (!allowed) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }) };
  }

  const API_LOGIN_ID = process.env.AUTHNET_API_LOGIN_ID;
  const TRANSACTION_KEY = process.env.AUTHNET_TRANSACTION_KEY;
  const AUTHNET_ENV = (process.env.AUTHNET_ENV || 'production').toLowerCase();
  const endpoint = ENDPOINTS[AUTHNET_ENV] || ENDPOINTS.production;

  if (!API_LOGIN_ID || !TRANSACTION_KEY) {
    console.error('[AUTHNET] CRITICAL: AUTHNET_API_LOGIN_ID / AUTHNET_TRANSACTION_KEY not set');
    return { statusCode: 500, headers, body: JSON.stringify({ approved: false, error: 'Payment is not configured. Please contact support.' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { treatment, plan_months, compound, opaqueData, attribution } = body;
    const email = (body.email || '').trim();
    const firstName = (body.firstName || '').trim();
    const lastName = (body.lastName || '').trim();
    const zip = (body.zip || '').trim();
    // Only for the funnel_orders record — not sent to Authorize.Net.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const leadId = UUID_RE.test(String(body.lead_id || '')) ? body.lead_id : null;
    const billing = {
      firstName, lastName, zip,
      address: String(body.address || '').trim().slice(0, 200) || null,
      city: String(body.city || '').trim().slice(0, 100) || null,
      state: String(body.state || '').trim().slice(0, 2).toUpperCase() || null,
      dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(String(body.date_of_birth || '')) ? body.date_of_birth : null
    };

    // ── Validate the Accept.js token ──
    if (!opaqueData || !opaqueData.dataDescriptor || !opaqueData.dataValue) {
      return { statusCode: 400, headers, body: JSON.stringify({ approved: false, error: 'Missing payment token. Please re-enter your card details.' }) };
    }

    // ── Validate treatment + compute price server-side (mirrors Stripe fn) ──
    if (!PRICING[treatment]) {
      return { statusCode: 400, headers, body: JSON.stringify({ approved: false, error: 'Invalid treatment type' }) };
    }
    let compoundKey = 'default';
    if (treatment === 'weight-loss') {
      compoundKey = (compound === 'tirzepatide' || compound === 'tirz') ? 'tirzepatide' : 'semaglutide';
    } else if (treatment === 'longevity') {
      // 'nad' / 'nad+' (legacy) or 'nad-plus' (catalog key the checkout picker sends)
      compoundKey = String(compound || '').toLowerCase().startsWith('nad') ? 'premium' : 'standard';
    } else if (treatment === 'sexual-wellness' || treatment === 'ed') {
      // olympus / olympus-plus / olympus-peak / olympus-max are the premium troches
      compoundKey = String(compound || '').toLowerCase().startsWith('olympus') ? 'premium' : 'standard';
    }
    const priceTier = PRICING[treatment][compoundKey] || PRICING[treatment]['default'];
    if (!priceTier) {
      return { statusCode: 400, headers, body: JSON.stringify({ approved: false, error: 'Invalid compound' }) };
    }
    const months = parseInt(plan_months);
    const monthlyPrice = priceTier[months];
    if (!monthlyPrice) {
      return { statusCode: 400, headers, body: JSON.stringify({ approved: false, error: 'Invalid plan duration' }) };
    }
    // Promo code (optional): re-derived here from pricing.json, never trusted
    // from the client. An unknown/retired code is rejected rather than silently
    // charged full price — the patient consented to the discounted total.
    let promo = null;
    if (body.promo_code) {
      promo = findPromo(body.promo_code);
      if (!promo) {
        return { statusCode: 400, headers, body: JSON.stringify({ approved: false, error: 'That promo code is no longer valid. Remove it and try again.' }) };
      }
    }
    const subtotalCents = Math.round(monthlyPrice * months * 100);
    const promoCents = discountCents(promo, subtotalCents);
    const amountStr = ((subtotalCents - promoCents) / 100).toFixed(2); // dollars, 2dp — Authorize.Net wants dollars not cents
    if (promo) console.log(`[AUTHNET] Promo ${promo.code}: -$${(promoCents / 100).toFixed(2)} on $${(subtotalCents / 100).toFixed(2)}`);
    const treatmentName = TREATMENT_NAMES[treatment] || treatment;

    // ── Build the Authorize.Net request ──
    // refId/invoiceNumber must be <= 20 chars. Use a short time-based ref.
    const refId = ('F' + Date.now().toString(36)).slice(0, 20);
    const description = `${treatmentName} - ${months}mo${promo ? ' (' + promo.code + ')' : ''}`.slice(0, 255);

    const authNetRequest = {
      createTransactionRequest: {
        merchantAuthentication: { name: API_LOGIN_ID, transactionKey: TRANSACTION_KEY },
        refId,
        transactionRequest: {
          transactionType: 'authCaptureTransaction',
          amount: amountStr,
          payment: {
            opaqueData: {
              dataDescriptor: String(opaqueData.dataDescriptor),
              dataValue: String(opaqueData.dataValue)
            }
          },
          order: { invoiceNumber: refId, description },
          ...(email ? { customer: { email } } : {}),
          billTo: {
            ...(firstName ? { firstName: firstName.slice(0, 50) } : {}),
            ...(lastName ? { lastName: lastName.slice(0, 50) } : {}),
            ...(zip ? { zip: zip.slice(0, 20) } : {}),
            country: 'US'
          }
        }
      }
    };

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authNetRequest)
    });

    // Authorize.Net's JSON API prepends a UTF-8 BOM that breaks JSON.parse.
    const raw = await resp.text();
    const clean = raw.replace(/^﻿/, '').trim();
    let result;
    try {
      result = JSON.parse(clean);
    } catch (parseErr) {
      console.error('[AUTHNET] Failed to parse response:', clean.slice(0, 300));
      return { statusCode: 502, headers, body: JSON.stringify({ approved: false, error: 'Payment processor returned an unexpected response. Please try again.' }) };
    }

    const txn = result.transactionResponse || {};
    const responseCode = txn.responseCode; // "1"=approved "2"=declined "3"=error "4"=held for review
    const apiResultOk = result.messages && result.messages.resultCode === 'Ok';

    // ── Approved ──
    if (apiResultOk && responseCode === '1') {
      const transactionId = txn.transId;
      console.log(`[AUTHNET] ✅ Approved | transId=${transactionId} | $${amountStr} | ${treatmentName} ${months}mo`);

      // Fire server-side conversion (Meta CAPI + GA4 MP) on success, the same
      // way stripeWebhook did. Non-blocking — never fail the charge over it.
      try {
        const attr = {};
        if (attribution && typeof attribution === 'object') {
          for (const [k, v] of Object.entries(attribution)) {
            if (typeof k === 'string' && k.startsWith('attr_') && v != null) attr[k] = String(v);
          }
        }
        const conversionResult = await fireConversion({
          totalValue: Number(amountStr),
          email: email || undefined,
          phone: (body.phone || '').trim() || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          ipAddress: event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'],
          userAgent: event.headers['user-agent'],
          eventId: 'authnet_' + transactionId, // idempotency key
          attribution: attr
        });
        console.log('[AUTHNET] Conversion dispatched:', JSON.stringify(conversionResult));
      } catch (convErr) {
        console.warn('[AUTHNET] Conversion firing failed (non-blocking):', convErr.message);
      }

      // Save the card as an Authorize.Net Customer Profile (CIM) so the Hub
      // can show "Visa ending in 1111" and future charges can reuse it. Accept.js
      // tokens are one-shot, so this is the ONLY moment the card can be kept.
      // Non-blocking: the charge already went through.
      const card = {
        brand: txn.accountType || null,
        last4: (txn.accountNumber || '').replace(/[^0-9]/g, '').slice(-4) || null,
        customerProfileId: null,
        paymentProfileId: null
      };
      try {
        const profile = await createCustomerProfileFromTransaction(endpoint, API_LOGIN_ID, TRANSACTION_KEY, transactionId, email);
        Object.assign(card, profile);
        console.log(`[AUTHNET] Customer profile ${card.customerProfileId ? 'saved: ' + card.customerProfileId : 'NOT saved'}`);
      } catch (cimErr) {
        console.warn('[AUTHNET] Customer profile save failed (non-blocking):', cimErr.message);
      }

      // Record the purchase in Supabase (funnel_orders). Non-blocking for the
      // same reason as the conversion above: the money already moved, and
      // Authorize.Net holds the authoritative transaction record regardless.
      try {
        const orderId = await saveFunnelOrder({
          leadId,
          planMonths: months,
          amountCents: Math.round(Number(amountStr) * 100),
          status: 'paid',
          gateway: 'authorize_net',
          gatewayTransactionId: String(transactionId),
          productName: `${treatmentName} - ${months}mo${promo ? ' (' + promo.code + ')' : ''}`,
          treatment,
          billing,
          card
        });
        if (orderId) console.log(`[AUTHNET] funnel_orders recorded: ${orderId}`);
        else console.warn(`[AUTHNET] ⚠️ funnel_orders NOT recorded for transId=${transactionId} — ops: reconcile manually from the Authorize.Net dashboard`);
      } catch (orderErr) {
        console.warn('[AUTHNET] funnel_orders save threw (non-blocking):', orderErr.message);
      }

      // Create (or link) the patient's Hub login and email them a magic
      // sign-in link — MDI onboarding creates only the MDI-side account, so
      // this is where the Freeley Hub account comes from. Non-blocking like
      // everything else after the charge.
      try {
        const hub = await ensureHubAccount(email);
        console.log('[AUTHNET] Hub magic link ' + (hub.sent ? 'sent' : 'NOT sent: ' + hub.reason));
      } catch (hubErr) {
        console.warn('[AUTHNET] Hub account creation failed (non-blocking):', hubErr.message);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          approved: true,
          transactionId,
          amount: amountStr,
          authCode: txn.authCode || null,
          accountLast4: (txn.accountNumber || '').replace(/[^0-9]/g, '').slice(-4) || null
        })
      };
    }

    // ── Held for review (4) — treat as accepted-pending so the patient isn't charged twice ──
    if (apiResultOk && responseCode === '4') {
      const transactionId = txn.transId;
      console.warn(`[AUTHNET] ⏳ Held for review | transId=${transactionId} | $${amountStr}`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ approved: true, held: true, transactionId, amount: amountStr })
      };
    }

    // ── Declined / error — surface a clean message ──
    const errText =
      (txn.errors && txn.errors[0] && txn.errors[0].errorText) ||
      (result.messages && result.messages.message && result.messages.message[0] && result.messages.message[0].text) ||
      'Your card was declined. Please check your details or try another card.';
    console.warn(`[AUTHNET] ❌ Declined/Error | code=${responseCode} | ${errText}`);
    return {
      statusCode: 200, // 200 + approved:false — a decline is a normal outcome, not an HTTP error
      headers,
      body: JSON.stringify({ approved: false, error: errText })
    };

  } catch (error) {
    console.error('[AUTHNET] Unexpected error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ approved: false, error: 'Unable to process payment. Please try again or contact support.' }) };
  }
};

/**
 * Turns a just-approved transaction into a stored CIM customer + payment
 * profile. Returns { customerProfileId, paymentProfileId } (nulls on failure).
 * Authorize.Net rejects a second profile for the same email (E00039) but names
 * the existing id in the message — reuse it and attach this card to it.
 */
async function createCustomerProfileFromTransaction(endpoint, loginId, transactionKey, transId, email) {
  const auth = { name: loginId, transactionKey };
  const post = async (payload) => {
    const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return JSON.parse((await r.text()).replace(/^﻿/, '').trim());
  };
  const res = await post({
    createCustomerProfileFromTransactionRequest: {
      merchantAuthentication: auth,
      transId: String(transId),
      customer: email ? { email } : undefined
    }
  });
  if (res.messages && res.messages.resultCode === 'Ok') {
    return {
      customerProfileId: res.customerProfileId || null,
      paymentProfileId: (res.customerPaymentProfileIdList && res.customerPaymentProfileIdList[0]) || null
    };
  }
  const msg = (res.messages && res.messages.message && res.messages.message[0]) || {};
  const dup = msg.code === 'E00039' && String(msg.text || '').match(/ID (\d+)/);
  if (!dup) throw new Error(`${msg.code || '?'}: ${msg.text || 'unknown'}`);
  const add = await post({
    createCustomerProfileFromTransactionRequest: {
      merchantAuthentication: auth,
      transId: String(transId),
      customerProfileId: dup[1]
    }
  });
  return {
    customerProfileId: dup[1],
    paymentProfileId: (add.customerPaymentProfileIdList && add.customerPaymentProfileIdList[0]) || null
  };
}
