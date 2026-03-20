/**
 * Netlify Function: mdiWebhook
 * 
 * Receives webhook POST requests from MD Integrations when case
 * statuses change (approved, denied, completed, etc.).
 * 
 * Register this URL with MDI during onboarding:
 *   https://your-site.netlify.app/.netlify/functions/mdiWebhook
 * 
 * MDI sends webhooks for these events:
 *   - case_waiting       → Clinician needs more info from patient
 *   - case_approved      → Clinician approved the case
 *   - case_processing    → Prescription being processed by DoseSpot
 *   - case_completed     → Prescription confirmed by pharmacy
 *   - offering_submitted → Prescription verified and order being fulfilled
 *   - voucher_used       → Patient used a voucher
 *   - patient_created    → Patient record created
 *   - patient_modified   → Patient record updated
 */

const { verifyWebhookSignature } = require('./lib/mdi-client');

exports.handler = async (event) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // ── Step 1: Verify webhook signature ──────────────────────
    const signature = event.headers['signature'] || event.headers['Signature'];
    const rawBody = event.body;

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('[MDI WEBHOOK] Invalid signature — rejecting request');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid webhook signature' })
      };
    }

    // ── Step 2: Parse the event ───────────────────────────────
    const payload = JSON.parse(rawBody);
    const { event_type, case_id, patient_id, metadata, timestamp } = payload;

    console.log(`[MDI WEBHOOK] Event: ${event_type} | Case: ${case_id || 'N/A'} | Patient: ${patient_id || 'N/A'}`);

    // ── Step 3: Handle each event type ────────────────────────
    switch (event_type) {

      // ── Case approved by clinician ──────────────────────────
      case 'case_approved':
        console.log(`[MDI WEBHOOK] ✅ Case APPROVED: ${case_id}`);
        // TODO: Trigger payment charge for the patient
        // TODO: Send confirmation email via your ESP
        await notifyInternalWebhook('case_approved', {
          case_id,
          metadata,
          action: 'charge_patient_and_confirm'
        });
        break;

      // ── Clinician needs more info ───────────────────────────
      case 'case_waiting':
        console.log(`[MDI WEBHOOK] ⏳ Case WAITING: ${case_id}`);
        // TODO: Send email/SMS to patient asking for more info
        await notifyInternalWebhook('case_waiting', {
          case_id,
          metadata,
          action: 'request_patient_info'
        });
        break;

      // ── Case is being processed ─────────────────────────────
      case 'case_processing':
        console.log(`[MDI WEBHOOK] 🔄 Case PROCESSING: ${case_id}`);
        await notifyInternalWebhook('case_processing', {
          case_id,
          metadata,
          action: 'update_order_status'
        });
        break;

      // ── Case completed → prescription confirmed by pharmacy ─
      case 'case_completed':
        console.log(`[MDI WEBHOOK] 🎉 Case COMPLETED: ${case_id}`);
        // TODO: Send "Your prescription is ready" email
        // TODO: Update order status in your database
        await notifyInternalWebhook('case_completed', {
          case_id,
          metadata,
          action: 'prescription_ready_notify_patient'
        });
        break;

      // ── Offering submitted → order being fulfilled ──────────
      case 'offering_submitted':
        console.log(`[MDI WEBHOOK] 📦 Offering SUBMITTED: ${case_id}`);
        const offerings = payload.offerings || [];
        await notifyInternalWebhook('offering_submitted', {
          case_id,
          metadata,
          offerings: offerings.map(o => ({
            id: o.case_offering_id,
            name: o.name,
            status: o.status,
            directions: o.directions
          })),
          action: 'order_fulfillment_started'
        });
        break;

      // ── Patient events ──────────────────────────────────────
      case 'patient_created':
      case 'patient_modified':
      case 'patient_deleted':
        console.log(`[MDI WEBHOOK] 👤 Patient ${event_type}: ${patient_id}`);
        break;

      // ── Voucher events ──────────────────────────────────────
      case 'voucher_used':
      case 'voucher_created':
      case 'voucher_reminder_sent':
        console.log(`[MDI WEBHOOK] 🎟️ Voucher ${event_type}: ${payload.voucher_id}`);
        break;

      // ── Unknown event ───────────────────────────────────────
      default:
        console.log(`[MDI WEBHOOK] ❓ Unknown event: ${event_type}`);
    }

    // Always return 200 to acknowledge receipt
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, event_type })
    };

  } catch (error) {
    console.error('[MDI WEBHOOK] Error processing webhook:', error);
    // Still return 200 so MDI doesn't keep retrying on parse errors
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, error: 'Processing error logged' })
    };
  }
};

/**
 * Forward webhook events to your internal system (n8n, Make, Zapier, etc.)
 * This lets you trigger emails, SMS, Slack alerts, database updates, etc.
 */
async function notifyInternalWebhook(eventType, data) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('[MDI WEBHOOK] No N8N_WEBHOOK_URL set — skipping internal notification');
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'mdi_webhook',
        event_type: eventType,
        timestamp: new Date().toISOString(),
        ...data
      })
    });
    console.log(`[MDI WEBHOOK] Internal webhook fired for: ${eventType}`);
  } catch (e) {
    console.warn(`[MDI WEBHOOK] Internal webhook failed (non-critical): ${e.message}`);
  }
}
