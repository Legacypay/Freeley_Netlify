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
 *   email, firstName, lastName, phone, zip    // for billTo + conversion
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

// Single source of truth for pricing — shared with the frontend display.
const pricingData = require('../../pricing.json');
const { treatment_names: TREATMENT_NAMES, _meta, ...categories } = pricingData;
const PRICING = categories;

// Authorize.Net endpoints. Production credentials → api.authorize.net.
// (A separate sandbox account would use apitest.authorize.net.)
const ENDPOINTS = {
  production: 'https://api.authorize.net/xml/v1/request.api',
  sandbox: 'https://apitest.authorize.net/xml/v1/request.api'
};

exports.handler = async (event) => {
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
      compoundKey = (compound === 'nad' || compound === 'nad+') ? 'premium' : 'standard';
    } else if (treatment === 'sexual-wellness' || treatment === 'ed') {
      const premiumCompounds = ['olympus', 'olympus-plus', 'olympus-peak', 'olympus-max'];
      compoundKey = premiumCompounds.includes(String(compound || '').toLowerCase()) ? 'premium' : 'standard';
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
    const amountStr = (monthlyPrice * months).toFixed(2); // dollars, 2dp — Authorize.Net wants dollars not cents
    const treatmentName = TREATMENT_NAMES[treatment] || treatment;

    // ── Build the Authorize.Net request ──
    // refId/invoiceNumber must be <= 20 chars. Use a short time-based ref.
    const refId = ('F' + Date.now().toString(36)).slice(0, 20);
    const description = `${treatmentName} - ${months}mo`.slice(0, 255);

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
