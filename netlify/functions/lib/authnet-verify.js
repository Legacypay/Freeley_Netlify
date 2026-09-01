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
 * Fail-closed whenever Authorize.Net ANSWERS, fail-open only when it doesn't:
 *   - transaction missing / declined / voided / refunded → { ok: false }
 *   - any gateway Error (bad credentials E00007, Transaction Details API not
 *     enabled E00011, …)                                → { ok: false }
 *   - Authorize.Net unreachable or returning garbage   → { ok: true, unverified: true }
 *     (an attacker cannot make Authorize.Net go down; a paying patient must not
 *     be blocked by a network hiccup — the warning is loud in the logs)
 *   The Transaction Details API must be enabled on the merchant account
 *   (Merchant Interface → Account → Security Settings). Verified enabled on
 *   PRODUCTION on 2026-09-01 (unknown id → E00040); NOT enabled on the sandbox
 *   account, so sandbox intake is refused until it is turned on there too.
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
      // E00007 = auth failed: wrong credentials OR the Transaction Details API
      // is disabled on this merchant account. Either way we CANNOT verify, and
      // failing open here would let forged transaction ids through (that is
      // exactly what a 2026-09-01 smoke test showed against sandbox). Charges
      // use the same credentials, so a real credential problem already breaks
      // checkout — refusing here costs no legitimate patient anything.
      if (msg.code === 'E00007') {
        console.error('[AUTHNET VERIFY] E00007 — credentials rejected. Refusing intake until fixed.');
        return { ok: false, reason: 'gateway-auth-failed' };
      }
      // Any other gateway-level Error (e.g. E00011 "Access denied … Transaction
      // Details API" when that API is disabled on the account) also means we
      // could not confirm the charge. Authorize.Net answered, so this is not an
      // outage — fail CLOSED. A 2026-09-01 smoke test showed the sandbox account
      // answering this way and forged ids slipping through the old fail-open.
      console.error('[AUTHNET VERIFY] gateway refused verification: ' + (msg.code || '?') + ' ' + (msg.text || '') + ' — refusing intake. If this is E00011, enable Merchant Interface → Account → Security Settings → Transaction Details API.');
      return { ok: false, reason: (msg.code || '?') + ': ' + (msg.text || 'unknown') };
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
