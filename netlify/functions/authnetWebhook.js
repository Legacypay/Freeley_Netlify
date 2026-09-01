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
const { resolveAuthnetConfig } = require('./lib/authnet-config');

exports.handler = async (event) => {
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
        break;
      }
      case 'net.authorize.payment.void.created': {
        console.log(`[AUTHNET WEBHOOK] Void: transId=${data.id}`);
        await notifyInternal('transaction_voided', {
          transaction_id: data.id,
          action: 'update_records'
        });
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
