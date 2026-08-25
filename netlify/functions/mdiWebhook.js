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
 *   - case_order_created → Pharmacy order created for the case
 *   - case_order_updated → Pharmacy order changed (items, amounts, status)
 *   - case_order_prescription_created → Prescription attached to the pharmacy order
 *   - case_order_prescription_updated → Prescription on the pharmacy order changed
 *   - order_status_changed → Order moved between pending/received/ready/fulfilled
 *   - order_tracking_number_changed → Carrier/tracking number set or changed (shipment)
 *   - voucher_used       → Patient used a voucher
 *   - patient_created    → Patient record created
 *   - patient_modified   → Patient record updated
 *   - message_created    → New message in patient-clinician chat (inbound & outbound)
 *
 * Transactional emails are dispatched via N8N webhook with structured
 * email_action payloads. N8N routes these to your ESP (SendGrid, Postmark, etc.).
 *
 * Order status is tracked in Netlify Blobs (mdi-orders store, keyed by voucher_id).
 * The order/shipment events above carry no patient_id and only an unstructured
 * `order_details` free-text field, so they are treated purely as a signal to
 * re-fetch the real structured order list from MDI's Partner Orders API
 * (see refreshPatientOrders) and cache it on the order record for getOrders.js.
 *
 * PHI: internal notifications (notifyInternalWebhook, → n8n → Slack per the MDI
 * partner object's slack_channel_id) intentionally carry only case_id/patient_id
 * (opaque UUIDs) — never patient_email or message content. Per MD Integrations'
 * go-live guidance (2026-08-21): "Do not share any patient-identifiable
 * information [in Slack]. The encounter ID is what comes in the URL after
 * cases/ ..." — i.e. case_id is explicitly the safe identifier to share.
 */

const { verifyWebhookSignature, mdiRequest } = require('./lib/mdi-client');
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

      // ── Pharmacy order created / updated ────────────────────
      // These carry no patient_id and only free-text order_details, so we use
      // them as a trigger to pull the real structured order list from MDI.
      case 'case_order_created':
      case 'case_order_updated': {
        console.log(`[MDI WEBHOOK] 📦 ${event_type}: case=${case_id}, order_status=${payload.order_status || 'N/A'}`);

        const orders = await refreshPatientOrders(order);

        await updateOrderStatus(order, payload.order_status || order?.status || 'ordered', {
          case_id,
          case_order_id: payload.case_order_id || order?.case_order_id || null,
          [`${event_type}_at`]: new Date().toISOString(),
          ...(orders ? { orders } : {})
        });

        // Report honestly when the refresh failed — otherwise Slack sees
        // "synced" while the cached order list is actually stale.
        await notifyInternalWebhook(event_type, {
          case_id,
          metadata,
          order_status: payload.order_status || null,
          action: orders ? 'pharmacy_order_synced' : 'pharmacy_order_refresh_failed_stale_cache'
        });
        break;
      }

      // ── Prescription attached to the pharmacy order ─────────
      // Earlier lifecycle stage than a shipment — record it, no patient email.
      case 'case_order_prescription_created':
      case 'case_order_prescription_updated': {
        console.log(`[MDI WEBHOOK] 💊 ${event_type}: case=${case_id}, prescription_status=${payload.prescription_status || 'N/A'}`);

        await updateOrderStatus(order, order?.status || 'processing', {
          case_id,
          case_order_id: payload.case_order_id || order?.case_order_id || null,
          prescription_status: payload.prescription_status || null,
          [`${event_type}_at`]: new Date().toISOString()
        });

        await notifyInternalWebhook(event_type, {
          case_id,
          metadata,
          prescription_status: payload.prescription_status || null,
          action: 'prescription_status_recorded'
        });
        break;
      }

      // ── Order status moved (pending → received → ready → fulfilled) ──
      case 'order_status_changed': {
        console.log(`[MDI WEBHOOK] 🔁 Order STATUS CHANGED: case=${case_id}, order_status=${payload.order_status || 'N/A'}`);

        const orders = await refreshPatientOrders(order);

        await updateOrderStatus(order, payload.order_status || order?.status || 'ordered', {
          case_id,
          order_status_changed_at: new Date().toISOString(),
          ...(orders ? { orders } : {})
        });

        await notifyInternalWebhook('order_status_changed', {
          case_id,
          metadata,
          order_status: payload.order_status || null,
          action: orders ? 'order_status_synced' : 'order_status_refresh_failed_stale_cache'
        });
        break;
      }

      // ── Tracking number set/changed → the order actually shipped ──
      case 'order_tracking_number_changed': {
        console.log(`[MDI WEBHOOK] 🚚 Order TRACKING CHANGED: case=${case_id}`);

        const orders = await refreshPatientOrders(order);
        const alreadyEmailed = Boolean(order?.order_shipped_email_sent_at);

        await updateOrderStatus(order, payload.order_status || 'shipped', {
          case_id,
          shipped_at: new Date().toISOString(),
          ...(orders ? { orders } : {}),
          // MDI can fire this event more than once for the same order (a carrier
          // correction, a webhook redelivery); only ever email the patient once,
          // mirroring the test_tagged_at once-only guard used elsewhere in this file.
          ...(alreadyEmailed ? {} : { order_shipped_email_sent_at: new Date().toISOString() })
        });

        if (!alreadyEmailed) {
          // Patient's own inbox — safe to point them at the hub for tracking detail.
          await sendPatientEmail(order, 'order_shipped', {
            subject: 'Your order has shipped!',
            template: 'order_shipped',
            data: {
              first_name: order?.first_name || 'there',
              product: order?.product_key || 'your treatment',
              case_id,
              portal_url: 'https://freeley.com/hub'
            }
          });
        } else {
          console.log(`[MDI WEBHOOK] Skipping duplicate order_shipped email for case ${case_id} — already sent`);
        }

        // NOTE: tracking number / carrier are deliberately NOT sent here — the
        // internal notification lands in Slack and must stay opaque-ID-only.
        await notifyInternalWebhook('order_tracking_number_changed', {
          case_id,
          metadata,
          order_status: payload.order_status || null,
          action: alreadyEmailed
            ? 'order_shipped_email_skipped_duplicate'
            : (orders ? 'order_shipped_email_sent' : 'order_shipped_email_sent_refresh_failed_stale_cache')
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
// Helper: Re-fetch the real order list from MDI's Partner Orders API
// ═══════════════════════════════════════════════════════════════
// The order/shipment webhook events carry no patient_id and only an
// unstructured order_details string ("Tracking Number: 101010"), so the only
// reliable source of structured tracking data is the API itself. The order
// record already has patient_id backfilled by this point (case_created /
// patient_created fired earlier), so we use that.
//
// Returns the mapped order list, or null if it could not be fetched — callers
// spread it into updateOrderStatus's extraFields only when non-null so a
// failure never wipes a previously cached list. Billing/card details are
// dropped: the hub doesn't need them, and they don't belong in blob storage.

async function refreshPatientOrders(order) {
  const patientId = order?.patient_id;
  if (!patientId) {
    console.warn('[MDI WEBHOOK] Cannot refresh orders — no patient_id on the order record');
    return null;
  }

  try {
    const response = await mdiRequest('GET', `/v1/partner/patients/${patientId}/orders?per_page=50`);
    const data = (response && Array.isArray(response.data)) ? response.data : [];

    const orders = data.map(o => ({
      id: o.id || null,
      order_number: o.order_number || null,
      status: o.status || null,
      payment_status: o.payment_status || null,
      total_amount: o.total_amount != null ? o.total_amount : null,
      case_id: o.case_id || null,
      case_order_id: o.case_order_id || null,
      tracking: o.tracking
        ? {
            number: o.tracking.number || null,
            company: o.tracking.company || null,
            link: o.tracking.link || null
          }
        : null,
      products: (o.products || []).map(p => ({
        name: p.name || null,
        image_url: p.image_url || null,
        amount: p.amount != null ? p.amount : 1
      })),
      order_created_at: o.order_created_at || o.created_at || null,
      cancelled_at: o.cancelled_at || null,
      updated_at: o.updated_at || null
    }));

    console.log(`[MDI WEBHOOK] 🔄 Refreshed ${orders.length} order(s) for patient ${patientId}`);
    return orders;
  } catch (err) {
    console.warn(`[MDI WEBHOOK] Order refresh failed (non-critical): ${err.message}`);
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════
// Helper: Update order status in Netlify Blobs
// ═══════════════════════════════════════════════════════════════

// Optimistic-concurrency write: order/shipment events (case_order_created,
// order_status_changed, order_tracking_number_changed, ...) can plausibly
// arrive for the same voucher within milliseconds of each other. A plain
// read-modify-write would let the slower of two concurrent webhook
// invocations silently clobber the faster one's status_history entry / cached
// orders list. We re-read the blob (with its etag) at write time — not the
// possibly-stale `order` snapshot the caller looked up earlier in this
// request — and retry with a fresh read if another writer won the race
// (`setJSON`'s `onlyIfMatch` returns `{modified:false}` rather than throwing).
const UPDATE_ORDER_STATUS_MAX_ATTEMPTS = 3;

async function updateOrderStatus(order, status, extraFields = {}) {
  if (!order || !order._voucher_id) {
    console.warn(`[MDI WEBHOOK] Cannot update order status — no order found`);
    return;
  }

  const voucherId = order._voucher_id;
  const store = getStore('mdi-orders');

  for (let attempt = 1; attempt <= UPDATE_ORDER_STATUS_MAX_ATTEMPTS; attempt++) {
    try {
      const current = await store.getWithMetadata(voucherId, { type: 'json' });
      const base = current?.data || order; // key vanished mid-request — fall back to the caller's snapshot

      const updated = {
        ...base,
        status,
        ...extraFields,
        updated_at: new Date().toISOString(),
        status_history: [
          ...(base.status_history || []),
          { status, timestamp: new Date().toISOString() }
        ]
      };
      delete updated._voucher_id;

      const result = await store.setJSON(
        voucherId,
        updated,
        current?.etag ? { onlyIfMatch: current.etag } : undefined
      );

      if (result.modified !== false) {
        console.log(`[MDI WEBHOOK] Order ${voucherId} status updated: ${status}` + (attempt > 1 ? ` (attempt ${attempt})` : ''));
        return;
      }
      console.warn(`[MDI WEBHOOK] Order ${voucherId} write conflict on attempt ${attempt} — re-reading and retrying`);
    } catch (err) {
      console.warn(`[MDI WEBHOOK] Failed to update order status (non-critical): ${err.message}`);
      return;
    }
  }
  console.warn(`[MDI WEBHOOK] Order ${voucherId} status update abandoned after ${UPDATE_ORDER_STATUS_MAX_ATTEMPTS} conflicting writes — a concurrent webhook won`);
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
