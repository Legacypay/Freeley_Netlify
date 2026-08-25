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
 *   - case_approved      → ACTION REQUIRED: clinician is requesting a treatment/dose
 *                          change (titration). Team must review in the portal and
 *                          move the encounter back to "Assigned" to proceed.
 *                          (Per MDI go-live guidance 2026-08-21 — NOT a final approval.)
 *   - case_processing    → Prescription being processed by DoseSpot
 *   - case_completed     → Prescription confirmed by pharmacy
 *   - offering_submitted → Prescription verified and order being fulfilled
 *   - voucher_used       → Patient used a voucher
 *   - patient_created    → Patient record created
 *   - patient_modified   → Patient record updated
 *   - message_created    → New message in patient-clinician chat (inbound & outbound)
 *
 * Transactional emails are dispatched via N8N webhook with structured
 * email_action payloads. N8N routes these to your ESP (SendGrid, Postmark, etc.).
 *
 * Order status is tracked in Netlify Blobs (mdi-orders store, keyed by voucher_id).
 *
 * PHI: internal notifications (notifyInternalWebhook, → n8n → Slack per the MDI
 * partner object's slack_channel_id) intentionally carry only case_id/patient_id
 * (opaque UUIDs) — never patient_email or message content. Per MD Integrations'
 * go-live guidance (2026-08-21): "Do not share any patient-identifiable
 * information [in Slack]. The encounter ID is what comes in the URL after
 * cases/ ..." — i.e. case_id is explicitly the safe identifier to share.
 */

const { verifyWebhookSignature } = require('./lib/mdi-client');
const { tagTestCase } = require('./lib/mdi-tags');
const { getStore } = require('@netlify/blobs');

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

    // ── Step 3: Look up order record (best-effort) ────────────
    // Order records are keyed by voucher_id in the mdi-orders blob store.
    // We search by patient_id or case_id from the webhook metadata.
    const order = await lookupOrder(patient_id, case_id, metadata, payload.voucher_id || payload.partner_voucher_id);

    // ── Step 3a: Backfill patient_id / case_id on the order record ──
    // Freshly created vouchers have neither (patient is created at onboarding), so
    // later lookups by patient_id/case_id would fail. Persist them on first sight.
    await backfillOrderIds(order, patient_id, case_id);

    // ── Step 3b: Tag test orders as "test-case" in MDI ────────
    // Test orders that run the full flow (MDI_TEST_FULL_FLOW=true) create a real
    // encounter; MDI asks partners to tag those so they are not billed. The tag can
    // only be attached once a case_id exists, so we do it here, once, on any event
    // carrying a case_id. Mutates `order` so later updateOrderStatus() persists it.
    await maybeTagTestCase(order, case_id);

    // ── Step 4: Handle each event type ────────────────────────
    switch (event_type) {

      // ── Case "Approved" = clinician requests a treatment change ──
      // Per MDI (2026-08-21): Approved status means the doctor is requesting
      // a change in treatment or titration. Someone on our team must review
      // the encounter and move it back to "Assigned" for it to proceed.
      case 'case_approved': {
        console.warn(`[MDI WEBHOOK] ⚠️ Case APPROVED (ACTION REQUIRED — review & move back to Assigned): ${case_id}`);

        await updateOrderStatus(order, 'approved', {
          case_id,
          approved_at: new Date().toISOString()
        });

        // Patient email intentionally PAUSED: it read "your prescription has
        // been approved", which is wrong if the doctor is actually asking for a
        // dose change. Re-enable once MDI confirms what this event means.
        // await sendPatientEmail(order, 'case_approved', { subject: 'Great news! Your prescription has been approved', template: 'case_approved', data: { first_name: order?.first_name || 'there', product: order?.product_key || 'your treatment', case_id } });

        await notifyInternalWebhook('case_approved', {
          case_id,
          metadata,
          severity: 'high',
          action: 'ACTION_REQUIRED_review_and_move_to_assigned',
          message: 'MDI clinician is requesting a treatment/dose change. Review the encounter in the portal and move it back to Assigned.',
          encounter_url: case_id ? `https://app.mdintegrations.com/tabs/cases/${case_id}` : undefined
        });
        break;
      }

      // ── Clinician needs more info ───────────────────────────
      case 'case_waiting': {
        console.log(`[MDI WEBHOOK] ⏳ Case WAITING: ${case_id}`);

        // Update order status
        await updateOrderStatus(order, 'waiting', {
          case_id,
          waiting_since: new Date().toISOString()
        });

        // Send "action needed" email to patient
        await sendPatientEmail(order, 'case_waiting', {
          subject: 'Action needed — your clinician has a question',
          template: 'case_waiting',
          data: {
            first_name: order?.first_name || 'there',
            product: order?.product_key || 'your treatment',
            case_id,
            portal_url: 'https://freeley.com/hub'
          }
        });

        await notifyInternalWebhook('case_waiting', {
          case_id,
          metadata,
          action: 'patient_info_requested_email_sent'
        });
        break;
      }

      // ── Case is being processed ─────────────────────────────
      case 'case_processing':
        console.log(`[MDI WEBHOOK] 🔄 Case PROCESSING: ${case_id}`);

        await updateOrderStatus(order, 'processing', {
          case_id,
          processing_since: new Date().toISOString()
        });

        await notifyInternalWebhook('case_processing', {
          case_id,
          metadata,
          action: 'update_order_status'
        });
        break;

      // ── Case completed → prescription confirmed by pharmacy ─
      case 'case_completed': {
        console.log(`[MDI WEBHOOK] 🎉 Case COMPLETED: ${case_id}`);

        // Update order status to completed
        await updateOrderStatus(order, 'completed', {
          case_id,
          completed_at: new Date().toISOString()
        });

        // Send "prescription ready" email
        await sendPatientEmail(order, 'case_completed', {
          subject: 'Your prescription is ready and on its way!',
          template: 'case_completed',
          data: {
            first_name: order?.first_name || 'there',
            product: order?.product_key || 'your treatment',
            case_id
          }
        });

        await notifyInternalWebhook('case_completed', {
          case_id,
          metadata,
          action: 'prescription_ready_email_sent'
        });
        break;
      }

      // ── Offering submitted → order being fulfilled ──────────
      case 'offering_submitted': {
        console.log(`[MDI WEBHOOK] 📦 Offering SUBMITTED: ${case_id}`);
        const offerings = payload.offerings || [];

        await updateOrderStatus(order, 'fulfilling', {
          case_id,
          offerings: offerings.map(o => ({
            id: o.case_offering_id,
            name: o.name,
            status: o.status,
            directions: o.directions
          })),
          fulfillment_started_at: new Date().toISOString()
        });

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
      }

      // ── Patient events ──────────────────────────────────────
      case 'patient_created':
      case 'patient_modified':
      case 'patient_deleted':
        console.log(`[MDI WEBHOOK] 👤 Patient ${event_type}: ${patient_id}`);
        break;

      // ── Message events (inbound & outbound) ─────────────────
      // MDI fires message_created for BOTH clinician→patient and
      // patient→clinician messages. Filter by sender_type to avoid
      // notifying the patient about their own messages.
      case 'message_created': {
        const senderType = payload.sender_type || payload.sender || 'unknown';
        const messagePreview = (payload.message || payload.body || '').slice(0, 100);
        console.log(`[MDI WEBHOOK] 💬 Message CREATED | Patient: ${patient_id} | Sender: ${senderType}`);

        // Only notify patient when a CLINICIAN sends a message
        if (senderType === 'clinician' || senderType === 'provider' || senderType === 'doctor') {
          // Send "new message from your clinician" email
          await sendPatientEmail(order, 'message_from_clinician', {
            subject: 'You have a new message from your clinician',
            template: 'clinician_message',
            data: {
              first_name: order?.first_name || 'there',
              portal_url: 'https://freeley.com/hub'
              // NOTE: Do NOT include message content in email (PHI concern)
              // Points to Freeley hub (in-app messaging) instead of MDI portal
            }
          });

          await notifyInternalWebhook('message_from_clinician', {
            patient_id,
            case_id,
            sender_type: senderType,
            // NOTE: message_preview is intentionally omitted too — message content is PHI.
            action: 'clinician_message_email_sent'
          });
        } else {
          // Patient sent a message — log only, no notification needed
          console.log(`[MDI WEBHOOK] 💬 Patient message logged (no outbound notification)`);
        }
        break;
      }

      // ── Case created / assigned ─────────────────────────────
      // These fire early in the lifecycle — critical to store the
      // case_id so the patient hub can look it up later.
      case 'case_created':
      case 'case_assigned_to_clinician': {
        console.log(`[MDI WEBHOOK] 📋 ${event_type}: case=${case_id}, patient=${patient_id}`);

        await updateOrderStatus(order, event_type === 'case_created' ? 'created' : 'assigned', {
          case_id,
          [`${event_type}_at`]: new Date().toISOString()
        });

        await notifyInternalWebhook(event_type, {
          case_id,
          patient_id,
          metadata,
          action: 'case_status_updated'
        });
        break;
      }

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
    // Return 500 so MDI retries delivery — returning 200 here would silently drop the event
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Processing failed, please retry' })
    };
  }
};


// ═══════════════════════════════════════════════════════════════
// Helper: Look up order record from Netlify Blobs
// ═══════════════════════════════════════════════════════════════
// Orders are stored in mdi-orders keyed by voucher_id. The webhook
// gives us case_id and/or patient_id, so we iterate to find a match.
// This is O(n) over orders but the store is small (hundreds, not millions).

async function lookupOrder(patientId, caseId, metadata, voucherId) {
  try {
    const store = getStore('mdi-orders');

    // Fastest path: the event carries the voucher id, which is our blob key.
    if (voucherId) {
      try {
        const order = await store.get(voucherId, { type: 'json' });
        if (order) {
          console.log(`[MDI WEBHOOK] Order found by voucher_id: ${voucherId}`);
          order._voucher_id = voucherId;
          return order;
        }
      } catch { /* not found, continue search */ }
    }

    const { blobs } = await store.list();

    if (!blobs || blobs.length === 0) {
      console.log('[MDI WEBHOOK] No orders in store — cannot look up patient');
      return null;
    }

    // Check if metadata contains voucher_id directly (metadata may be a string per docs)
    const metaVoucherId = metadata && typeof metadata === 'object' ? (metadata.voucher_id || metadata.voucher_token) : null;
    if (metaVoucherId) {
      try {
        const order = await store.get(metaVoucherId, { type: 'json' });
        if (order) {
          console.log(`[MDI WEBHOOK] Order found by metadata voucher_id: ${metaVoucherId}`);
          order._voucher_id = metaVoucherId;
          return order;
        }
      } catch { /* not found, continue search */ }
    }

    // Search by patient_id or case_id across all orders
    for (const blob of blobs) {
      try {
        const order = await store.get(blob.key, { type: 'json' });
        if (!order) continue;

        // Match by patient_id
        if (patientId && order.patient_id === patientId) {
          console.log(`[MDI WEBHOOK] Order found by patient_id: ${blob.key}`);
          order._voucher_id = blob.key;
          return order;
        }

        // Match by case_id (if stored from a previous webhook)
        if (caseId && order.case_id === caseId) {
          console.log(`[MDI WEBHOOK] Order found by case_id: ${blob.key}`);
          order._voucher_id = blob.key;
          return order;
        }
      } catch { /* skip corrupted entries */ }
    }

    console.warn(`[MDI WEBHOOK] No matching order found for patient=${patientId}, case=${caseId}`);
    return null;
  } catch (err) {
    console.warn(`[MDI WEBHOOK] Order lookup failed (non-critical): ${err.message}`);
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════
// Helper: Persist patient_id / case_id on first sight
// ═══════════════════════════════════════════════════════════════

async function backfillOrderIds(order, patientId, caseId) {
  if (!order || !order._voucher_id) return;
  const changes = {};
  if (patientId && !order.patient_id) changes.patient_id = patientId;
  if (caseId && !order.case_id) changes.case_id = caseId;
  if (Object.keys(changes).length === 0) return;
  Object.assign(order, changes);
  try {
    const store = getStore('mdi-orders');
    const persisted = { ...order };
    delete persisted._voucher_id;
    await store.setJSON(order._voucher_id, persisted);
    console.log(`[MDI WEBHOOK] Order ${order._voucher_id} backfilled: ${Object.keys(changes).join(', ')}`);
  } catch (err) {
    console.warn(`[MDI WEBHOOK] Backfill failed (non-critical): ${err.message}`);
  }
}


// ═══════════════════════════════════════════════════════════════
// Helper: Attach the "test-case" tag to test orders (once)
// ═══════════════════════════════════════════════════════════════

async function maybeTagTestCase(order, caseId) {
  if (!order || !order._voucher_id || !caseId) return;
  if (order.is_test !== true || order.demo === true) return; // demo vouchers never create a case
  if (order.test_tagged_at) return;                          // already tagged

  try {
    await tagTestCase(caseId, 'Freeley test order (' + (order.test_reason || 'test') + ') — voucher ' + order._voucher_id);
    order.test_tagged_at = new Date().toISOString();
    order.case_id = order.case_id || caseId;

    const store = getStore('mdi-orders');
    const persisted = { ...order };
    delete persisted._voucher_id;
    await store.setJSON(order._voucher_id, persisted);
    console.log(`[MDI WEBHOOK] 🏷️ Test-case tag recorded for order ${order._voucher_id} / case ${caseId}`);
  } catch (err) {
    // Non-critical: the "TEST CASE |" metadata on the voucher is the first line of defence.
    console.warn(`[MDI WEBHOOK] Failed to tag test case ${caseId} (non-critical): ${err.message}`);
  }
}


// ═══════════════════════════════════════════════════════════════
// Helper: Update order status in Netlify Blobs
// ═══════════════════════════════════════════════════════════════

async function updateOrderStatus(order, status, extraFields = {}) {
  if (!order || !order._voucher_id) {
    console.warn(`[MDI WEBHOOK] Cannot update order status — no order found`);
    return;
  }

  try {
    const store = getStore('mdi-orders');
    const updated = {
      ...order,
      status,
      ...extraFields,
      updated_at: new Date().toISOString(),
      status_history: [
        ...(order.status_history || []),
        { status, timestamp: new Date().toISOString() }
      ]
    };
    // Remove internal lookup key before persisting
    delete updated._voucher_id;

    await store.setJSON(order._voucher_id, updated);
    console.log(`[MDI WEBHOOK] Order ${order._voucher_id} status updated: ${status}`);
  } catch (err) {
    console.warn(`[MDI WEBHOOK] Failed to update order status (non-critical): ${err.message}`);
  }
}


// ═══════════════════════════════════════════════════════════════
// Helper: Send transactional email via N8N webhook
// ═══════════════════════════════════════════════════════════════
// N8N receives structured email payloads and routes them to your
// ESP (SendGrid, Postmark, Resend, etc.) based on the template field.
// If no N8N webhook is configured, logs the email action for debugging.

async function sendPatientEmail(order, emailType, emailPayload) {
  const patientEmail = order?.email;
  if (!patientEmail) {
    console.warn(`[MDI WEBHOOK] Cannot send ${emailType} email — no patient email found`);
    return;
  }
  // Test/sandbox orders never email a real inbox (single choke point for all events).
  if (order.is_test || order.environment === 'sandbox') {
    console.log(`[MDI WEBHOOK] Skipping ${emailType} email — test/sandbox order (${order.environment || 'unknown env'})`);
    return;
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(`[MDI WEBHOOK] Email action queued (no N8N_WEBHOOK_URL): ${emailType} → ${patientEmail}`);
    console.log(`[MDI WEBHOOK] Email payload:`, JSON.stringify({ to: patientEmail, ...emailPayload }));
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'mdi_webhook',
        event_type: 'send_email',
        email_action: emailType,
        to: patientEmail,
        subject: emailPayload.subject,
        template: emailPayload.template,
        template_data: emailPayload.data || {},
        timestamp: new Date().toISOString()
      })
    });
    console.log(`[MDI WEBHOOK] 📧 Email dispatched: ${emailType} → ${patientEmail}`);
  } catch (err) {
    console.warn(`[MDI WEBHOOK] Email dispatch failed (non-critical): ${err.message}`);
  }
}


// ═══════════════════════════════════════════════════════════════
// Helper: Forward events to internal system (N8N / Make / Zapier)
// ═══════════════════════════════════════════════════════════════

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
