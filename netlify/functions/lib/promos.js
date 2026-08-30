/**
 * Promo codes — single source of truth is pricing.json → "promos".
 * Used by validatePromo.js (checkout preview) and create-authnet-transaction.js
 * (the actual charge), so the discount the patient SEES is the one charged.
 */
const { promos = {} } = require('../../../pricing.json');

function normalize(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
}

/** @returns {{code,type,value,label}|null} */
function findPromo(code) {
  const key = normalize(code);
  const promo = key && promos[key];
  if (!promo || promo.active === false) return null;
  if (!['percent', 'amount'].includes(promo.type) || !(Number(promo.value) > 0)) return null;
  return { code: key, type: promo.type, value: Number(promo.value), label: promo.label || key };
}

/**
 * Discount in cents for a subtotal in cents. Never discounts below $1
 * (funnel_orders.amount_cents > 0 and Authorize.Net both reject $0).
 */
function discountCents(promo, subtotalCents) {
  if (!promo) return 0;
  const raw = promo.type === 'percent'
    ? Math.round(subtotalCents * promo.value / 100)
    : Math.round(promo.value * 100);
  return Math.max(0, Math.min(raw, subtotalCents - 100));
}

module.exports = { findPromo, discountCents, normalize };
