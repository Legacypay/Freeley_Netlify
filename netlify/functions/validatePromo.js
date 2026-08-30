/**
 * Netlify Function: validatePromo
 * POST { code, subtotal_cents? } → { valid, code, type, value, label, discount_cents }
 * Read-only preview for the checkout; the charge re-derives everything from
 * pricing.json in create-authnet-transaction.js, so nothing here is trusted.
 */
const { CORS_HEADERS } = require('./lib/mdi-client');
const { allow } = require('./lib/rate-limit');
const { findPromo, discountCents } = require('./lib/promos');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  // 20/min/IP — enough for typos, too slow to enumerate codes.
  if (!(await allow(event, { key: 'validate-promo', limit: 20, windowSec: 60 }))) {
    return { statusCode: 429, headers: CORS_HEADERS, body: JSON.stringify({ valid: false, error: 'Too many attempts. Please wait a moment.' }) };
  }
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* ignore */ }
  const promo = findPromo(body.code);
  if (!promo) return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ valid: false, error: 'That promo code is not valid.' }) };
  const subtotal = Math.max(0, parseInt(body.subtotal_cents, 10) || 0);
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ valid: true, ...promo, discount_cents: subtotal ? discountCents(promo, subtotal) : null })
  };
};
