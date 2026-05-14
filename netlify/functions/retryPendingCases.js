/**
 * Netlify Function: retryPendingCases
 * 
 * Reads all pending MDI case submissions from Netlify Blobs and retries them.
 * Can be triggered manually via GET request or scheduled via Netlify cron.
 * 
 * GET /.netlify/functions/retryPendingCases
 * 
 * To schedule automatic retries, add to netlify.toml:
 *   [functions."retryPendingCases"]
 *     schedule = "every 15 minutes" (cron: 0/15 * * * *)
 */

const { getStore } = require('@netlify/blobs');
const { mdiRequest } = require('./lib/mdi-client');
const { PRODUCTS, resolveProductKey } = require('./lib/products');
const { encryptRecord, decryptRecord } = require('./lib/phi-crypto');

const MAX_RETRIES = 10;

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://freeley.com'
  };

  try {
    const store = getStore('pending-mdi-cases');
    const { blobs } = await store.list();

    if (!blobs || blobs.length === 0) {
      console.log('[RETRY MDI] No pending cases found.');
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'No pending cases', count: 0 }) };
    }

    console.log(`[RETRY MDI] Found ${blobs.length} pending case(s). Processing...`);

    const results = [];

    for (const blob of blobs) {
      const key = blob.key;
      let storedRaw;
      let record;

      try {
        storedRaw = await store.get(key, { type: 'json' });
        record = decryptRecord(storedRaw);
      } catch (e) {
        console.error(`[RETRY MDI] Failed to read/decrypt blob ${key}:`, e.message);
        results.push({ key, status: 'read_error' });
        continue;
      }

      if (!record || record.status === 'completed') {
        results.push({ key, status: 'skipped' });
        continue;
      }

      // Check retry limit
      if (record.retry_count >= MAX_RETRIES) {
        console.error(`[RETRY MDI] ❌ Max retries (${MAX_RETRIES}) reached for ${key}. Marking as failed.`);
        record.status = 'permanently_failed';
        record.failed_at = new Date().toISOString();
        await store.setJSON(key, encryptRecord(record));

        // Alert team about permanent failure
        await alertTeam(key, record, 'permanently_failed');
        results.push({ key, status: 'permanently_failed' });
        continue;
      }

      // ── Attempt MDI submission ───────────────────────────────
      try {
        const { patient: patientData, product: productKey, dose, quiz_answers, allergies, current_medications, medical_conditions } = record;

        // Resolve product key — handles legacy 'semaglutide'/'tirzepatide' keys
        const resolvedKey = resolveProductKey(productKey, dose);

        if (!patientData || !resolvedKey || !PRODUCTS[resolvedKey]) {
          console.error(`[RETRY MDI] Invalid record for ${key}: missing patient or product (key: ${productKey}, resolved: ${resolvedKey})`);
          record.status = 'invalid';
          await store.setJSON(key, encryptRecord(record));
          results.push({ key, status: 'invalid' });
          continue;
        }

        const product = PRODUCTS[resolvedKey];

        // Build voucher payload — uses /v1/partner/vouchers (public API)
        // Defaults to SANDBOX while partner is "Integrating".
        // Set MDI_LIVE_MODE=true once partner is activated.
        const isDemo = process.env.MDI_LIVE_MODE !== 'true';
        const MDI_SANDBOX_ENV_ID = '6ab0181e-d52a-488f-a161-d64d576b2eba';
        const MDI_LIVE_ENV_ID = 'b374c499-638d-4e72-b844-4c68fcda2eff';
        const environmentId = isDemo ? MDI_SANDBOX_ENV_ID : MDI_LIVE_ENV_ID;
        const voucherPayload = {
          questionnaire_id: product.questionnaire_id,
          environment_id: environmentId,
          hold_status: false,
          offering_id: product.offering_id || undefined
        };

        console.log(`[RETRY MDI] Submitting voucher for ${key} | demo: ${isDemo} | env: ${environmentId}`);
        const result = await mdiRequest('POST', '/v1/partner/vouchers', voucherPayload);

        // ── Success! Mark as completed ─────────────────────────
        record.status = 'completed';
        record.completed_at = new Date().toISOString();
        record.mdi_patient_id = result.patient_id;
        record.mdi_case_id = result.id;
        await store.setJSON(key, encryptRecord(record));

        console.log(`[RETRY MDI] ✅ SUCCESS: ${key} → Patient: ${result.patient_id}, Case: ${result.id} (retry #${record.retry_count})`);

        // Store order↔encounter link for support lookups
        try {
          const orderStore = getStore('mdi-orders');
          await orderStore.setJSON(result.id, {
            voucher_id: result.id,
            patient_id: result.patient_id,
            email: patientData.email,
            first_name: patientData.first_name,
            last_name: patientData.last_name,
            product_key: resolvedKey,
            original_product_key: productKey !== resolvedKey ? productKey : undefined,
            dose: dose || null,
            offering_id: product.offering_id,
            category: product.category,
            environment: isDemo ? 'sandbox' : 'live',
            created_at: new Date().toISOString(),
            retry_count: record.retry_count,
            source: 'retry'
          });
        } catch (orderErr) {
          console.warn(`[RETRY MDI] Failed to save order record (non-critical):`, orderErr.message);
        }

        // Notify team of successful recovery
        await alertTeam(key, record, 'recovered');
        results.push({ key, status: 'completed', case_id: result.id });

      } catch (mdiError) {
        // ── Failed — increment retry count ─────────────────────
        record.retry_count = (record.retry_count || 0) + 1;
        record.last_error = mdiError.message;
        record.last_retry_at = new Date().toISOString();
        await store.setJSON(key, encryptRecord(record));

        console.error(`[RETRY MDI] ❌ Retry #${record.retry_count} failed for ${key}: ${mdiError.message}`);
        results.push({ key, status: 'retry_failed', retry_count: record.retry_count, error: mdiError.message });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ processed: results.length, results })
    };

  } catch (error) {
    console.error('[RETRY MDI] Fatal error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Retry processor failed' })
    };
  }
};

/**
 * Alert team about case status changes
 */
async function alertTeam(paymentIntentId, record, status) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) return;

  const emoji = status === 'recovered' ? '✅' : '🚨';
  const message = status === 'recovered'
    ? `Pending case RECOVERED successfully after ${record.retry_count} retries`
    : `Pending case PERMANENTLY FAILED after ${MAX_RETRIES} retries — manual intervention required`;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'retry_mdi_processor',
        event_type: `case_${status}`,
        severity: status === 'recovered' ? 'info' : 'critical',
        timestamp: new Date().toISOString(),
        payment_intent_id: paymentIntentId,
        patient_email: record.patient?.email || 'unknown',
        product: record.product || 'unknown',
        mdi_case_id: record.mdi_case_id || null,
        retry_count: record.retry_count,
        message: `${emoji} ${message}`
      })
    });
  } catch (e) {
    console.warn('[RETRY MDI] Alert webhook failed:', e.message);
  }
}
