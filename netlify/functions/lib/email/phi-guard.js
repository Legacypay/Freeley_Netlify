/**
 * Defense-in-depth check: a patient-facing email about the clinical
 * lifecycle (order status, case status, "you have a new message") must
 * never name a specific medication, dose, or diagnosis — that's PHI, and
 * this codebase's whole design keeps it inside MDI, never in an email (see
 * mdiWebhook.js's `sendPatientEmail` comments). Every such template is
 * written to say "your treatment"/"your order" — this catches a future
 * regression (someone interpolating a product name into a template) before
 * it ever reaches Resend.
 *
 * The term list is derived from lib/products.js itself so it can't drift
 * out of sync with the real catalog — adding a new compound automatically
 * extends the guard.
 *
 * Log-and-refuse, never throw: engine.js checks the boolean return and
 * skips the send. A false positive here must never crash a webhook
 * handler mid-processing — worst case, one email is skipped and logged.
 */
const { PRODUCTS } = require('../products');

// Generic words that happen to appear inside product names/formulas but
// carry no PHI meaning on their own — excluded so they don't cause false
// positives in ordinary marketing/support copy.
const EXCLUDE_TERMS = new Set([
  'freeley', 'health', 'strive', 'pharmacy', 'initial', 'medical', 'form',
  'inject', 'injection', 'oral', 'nasal', 'spray', 'tablet', 'weekly',
  'daily', 'troche', 'new', 'refill',
  // Generic English words that happen to sit inside a product's display
  // name (e.g. "Tadalafil (As Needed)") but carry no PHI meaning by
  // themselves — excluded so ordinary marketing copy doesn't trip the guard.
  'needed', 'growth', 'women', 'therapy'
]);

function buildDrugTerms() {
  const terms = new Set();
  for (const product of Object.values(PRODUCTS)) {
    for (const field of [product.name, product.mdi_offering_name, product.formula]) {
      if (!field) continue;
      for (const token of String(field).toLowerCase().match(/[a-z]{5,}/g) || []) {
        if (!EXCLUDE_TERMS.has(token)) terms.add(token);
      }
    }
  }
  return terms;
}

// Built once per cold start — PRODUCTS is a static require, not per-request data.
const DRUG_TERMS = buildDrugTerms();

// "0.2mg", "5 mg", "1mL", "4 units" — dosing language has no place in an email.
const DOSE_PATTERN = /\b\d+(\.\d+)?\s?(mg|mcg|ml|iu|units?)\b/i;

/** @returns {string[]} the offending terms found, empty if clean */
function findPhi(html) {
  const lower = String(html || '').toLowerCase();
  const hits = [];
  for (const term of DRUG_TERMS) {
    if (lower.includes(term)) hits.push(term);
  }
  if (DOSE_PATTERN.test(lower)) hits.push('dose-pattern');
  return hits;
}

/** @returns {boolean} true if safe to send */
function assertNoPhi(html, templateName) {
  const hits = findPhi(html);
  if (hits.length) {
    console.error(`[EMAIL PHI GUARD] Template "${templateName}" looks like it contains PHI, refusing to send: ${hits.slice(0, 5).join(', ')}`);
    return false;
  }
  return true;
}

module.exports = { assertNoPhi, findPhi };
