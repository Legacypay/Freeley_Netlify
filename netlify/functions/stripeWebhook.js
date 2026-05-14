/**
 * Stripe Webhook Handler — Netlify Serverless Function
 * 
 * Receives and verifies Stripe webhook events for payment lifecycle management.
 * Handles: payment success, payment failure, disputes, and refunds.
 * 
 * Register this URL in Stripe Dashboard > Developers > Webhooks:
 *   https://freeley.com/.netlify/functions/stripeWebhook
 * 
 * Required env vars (set in Netlify Dashboard > Site Settings > Environment Variables):
 *   STRIPE_SECRET_KEY        - Stripe secret key (sk_live_... or sk_test_...)
 *   STRIPE_WEBHOOK_SECRET    - Webhook signing secret (whsec_...)
 *   N8N_WEBHOOK_URL          - Internal webhook for alerts/notifications (optional)
 * 
 * POST /.netlify/functions/stripeWebhook
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // ── Step 1: Verify webhook signature ──────────────────────────
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[STRIPE WEBHOOK] CRITICAL: STRIPE_WEBHOOK_SECRET not set — rejecting all webhooks');
    return { statusCode: 500, body: JSON.stringify({ error: 'Webhook secret not configured' }) };
  }

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('[STRIPE WEBHOOK] Signature verification failed:', err.message);
    // Don't echo back Stripe internal error detail — bare 400 is enough.
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid webhook signature' }) };
  }

  // ── Step 2: Log event receipt ─────────────────────────────────
  const eventType = stripeEvent.type;
  const data = stripeEvent.data.object;
  console.log(`[STRIPE WEBHOOK] Event: ${eventType} | ID: ${data.id} | Amount: ${data.amount || 'N/A'}`);

  // ── Step 3: Handle each event type ────────────────────────────
  try {
    switch (eventType) {

      // ── Payment succeeded ─────────────────────────────────────
      case 'payment_intent.succeeded': {
        const { treatment, treatment_name, compound, plan_months, total } = data.metadata || {};
        console.log(`[STRIPE WEBHOOK] ✅ Payment SUCCEEDED: $${(data.amount / 100).toFixed(2)} | Treatment: ${treatment_name || treatment} | Plan: ${plan_months}mo`);
        
        await notifyInternal('payment_succeeded', {
          payment_intent_id: data.id,
          amount: (data.amount / 100).toFixed(2),
          currency: data.currency,
          customer_email: data.receipt_email,
          treatment: treatment,
          treatment_name: treatment_name,
          compound: compound,
          plan_months: plan_months,
          total: total,
          action: 'confirm_order'
        });
        break;
      }

      // ── Payment failed ────────────────────────────────────────
      case 'payment_intent.payment_failed': {
        const failureMessage = data.last_payment_error?.message || 'Unknown failure';
        const failureCode = data.last_payment_error?.code || 'unknown';
        console.error(`[STRIPE WEBHOOK] ❌ Payment FAILED: ${data.id} | Reason: ${failureMessage}`);

        await notifyInternal('payment_failed', {
          payment_intent_id: data.id,
          amount: (data.amount / 100).toFixed(2),
          customer_email: data.receipt_email,
          failure_code: failureCode,
          failure_message: failureMessage,
          treatment: data.metadata?.treatment,
          action: 'alert_team_and_notify_patient'
        });
        break;
      }

      // ── Charge disputed (chargeback) ──────────────────────────
      case 'charge.dispute.created': {
        console.error(`[STRIPE WEBHOOK] 🚨 DISPUTE CREATED: ${data.id} | Amount: $${(data.amount / 100).toFixed(2)} | Reason: ${data.reason}`);

        await notifyInternal('dispute_created', {
          dispute_id: data.id,
          charge_id: data.charge,
          amount: (data.amount / 100).toFixed(2),
          reason: data.reason,
          status: data.status,
          action: 'URGENT_respond_to_dispute'
        });
        break;
      }

      // ── Refund issued ─────────────────────────────────────────
      case 'charge.refunded': {
        console.log(`[STRIPE WEBHOOK] 💸 Refund: ${data.id} | Amount: $${(data.amount_refunded / 100).toFixed(2)}`);

        await notifyInternal('refund_issued', {
          charge_id: data.id,
          amount_refunded: (data.amount_refunded / 100).toFixed(2),
          customer_email: data.receipt_email || data.billing_details?.email,
          action: 'update_records'
        });
        break;
      }

      // ── Payment requires action (3DS/SCA) ─────────────────────
      case 'payment_intent.requires_action': {
        console.log(`[STRIPE WEBHOOK] ⏳ Payment requires auth: ${data.id}`);
        // No action needed — the frontend Stripe.js handles 3DS challenges
        break;
      }

      // ── All other events ──────────────────────────────────────
      default:
        console.log(`[STRIPE WEBHOOK] ℹ️ Unhandled event: ${eventType}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, type: eventType })
    };

  } catch (error) {
    console.error(`[STRIPE WEBHOOK] Error processing ${eventType}:`, error);
    // Return 500 so Stripe retries (up to 3 days with exponential backoff)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Processing failed, Stripe will retry' })
    };
  }
};

/**
 * Forward events to internal system (n8n, Make, Zapier, Slack, etc.)
 * Non-critical — we don't fail the webhook if this doesn't work.
 */
async function notifyInternal(eventType, data) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(`[STRIPE WEBHOOK] No N8N_WEBHOOK_URL set — event logged but not forwarded: ${eventType}`);
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'stripe_webhook',
        event_type: eventType,
        timestamp: new Date().toISOString(),
        ...data
      })
    });
    console.log(`[STRIPE WEBHOOK] Internal webhook fired for ${eventType}: HTTP ${response.status}`);
  } catch (e) {
    // Log but don't fail — the Stripe event is still acknowledged
    console.warn(`[STRIPE WEBHOOK] Internal webhook failed (non-critical): ${e.message}`);
  }
}
