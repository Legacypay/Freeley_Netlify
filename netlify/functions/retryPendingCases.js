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
const { resolveTestMode, buildVoucherPayload, parseVoucherResponse, demoMismatch } = require('./lib/mdi-voucher');
const { sweepUntaggedTestOrders } = require('./lib/mdi-tags');

const MAX_RETRIES = 10;

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://freeley.com'
  };

  // ── Safety net: tag full-flow test orders whose case now exists ──
  // (webhook tagging can miss when the order record lacks patient_id/case_id)
  let tagSweep = null;
  try {
    tagSweep = await sweepUntaggedTestOrders();
  } catch (e) {
    console.warn('[RETRY MDI] Test-case tag sweep failed (non-critical):', e.message);
  }

  try {
    const store = getStore('pending-mdi-cases');
    const { blobs } = await store.list();

    if (!blobs || blobs.length === 0) {
      console.log('[RETRY MDI] No pending cases found.');
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'No pending cases', count: 0, tag_sweep: tagSweep }) };
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

        // Build voucher payload — same test/live decision as submitQuiz.js.
        // SAFE BY DEFAULT: demo:true + "TEST CASE" metadata unless
        // MDI_LIVE_MODE=true AND MDI_ALLOW_LIVE_ORDERS=true (see lib/mdi-voucher.js).
        const testMode = resolveTestMode({ email: patientData.email });
        const voucherPayload = buildVoucherPayload({
          product,
          testMode,
          metadata: 'freeley:' + resolvedKey + (dose ? ':' + dose : '') + ' | retry'
        });

        console.log(`[RETRY MDI] Submitting voucher for ${key} | mode: ${testMode.isTest ? 'TEST' : 'LIVE'} (${testMode.reason}) | demo: ${testMode.demo} | env: ${voucherPayload.environment_id || 'n/a'}`);
        const result = await mdiRequest('POST', '/v1/partner/vouchers', voucherPayload);
        const parsed = parseVoucherResponse(result);
        if (!parsed.voucherId) {
          // 2xx without an id: the voucher probably exists. Do NOT retry (duplicates) —
          // park the record as orphaned for manual reconciliation.
          console.error(`[RETRY MDI] 🚨 MDI 2xx response had no voucher id for ${key} — marking orphaned:`, JSON.stringify(result).slice(0, 300));
          record.status = 'orphaned';
          record.orphaned_at = new Date().toISOString();
          record.mdi_raw_response = result;
          await store.setJSON(key, encryptRecord(record));
          await alertTeam(key, record, 'orphaned');
          results.push({ key, status: 'orphaned' });
          continue;
        }

        const mismatch = demoMismatch(testMode, parsed);
        if (mismatch) {
          console.error(`[RETRY MDI] 🚨 DEMO MISMATCH: requested demo:true, MDI echoed demo:${parsed.demo} for voucher ${parsed.voucherId}`);
        }

        // ── Success! Mark as completed ─────────────────────────
        record.status = 'completed';
        record.completed_at = new Date().toISOString();
        record.mdi_patient_id = parsed.patientId;
        record.mdi_case_id = parsed.voucherId;
        record.is_test = testMode.isTest;
        record.demo_mismatch = mismatch || undefined;
        await store.setJSON(key, encryptRecord(record));

        console.log(`[RETRY MDI] ✅ SUCCESS: ${key} → Patient: ${parsed.patientId}, Voucher: ${parsed.voucherId} (retry #${record.retry_count})`);

        // Store order↔encounter link for support lookups
        try {
          const orderStore = getStore('mdi-orders');
          await orderStore.setJSON(parsed.voucherId, {
            voucher_id: parsed.voucherId,
            patient_id: parsed.patientId,
            email: patientData.email,
            first_name: patientData.first_name,
            last_name: patientData.last_name,
            product_key: resolvedKey,
            original_product_key: productKey !== resolvedKey ? productKey : undefined,
            dose: dose || null,
            offering_id: product.offering_id,
            questionnaire_id: product.questionnaire_id,
            category: product.category,
            onboarding_url: parsed.onboardingUrl,
            environment: testMode.liveMode ? 'live' : 'sandbox',
            environment_id: parsed.environmentId,
            is_test: testMode.isTest,
            test_reason: testMode.isTest ? testMode.reason : undefined,
            demo: parsed.demo,
            demo_mismatch: mismatch || undefined,
            mdi_metadata: voucherPayload.metadata,
            case_id: parsed.caseId,
            created_at: new Date().toISOString(),
            retry_count: record.retry_count,
            source: 'retry'
          });
        } catch (orderErr) {
          console.warn(`[RETRY MDI] Failed to save order record (non-critical):`, orderErr.message);
        }

        // Notify team of successful recovery
        await alertTeam(key, record, mismatch ? 'demo_mismatch' : 'recovered');
        results.push({ key, status: 'completed', voucher_id: parsed.voucherId, is_test: testMode.isTest, demo: parsed.demo });

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
      body: JSON.stringify({ processed: results.length, results, tag_sweep: tagSweep })
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
  const messages = {
    recovered: `Pending case RECOVERED successfully after ${record.retry_count} retries`,
    permanently_failed: `Pending case PERMANENTLY FAILED after ${MAX_RETRIES} retries — manual intervention required`,
    orphaned: 'MDI returned 2xx without a voucher id — voucher may exist unrecorded. Reconcile manually in the MDI portal.',
    demo_mismatch: 'Requested demo:true but MDI did not echo it — possible BILLABLE encounter. Verify/tag in the MDI portal.'
  };
  const message = messages[status] || `Pending case status: ${status}`;

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
