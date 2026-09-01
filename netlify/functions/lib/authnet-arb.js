/**
 * Authorize.Net ARB (Automated Recurring Billing) helpers.
 *
 * Confirmed 2026-09-02 (read-only checks, no charge):
 *   - Recurring Billing IS enabled on the production merchant account
 *     (ARBGetSubscriptionListRequest returned 200/Ok).
 *   - Recurring Billing is NOT enabled on the developer sandbox account used
 *     for testing (same request → E00007, the same code Authorize.Net
 *     returns for "auth failed" — a known sandbox quirk for a disabled
 *     feature, not a credentials problem: authenticateTestRequest against
 *     the same sandbox credentials succeeds fine). ARB cannot be exercised
 *     in sandbox until Recurring Billing is turned on there too
 *     (sandbox.authorize.net dashboard — separate from production, and
 *     outside what an API credential can toggle).
 *   - The exact ARBCreateSubscriptionRequest JSON schema below was NOT
 *     re-verified against a live sandbox response (blocked by the above);
 *     it follows Authorize.Net's long-stable, publicly documented ARB shape.
 *     Confirm the very first real subscription end-to-end (see
 *     docs/AUTHORIZE_NET_SETUP.md's go-live checklist) before relying on it
 *     at volume — the go-live "one real low-value transaction" step already
 *     covers a one-time charge; do the same once for a subscription plan.
 *
 * Deliberately built FROM a Customer Profile rather than passing opaqueData
 * straight into ARBCreateSubscriptionRequest:
 *   - This repo already creates a CIM customer + payment profile from every
 *     approved charge (create-authnet-transaction.js's
 *     createCustomerProfileFromTransaction) — proven, already-tested code,
 *     reused as-is here rather than introduced a second time.
 *   - An Accept.js opaque-data token is one-shot and short-lived; the
 *     Customer Profile is Authorize.Net's own long-lived reference to the
 *     card, which is what a recurring schedule should be built on.
 *   - The subscription's OWN first scheduled payment is the SECOND
 *     installment (startDate = today + one interval) — the FIRST payment is
 *     the ordinary one-time charge create-authnet-transaction.js already
 *     makes today, unchanged. This means a failure creating the ARB
 *     schedule never affects the payment that already succeeded, and the
 *     patient is never double-charged for "today".
 */

const { resolveAuthnetConfig } = require('./authnet-config');

function nextCycleStartDate(intervalMonths) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + intervalMonths);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD, what ARB expects
}

async function arbRequest(body) {
  const authnet = resolveAuthnetConfig();
  const res = await fetch(authnet.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const raw = await res.text();
  const clean = raw.replace(/^﻿/, '').trim();
  let json;
  try { json = JSON.parse(clean); } catch (e) {
    throw new Error('ARB: non-JSON response: ' + clean.slice(0, 300));
  }
  return { authnet, json };
}

/**
 * Create the recurring schedule for a plan, from an already-created CIM
 * profile. NEVER throws — always returns a result object; callers must
 * treat this as best-effort and never fail/reverse the payment that already
 * succeeded because this step didn't.
 *
 * @param {{ customerProfileId: string, customerPaymentProfileId: string, intervalMonths: number, amount: number, planLabel: string, firstName?: string, lastName?: string, email?: string }} args
 * @returns {Promise<{ created: boolean, subscriptionId?: string, reason?: string }>}
 */
async function createArbSubscriptionFromProfile({ customerProfileId, customerPaymentProfileId, intervalMonths, amount, planLabel, firstName, lastName, email }) {
  if (!customerProfileId || !customerPaymentProfileId) {
    return { created: false, reason: 'no-cim-profile' };
  }
  try {
    const { name, transactionKey } = (() => { const c = resolveAuthnetConfig(); return { name: c.apiLoginId, transactionKey: c.transactionKey }; })();
    const body = {
      ARBCreateSubscriptionFromCustomerProfileRequest: {
        merchantAuthentication: { name, transactionKey },
        refId: ('sub-' + Date.now()).slice(0, 20),
        subscription: {
          name: ('Freeley - ' + planLabel).slice(0, 50),
          paymentSchedule: {
            interval: { length: intervalMonths, unit: 'months' },
            startDate: nextCycleStartDate(intervalMonths),
            totalOccurrences: 9999 // Authorize.Net's documented sentinel for "no end date" — cancel explicitly, never expires on its own.
          },
          amount: Number(amount.toFixed(2)),
          profile: {
            customerProfileId: String(customerProfileId),
            customerPaymentProfileId: String(customerPaymentProfileId)
          },
          ...(firstName || lastName ? { billTo: { firstName: firstName || '', lastName: lastName || '' } } : {}),
          ...(email ? { customer: { email } } : {})
        }
      }
    };
    const { json } = await arbRequest(body);
    const ok = json.messages && json.messages.resultCode === 'Ok';
    if (!ok) {
      const msg = (json.messages && json.messages.message && json.messages.message[0]) || {};
      console.warn('[AUTHNET ARB] Create subscription failed: ' + (msg.code || '?') + ' ' + (msg.text || JSON.stringify(json).slice(0, 200)));
      return { created: false, reason: (msg.code || '?') + ': ' + (msg.text || 'unknown') };
    }
    console.log('[AUTHNET ARB] Subscription created: ' + json.subscriptionId + ' | ' + planLabel + ' | every ' + intervalMonths + 'mo | $' + amount + ' | next charge ' + nextCycleStartDate(intervalMonths));
    return { created: true, subscriptionId: json.subscriptionId };
  } catch (e) {
    console.warn('[AUTHNET ARB] Create subscription threw (non-blocking):', e.message);
    return { created: false, reason: e.message };
  }
}

/**
 * Cancel an existing subscription. Used by cancelSubscription.js, which is
 * responsible for verifying the caller actually owns this subscription
 * BEFORE calling this — this function itself has no ownership concept, it
 * just executes the cancel against Authorize.Net once told to.
 * @returns {Promise<{ canceled: boolean, reason?: string }>}
 */
async function cancelArbSubscription(subscriptionId) {
  if (!subscriptionId) return { canceled: false, reason: 'no-subscription-id' };
  try {
    const c = resolveAuthnetConfig();
    const { json } = await arbRequest({
      ARBCancelSubscriptionRequest: {
        merchantAuthentication: { name: c.apiLoginId, transactionKey: c.transactionKey },
        subscriptionId: String(subscriptionId)
      }
    });
    const ok = json.messages && json.messages.resultCode === 'Ok';
    if (!ok) {
      const msg = (json.messages && json.messages.message && json.messages.message[0]) || {};
      return { canceled: false, reason: (msg.code || '?') + ': ' + (msg.text || 'unknown') };
    }
    return { canceled: true };
  } catch (e) {
    return { canceled: false, reason: e.message };
  }
}

module.exports = { createArbSubscriptionFromProfile, cancelArbSubscription, nextCycleStartDate };
