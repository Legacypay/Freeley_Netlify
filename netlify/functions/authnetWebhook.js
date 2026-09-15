/**
 * Authorize.Net Webhook Handler — Netlify Serverless Function
 *
 * create-authnet-transaction.js's charge is SYNCHRONOUS — approved/declined
 * comes back in the same HTTP response, unlike Stripe's async PaymentIntent
 * flow. So this webhook is NOT needed to know "did the charge go through" —
 * that's already handled. It exists for the things the synchronous response
 * can't tell us, all of which happen *after* the initial charge:
 *
 *   - net.authorize.payment.fraud.approved / .declined
 *       A transaction held for manual review (responseCode 4 — see
 *       create-authnet-transaction.js) gets its real outcome ONLY here.
 *       Right now that case is treated as "approved, pending" with no way
 *       to ever learn if it was actually approved or declined — this closes
 *       that gap.
 *   - net.authorize.payment.refund.created / .void.created
 *       Refunds/voids issued from the Merchant Interface dashboard directly
 *       (not through our site) — we'd otherwise never hear about them.
 *
 * Register this URL in the Merchant Interface: Account > Settings >
 * Security Settings > Webhooks:
 *   https://freeley.com/.netlify/functions/authnetWebhook
 * Subscribe to: net.authorize.payment.fraud.approved,
 *   net.authorize.payment.fraud.declined, net.authorize.payment.refund.created,
 *   net.authorize.payment.void.created
 * (Repeat for the sandbox Merchant Interface, pointed at a deploy preview
 * URL, when testing — sandbox and production webhooks are registered
 * separately, same as the API credentials.)
 *
 * Required env var: AUTHNET_SIGNATURE_KEY (hex string from Account >
 * Settings > Security Settings > API Credentials & Keys > Signature Key —
 * NOT the Transaction Key). Generate one per environment (sandbox/production).
 *
 * Signature spec (X-ANET-Signature header, "sha512=<HEX>"): HMAC-SHA512 of
 * the raw request body, keyed by the Signature Key HEX-DECODED to bytes
 * (confirmed against Authorize.Net's own compute_trans_hashSHA2.js sample —
 * same convention as the legacy SIM/DPM x_SHA2_Hash), output as uppercase
 * hex. Compared case-insensitively here as a safety margin.
 *
 * POST /.netlify/functions/authnetWebhook
 */

const crypto = require('crypto');
const { connectBlobs } = require('./lib/blobs');
const { resolveAuthnetConfig } = require('./lib/authnet-config');
const { sendTransactional, enrollJourney, cancelJourney, getSubscription } = require('./lib/email/engine');

exports.handler = async (event) => {
  connectBlobs(event);
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // Per-environment Signature Key (AUTHNET_SANDBOX_/AUTHNET_LIVE_SIGNATURE_KEY,
  // falling back to AUTHNET_SIGNATURE_KEY) — see lib/authnet-config.js.
  const signatureKey = resolveAuthnetConfig().signatureKey;
  if (!signatureKey) {
    console.error('[AUTHNET WEBHOOK] CRITICAL: Authorize.Net Signature Key not set — rejecting all webhooks');
    return { statusCode: 500, body: JSON.stringify({ error: 'Webhook secret not configured' }) };
  }

  const rawBody = event.body || '';
  const sigHeader = event.headers['x-anet-signature'] || event.headers['X-ANET-Signature'] || '';
  const providedSig = sigHeader.replace(/^sha512=/i, '').trim().toLowerCase();

  let validSig = false;
  try {
    const expected = crypto
      .createHmac('sha512', Buffer.from(signatureKey, 'hex'))
      .update(rawBody, 'utf8')
      .digest('hex')
      .toLowerCase();
    validSig =
      providedSig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(providedSig, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch (e) {
    console.error('[AUTHNET WEBHOOK] Signature computation error:', e.message);
    validSig = false;
  }

  if (!validSig) {
    console.error('[AUTHNET WEBHOOK] Invalid signature — rejecting request');
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid webhook signature' }) };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const eventType = payload.eventType;
  const data = payload.payload || {};
  console.log(`[AUTHNET WEBHOOK] Event: ${eventType} | id: ${data.id || 'N/A'} | notificationId: ${payload.notificationId || 'N/A'}`);

  try {
    switch (eventType) {

      // ── A held-for-review transaction was resolved ──────────────
      case 'net.authorize.payment.fraud.approved': {
        console.log(`[AUTHNET WEBHOOK] ✅ Held transaction approved on review: transId=${data.id}`);
        await notifyInternal('fraud_hold_approved', {
          transaction_id: data.id,
          amount: data.authAmount,
          action: 'confirm_order'
        });
        break;
      }
      case 'net.authorize.payment.fraud.declined': {
        console.error(`[AUTHNET WEBHOOK] ❌ Held transaction declined on review: transId=${data.id}`);
        await notifyInternal('fraud_hold_declined', {
          transaction_id: data.id,
          amount: data.authAmount,
          action: 'URGENT_alert_team_and_notify_patient'
        });
        try {
          const { email, firstName } = await lookupTransactionContact(data.id);
          if (email) {
            await sendTransactional({
              template: 'payment-failed',
              to: email,
              data: { firstName },
              dedupeKey: 'payfail:' + data.id,
              kind: 'transactional'
            });
          }
        } catch (e) {
          console.warn('[AUTHNET WEBHOOK] payment-failed email failed (non-blocking):', e.message);
        }
        break;
      }

      // ── Refund/void issued from the dashboard directly ──────────
      case 'net.authorize.payment.refund.created': {
        console.log(`[AUTHNET WEBHOOK] 💸 Refund: transId=${data.id} | Amount: $${data.authAmount}`);
        await notifyInternal('refund_issued', {
          transaction_id: data.id,
          amount: data.authAmount,
          action: 'update_records'
        });
        try {
          const { email, firstName } = await lookupTransactionContact(data.id);
          if (email) {
            await sendTransactional({
              template: 'refund-issued',
              to: email,
              data: { firstName, amount: data.authAmount ? '$' + Number(data.authAmount).toFixed(2) : null },
              dedupeKey: 'refund:' + data.id,
              kind: 'transactional'
            });
          }
        } catch (e) {
          console.warn('[AUTHNET WEBHOOK] refund-issued email failed (non-blocking):', e.message);
        }
        break;
      }
      case 'net.authorize.payment.void.created': {
        console.log(`[AUTHNET WEBHOOK] Void: transId=${data.id}`);
        await notifyInternal('transaction_voided', {
          transaction_id: data.id,
          action: 'update_records'
        });
        try {
          const { email, firstName } = await lookupTransactionContact(data.id);
          if (email) {
            await sendTransactional({
              template: 'refund-issued',
              to: email,
              data: { firstName, amount: null },
              dedupeKey: 'refund:' + data.id,
              kind: 'transactional'
            });
          }
        } catch (e) {
          console.warn('[AUTHNET WEBHOOK] refund-issued (void) email failed (non-blocking):', e.message);
        }
        break;
      }

      // ── A recurring (ARB) payment captured — the plan's own receipt ──
      // Fires for EVERY authcapture, one-time charges included; only a
      // transaction carrying a `subscription.id` we recorded ourselves
      // (recordSubscription, called right when the ARB schedule is created —
      // see create-authnet-transaction.js) is a true renewal. The very first
      // charge on a new plan is NOT this — it's the synchronous charge in
      // create-authnet-transaction.js, already covered by its own
      // order-confirmed email (T1); ARB's own first scheduled payment is
      // deliberately the plan's SECOND installment (see lib/authnet-arb.js).
      case 'net.authorize.payment.authcapture.created': {
        const subscriptionId = data.subscription && data.subscription.id;
        if (!subscriptionId) break; // an ordinary one-time charge, not a renewal
        const sub = await getSubscription(subscriptionId);
        if (!sub) {
          console.warn(`[AUTHNET WEBHOOK] authcapture for unknown subscription ${subscriptionId} — no receipt email sent`);
          break;
        }
        console.log(`[AUTHNET WEBHOOK] 🔁 Renewal captured: transId=${data.id} | subscription=${subscriptionId} | $${data.authAmount}`);
        await sendTransactional({
          template: 'renewal-charged',
          to: sub.email,
          data: { amount: data.authAmount ? '$' + Number(data.authAmount).toFixed(2) : null, cardLast4: null },
          dedupeKey: 'renewal:' + data.id,
          kind: 'transactional'
        });
        break;
      }

      // ── A recurring payment failed enough times that Authorize.Net paused the plan ──
      case 'net.authorize.customer.subscription.suspended': {
        const subscriptionId = data.id;
        console.warn(`[AUTHNET WEBHOOK] ⚠️ Subscription SUSPENDED: ${subscriptionId}`);
        const sub = await getSubscription(subscriptionId);
        await notifyInternal('subscription_suspended', { subscription_id: subscriptionId, action: 'alert_team_and_notify_patient' });
        if (sub) {
          const today = new Date().toISOString().slice(0, 10);
          await sendTransactional({
            template: 'renewal-failed',
            to: sub.email,
            data: { firstName: sub.first_name },
            dedupeKey: 'suspended:' + subscriptionId + ':' + today,
            kind: 'transactional'
          });
          try { await enrollJourney('winback', { email: sub.email, data: { firstName: sub.first_name } }); } catch (e) { console.warn('[AUTHNET WEBHOOK] enrollJourney(winback) failed (non-blocking):', e.message); }
        }
        break;
      }

      // ── Subscription ended (dashboard cancellation, or terminated after
      // repeated failed suspension) — same patient email as a self-service
      // cancellation (cancelSubscription.js), just triggered from Authorize.Net's side.
      case 'net.authorize.customer.subscription.terminated':
      case 'net.authorize.customer.subscription.cancelled': {
        const subscriptionId = data.id;
        console.log(`[AUTHNET WEBHOOK] Subscription ${eventType.endsWith('terminated') ? 'terminated' : 'cancelled'}: ${subscriptionId}`);
        const sub = await getSubscription(subscriptionId);
        if (sub) {
          await sendTransactional({
            template: 'subscription-cancelled',
            to: sub.email,
            data: { firstName: sub.first_name },
            dedupeKey: 'cancel:' + subscriptionId,
            kind: 'transactional'
          });
          try {
            await cancelJourney('refill-reminder', sub.email);
            await cancelJourney('patient-newsletter', sub.email);
          } catch (e) {
            console.warn('[AUTHNET WEBHOOK] cancelJourney failed (non-blocking):', e.message);
          }
        }
        await notifyInternal('subscription_ended', { subscription_id: subscriptionId, action: 'update_records' });
        break;
      }

      // ── Everything else — acknowledged, not acted on ────────────
      default:
        console.log(`[AUTHNET WEBHOOK] ℹ️ Unhandled event: ${eventType}`);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true, type: eventType }) };
  } catch (error) {
    console.error(`[AUTHNET WEBHOOK] Error processing ${eventType}:`, error);
    // 500 so Authorize.Net retries delivery.
    return { statusCode: 500, body: JSON.stringify({ error: 'Processing failed, will retry' }) };
  }
};

/**
 * Forward events to internal system (n8n, Make, Zapier, Slack, etc.) —
 * same convention as stripeWebhook.js. Non-critical — never fails the ack.
 */
async function notifyInternal(eventType, data) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(`[AUTHNET WEBHOOK] No N8N_WEBHOOK_URL set — event logged but not forwarded: ${eventType}`);
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'authnet_webhook',
        event_type: eventType,
        timestamp: new Date().toISOString(),
        ...data
      })
    });
    console.log(`[AUTHNET WEBHOOK] Internal webhook fired for ${eventType}: HTTP ${response.status}`);
  } catch (e) {
    console.warn(`[AUTHNET WEBHOOK] Internal webhook failed (non-critical): ${e.message}`);
  }
}

/**
 * Looks up the patient email/name for a transaction-level event (fraud
 * decline, refund, void) via Authorize.Net's own getTransactionDetailsRequest
 * — these webhook payloads carry only the transaction id, never contact
 * info. Returns the `customer.email`/`billTo` create-authnet-transaction.js
 * set on the ORIGINAL charge. Read-only, no charge; best-effort (returns
 * empty on any failure — callers already treat a missing email as "skip the
 * email, the internal Slack alert already fired").
 */
async function lookupTransactionContact(transId) {
  if (!transId) return {};
  const cfg = resolveAuthnetConfig();
  if (!cfg.apiLoginId || !cfg.transactionKey) return {};
  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        getTransactionDetailsRequest: {
          merchantAuthentication: { name: cfg.apiLoginId, transactionKey: cfg.transactionKey },
          transId: String(transId)
        }
      })
    });
    const json = JSON.parse((await res.text()).replace(/^﻿/, '').trim());
    if (!json.messages || json.messages.resultCode !== 'Ok') return {};
    const txn = json.transaction || {};
    return {
      email: (txn.customer && txn.customer.email) || undefined,
      firstName: (txn.billTo && txn.billTo.firstName) || undefined
    };
  } catch (e) {
    console.warn('[AUTHNET WEBHOOK] lookupTransactionContact failed (non-critical):', e.message);
    return {};
  }
}
