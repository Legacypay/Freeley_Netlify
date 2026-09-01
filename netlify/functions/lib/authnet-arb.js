/**
 * Authorize.Net ARB (Automated Recurring Billing) helpers.
 *
 * Request shape verified 2026-09-02 against the OFFICIAL schema
 * (https://api.authorize.net/xml/v1/schema/AnetApiSchema.xsd) and the ARB
 * reference (developer.authorize.net/api/reference/features/recurring-billing.html):
 *
 *   - The ONLY create request is `ARBCreateSubscriptionRequest`. A subscription
 *     built on a saved card is that same request with `subscription.profile`
 *     ({ customerProfileId, customerPaymentProfileId }) instead of
 *     `subscription.payment`. (An earlier version of this file used a
 *     `ARBCreateSubscriptionFromCustomerProfileRequest` root element — that
 *     element does not exist in the XSD, so every call would have been
 *     rejected with E00003 and no subscription would ever have been created.)
 *   - Authorize.Net's JSON endpoint is a thin wrapper over the XML one and is
 *     ORDER-SENSITIVE: keys must appear in schema order or the request fails
 *     with E00003. ARBSubscriptionType order is
 *     name, paymentSchedule, amount, trialAmount, payment, order, customer,
 *     billTo, shipTo, profile — buildCreateSubscriptionBody() below emits keys
 *     in exactly that order, and the unit test pins it.
 *   - When `profile` is used, the card AND its billing name/address come from
 *     the saved payment profile, so `payment`/`billTo`/`customer` are not sent.
 *   - Interval limits (business rule, not in the XSD): unit=months → 1..12,
 *     unit=days → 7..365. A 24-month plan therefore CANNOT be expressed as an
 *     ARB interval at all (730 days is also out of range). See
 *     ARB_MAX_INTERVAL_MONTHS + createArbSubscriptionFromProfile's early return.
 *   - Payments run "after 2 a.m. PST" on each scheduled date. A monthly
 *     schedule that starts on the 31st bills on the last day of shorter
 *     months (Authorize.Net handles that itself) — but the start date WE send
 *     must be a real calendar date, hence the end-of-month clamp in
 *     nextCycleStartDate() (JS Date would otherwise roll Jan 31 + 1 month
 *     over into March 3).
 *   - totalOccurrences 9999 = Authorize.Net's documented sentinel for an
 *     open-ended subscription (no end date; cancel explicitly).
 *
 * Environment status (read-only checks, no charge):
 *   - Recurring Billing IS enabled on the production merchant account.
 *   - Recurring Billing is NOT enabled on the developer sandbox account used
 *     for testing (ARBGetSubscriptionListRequest → E00007 while the same
 *     credentials pass authenticateTestRequest; re-confirmed 2026-09-02).
 *     Turn it on at sandbox.authorize.net (Account → Recurring Billing) to
 *     exercise this end-to-end before trusting it at volume.
 *
 * Deliberately built FROM the Customer Profile create-authnet-transaction.js
 * already stores after every approved charge (proven code, reused as-is):
 *   - An Accept.js opaque-data token is one-shot; the Customer Profile is
 *     Authorize.Net's own long-lived reference to the card.
 *   - The subscription's OWN first scheduled payment is the SECOND
 *     installment (startDate = today + one interval). TODAY's payment is the
 *     ordinary one-time charge, unchanged — so a failure here never affects
 *     money that already moved, and the patient is never double-charged for
 *     the first cycle.
 */

const { resolveAuthnetConfig } = require('./authnet-config');

/** Authorize.Net business rule: a months-based interval is 1..12 months. */
const ARB_MAX_INTERVAL_MONTHS = 12;

/** Authorize.Net's documented sentinel for "no end date". */
const ARB_NO_END_DATE = 9999;

/**
 * The renewal date for a plan: `from` + `intervalMonths` calendar months, as
 * YYYY-MM-DD (UTC). Day-of-month is clamped to the target month's last day
 * (Jan 31 + 1 → Feb 28/29, not Mar 3). Authorize.Net then keeps billing on
 * the last day of every shorter month by itself.
 */
function nextCycleStartDate(intervalMonths, from = new Date()) {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + intervalMonths;
  const lastDayOfTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const d = Math.min(from.getUTCDate(), lastDayOfTarget);
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

/**
 * Pure builder for the create request — exported so the unit test can pin the
 * exact element names and their order without any network.
 */
function buildCreateSubscriptionBody({ apiLoginId, transactionKey, refId, customerProfileId, customerPaymentProfileId, intervalMonths, startDate, amount, planLabel }) {
  return {
    ARBCreateSubscriptionRequest: {
      // ANetApiRequest order: merchantAuthentication, (clientId), refId
      merchantAuthentication: { name: apiLoginId, transactionKey },
      refId: String(refId).slice(0, 50),
      // ARBSubscriptionType order: name, paymentSchedule, amount, [trialAmount],
      // [payment], order, [customer], [billTo], [shipTo], profile
      subscription: {
        name: ('Freeley - ' + planLabel).slice(0, 50),
        paymentSchedule: {
          // paymentScheduleType order: interval, startDate, totalOccurrences, [trialOccurrences]
          interval: { length: intervalMonths, unit: 'months' },
          startDate,
          totalOccurrences: ARB_NO_END_DATE
        },
        amount: Number(Number(amount).toFixed(2)),
        order: { description: String(planLabel).slice(0, 255) },
        profile: {
          customerProfileId: String(customerProfileId),
          customerPaymentProfileId: String(customerPaymentProfileId)
        }
      }
    }
  };
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

function firstMessage(json) {
  return (json && json.messages && json.messages.message && json.messages.message[0]) || {};
}

/**
 * Create the recurring schedule for a plan, from an already-created CIM
 * profile. NEVER throws — always returns a result object; callers must treat
 * this as best-effort and never fail/reverse the payment that already
 * succeeded because this step didn't.
 *
 * `amount` is what EVERY renewal charges — pass the full plan price, never a
 * first-order-promo-discounted figure (checkout discloses the full price as
 * the renewal amount).
 *
 * @param {{ customerProfileId: string, customerPaymentProfileId: string, intervalMonths: number, amount: number, planLabel: string }} args
 * @returns {Promise<{ created: boolean, subscriptionId?: string, startDate?: string, reason?: string }>}
 */
async function createArbSubscriptionFromProfile({ customerProfileId, customerPaymentProfileId, intervalMonths, amount, planLabel }) {
  if (!customerProfileId || !customerPaymentProfileId) {
    return { created: false, reason: 'no-cim-profile' };
  }
  const months = Number(intervalMonths);
  if (!Number.isInteger(months) || months < 1) {
    return { created: false, reason: 'invalid-interval: ' + intervalMonths };
  }
  if (months > ARB_MAX_INTERVAL_MONTHS) {
    // Not a transient failure — Authorize.Net cannot schedule this cadence.
    return { created: false, reason: 'interval-exceeds-arb-max: ' + months + ' months (ARB allows 1-' + ARB_MAX_INTERVAL_MONTHS + ')' };
  }
  const renewalAmount = Number(amount);
  if (!(renewalAmount >= 0.01)) {
    return { created: false, reason: 'invalid-amount: ' + amount };
  }
  try {
    const c = resolveAuthnetConfig();
    const startDate = nextCycleStartDate(months);
    const body = buildCreateSubscriptionBody({
      apiLoginId: c.apiLoginId,
      transactionKey: c.transactionKey,
      refId: 'sub-' + Date.now(),
      customerProfileId,
      customerPaymentProfileId,
      intervalMonths: months,
      startDate,
      amount: renewalAmount,
      planLabel
    });
    const { json } = await arbRequest(body);
    const ok = json.messages && json.messages.resultCode === 'Ok' && json.subscriptionId;
    if (!ok) {
      const msg = firstMessage(json);
      console.warn('[AUTHNET ARB] Create subscription failed: ' + (msg.code || '?') + ' ' + (msg.text || JSON.stringify(json).slice(0, 200)));
      return { created: false, reason: (msg.code || '?') + ': ' + (msg.text || 'unknown') };
    }
    console.log('[AUTHNET ARB] Subscription created: ' + json.subscriptionId + ' | ' + planLabel + ' | every ' + months + 'mo | $' + renewalAmount.toFixed(2) + ' | first renewal ' + startDate);
    return { created: true, subscriptionId: String(json.subscriptionId), startDate };
  } catch (e) {
    console.warn('[AUTHNET ARB] Create subscription threw (non-blocking):', e.message);
    return { created: false, reason: e.message };
  }
}

/**
 * Cancel an existing subscription. Used by cancelSubscription.js, which is
 * responsible for verifying the caller actually owns this subscription
 * BEFORE calling this — this function itself has no ownership concept.
 * @returns {Promise<{ canceled: boolean, reason?: string }>}
 */
async function cancelArbSubscription(subscriptionId) {
  if (!subscriptionId) return { canceled: false, reason: 'no-subscription-id' };
  try {
    const c = resolveAuthnetConfig();
    const { json } = await arbRequest({
      ARBCancelSubscriptionRequest: {
        merchantAuthentication: { name: c.apiLoginId, transactionKey: c.transactionKey },
        refId: ('cancel-' + Date.now()).slice(0, 50),
        subscriptionId: String(subscriptionId)
      }
    });
    const ok = json.messages && json.messages.resultCode === 'Ok';
    if (!ok) {
      const msg = firstMessage(json);
      return { canceled: false, reason: (msg.code || '?') + ': ' + (msg.text || 'unknown') };
    }
    return { canceled: true };
  } catch (e) {
    return { canceled: false, reason: e.message };
  }
}

module.exports = {
  ARB_MAX_INTERVAL_MONTHS,
  ARB_NO_END_DATE,
  buildCreateSubscriptionBody,
  createArbSubscriptionFromProfile,
  cancelArbSubscription,
  nextCycleStartDate
};
