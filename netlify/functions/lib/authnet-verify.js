/**
 * Server-side proof of payment for the intake path.
 *
 * submitQuiz.js and savePendingCase.js are unauthenticated by design (the
 * patient has no Hub login yet) and create REAL, billable MDI encounters. The
 * only thing tying a submission to money is `payment.transaction_id`, which the
 * browser sends — so before creating anything we ask Authorize.Net whether that
 * transaction exists on OUR merchant account and was approved
 * (getTransactionDetailsRequest — read-only, no charge).
 *
 * Fail-closed on validity, fail-open on availability:
 *   - transaction missing / declined / voided / refunded → { ok: false }
 *   - Authorize.Net unreachable or returning garbage   → { ok: true, unverified: true }
 *     (an attacker cannot make Authorize.Net go down; a paying patient must not
 *     be blocked by a gateway hiccup — the warning is loud in the logs)
 *   - 'SIM-…' ids are accepted only while AUTHNET_SIMULATE is actually in effect.
 */

const { resolveAuthnetConfig } = require('./authnet-config');

// Statuses that mean "money was approved and not reversed". Everything else
// (declined, voided, refundSettledSuccessfully, expired, generalError, …) is a no.
const APPROVED_STATUSES = new Set([
  'authorizedPendingCapture',
  'capturedPendingSettlement',
  'settledSuccessfully',
  'FDSPendingReview',
  'FDSAuthorizedPendingReview',
  'underReview'
]);

/**
 * @param {string} transactionId  what the browser put in payment.transaction_id
 * @param {object} [opts]
 * @param {function} [opts.fetchImpl] test seam
 * @returns {Promise<{ ok: boolean, reason?: string, unverified?: boolean, amount?: number, status?: string }>}
 */
async function verifyAuthnetTransaction(transactionId, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const id = String(transactionId || '').trim();
  if (!id) return { ok: false, reason: 'missing-transaction-id' };

  const cfg = resolveAuthnetConfig();
  if (/^SIM-\d+$/.test(id)) {
    return cfg.simulate ? { ok: true, status: 'simulated', amount: null } : { ok: false, reason: 'simulated-id-outside-simulate-mode' };
  }
  if (!/^\d{5,20}$/.test(id)) return { ok: false, reason: 'malformed-transaction-id' };
  if (!cfg.apiLoginId || !cfg.transactionKey) return { ok: true, unverified: true, reason: 'gateway-not-configured' };

  try {
    const res = await fetchImpl(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        getTransactionDetailsRequest: {
          merchantAuthentication: { name: cfg.apiLoginId, transactionKey: cfg.transactionKey },
          transId: id
        }
      })
    });
    const raw = await res.text();
    let json;
    try { json = JSON.parse(raw.replace(/^﻿/, '').trim()); } catch {
      console.warn('[AUTHNET VERIFY] non-JSON response — proceeding unverified');
      return { ok: true, unverified: true, reason: 'non-json-response' };
    }
    const msg = (json.messages && json.messages.message && json.messages.message[0]) || {};
    if (!json.messages || json.messages.resultCode !== 'Ok') {
      // E00040 = "The record cannot be found" → definitively not ours / not real.
      if (msg.code === 'E00040') return { ok: false, reason: 'transaction-not-found' };
      console.warn('[AUTHNET VERIFY] gateway error ' + (msg.code || '?') + ' ' + (msg.text || '') + ' — proceeding unverified');
      return { ok: true, unverified: true, reason: (msg.code || '?') + ': ' + (msg.text || 'unknown') };
    }
    const t = json.transaction || {};
    const status = String(t.transactionStatus || '');
    if (!APPROVED_STATUSES.has(status)) return { ok: false, reason: 'status:' + (status || 'unknown'), status };
    return { ok: true, status, amount: t.authAmount != null ? Number(t.authAmount) : (t.settleAmount != null ? Number(t.settleAmount) : null) };
  } catch (e) {
    console.warn('[AUTHNET VERIFY] request threw — proceeding unverified:', e.message);
    return { ok: true, unverified: true, reason: e.message };
  }
}

module.exports = { verifyAuthnetTransaction, APPROVED_STATUSES };
