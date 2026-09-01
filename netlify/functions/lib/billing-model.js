/**
 * Per-product billing model — "subscription" (auto-renews via Authorize.Net
 * ARB at the plan's own cadence) or "one-time" (charged once for the full
 * term). Driven entirely by pricing.json's `billing` block so the client's
 * list of one-time products is a JSON edit, not a code change.
 *
 * Resolution order (first match wins):
 *   1. `treatment:compound` in `one_time` / `subscription`
 *   2. `treatment` in `one_time` / `subscription`
 *   3. `_default`
 *
 * `compound` is normalized to the key checkout sends (see normalizeCompound)
 * so "semaglutide"/"sema", "tirzepatide"/"tirz", "olympus-max"/"olympus",
 * "nad"/"nad+"/"nad-plus" all resolve to the same product entry.
 *
 * src/pages/checkout.astro mirrors this logic client-side for the copy it
 * shows (plan cards, button, consent clause); the SERVER decides whether a
 * subscription is actually created.
 */

const SUBSCRIPTION = 'subscription';
const ONE_TIME = 'one-time';

function normalizeCompound(compound) {
  const c = String(compound || '').trim().toLowerCase();
  if (!c) return '';
  if (c === 'semaglutide' || c === 'sema') return 'sema';
  if (c === 'tirzepatide' || c === 'tirz') return 'tirz';
  if (c.startsWith('olympus')) return 'olympus';
  if (c.startsWith('nad')) return 'nad-plus';
  return c;
}

/**
 * @param {string} treatment  pricing.json vertical key (weight-loss, hair-loss, …)
 * @param {string} [compound] catalog key / alias the checkout sent
 * @param {object} [pricing]  pricing.json contents (injectable for tests)
 * @returns {'subscription'|'one-time'}
 */
function billingModelFor(treatment, compound, pricing = require('../../../pricing.json')) {
  const cfg = (pricing && pricing.billing) || {};
  const oneTime = new Set(Array.isArray(cfg.one_time) ? cfg.one_time : []);
  const subs = new Set(Array.isArray(cfg.subscription) ? cfg.subscription : []);
  const t = String(treatment || '').trim().toLowerCase();
  const c = normalizeCompound(compound);
  const candidates = c ? [`${t}:${c}`, t] : [t];
  for (const id of candidates) {
    if (oneTime.has(id)) return ONE_TIME;
    if (subs.has(id)) return SUBSCRIPTION;
  }
  return cfg._default === ONE_TIME ? ONE_TIME : SUBSCRIPTION;
}

module.exports = { billingModelFor, normalizeCompound, SUBSCRIPTION, ONE_TIME };
