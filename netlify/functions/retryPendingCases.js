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
 *     schedule = "*/15 * * * *"
 */

const { getStore } = require('@netlify/blobs');
const { mdiRequest } = require('./lib/mdi-client');
const { PRODUCTS, getPharmacyId } = require('./lib/products');

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
      let record;

      try {
        record = await store.get(key, { type: 'json' });
      } catch (e) {
        console.error(`[RETRY MDI] Failed to read blob ${key}:`, e.message);
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
        await store.setJSON(key, record);

        // Alert team about permanent failure
        await alertTeam(key, record, 'permanently_failed');
        results.push({ key, status: 'permanently_failed' });
        continue;
      }

      // ── Attempt MDI submission ───────────────────────────────
      try {
        const { patient: patientData, product: productKey, quiz_answers, allergies, current_medications, medical_conditions } = record;

        if (!patientData || !productKey || !PRODUCTS[productKey]) {
          console.error(`[RETRY MDI] Invalid record for ${key}: missing patient or product`);
          record.status = 'invalid';
          await store.setJSON(key, record);
          results.push({ key, status: 'invalid' });
          continue;
        }

        const product = PRODUCTS[productKey];
        const pharmacyId = getPharmacyId(productKey);

        // MDI Partner ID
        const MDI_PARTNER_ID = process.env.MDI_PARTNER_ID || 'f81508d1-3c53-4849-a636-1e9050a68e00';

        // Build patient object for voucher endpoint
        const patient = {
          first_name: patientData.first_name,
          last_name: patientData.last_name,
          email: patientData.email,
          date_of_birth: patientData.date_of_birth || null,
          gender: patientData.gender || 0,
          phone_number: patientData.phone_number || '',
          phone_type: '2',
          address: {
            address: patientData.address || '',
            address2: patientData.address2 || null,
            city_name: patientData.city || '',
            state_name: patientData.state || '',
            zip_code: patientData.zip_code || ''
          }
        };

        if (patientData.weight) patient.weight = patientData.weight;
        if (patientData.height) patient.height = patientData.height;

        // Build case questions from quiz answers
        const caseQuestions = (quiz_answers || []).map((qa, idx) => ({
          question: qa.question,
          answer: String(qa.answer),
          type: qa.type || 'string',
          important: qa.important !== undefined ? qa.important : true,
          display_in_pdf: true,
          label: 'Q' + (idx + 1),
          metadata: 'freeley-quiz-' + productKey
        }));

        // Build case object
        // NOTE: case_prescriptions left empty — MDI offerings don't have
        // partner_compound_id set. Use top-level offerings[] array instead.
        const caseObj = {
          metadata: 'freeley|' + productKey + '|' + patientData.email + '|' + Date.now() + '|retry-' + record.retry_count,
          is_additional_approval_needed: null,
          case_prescriptions: [],
          case_questions: caseQuestions,
          case_files: [],
          diseases: product.icd10 ? [{ icd10_code: product.icd10 }] : []
        };

        // Build completion_time (HH:MM:SS format, required by MDI)
        const now2 = new Date();
        const completionTime = String(now2.getHours()).padStart(2, '0') + ':' +
                               String(now2.getMinutes()).padStart(2, '0') + ':' +
                               String(now2.getSeconds()).padStart(2, '0');

        // Single API call: POST /v1/partner/vouchers
        const voucherPayload = {
          questionnaire_id: product.questionnaire_id,
          completion_time: completionTime,
          preferred_pharmacy_id: pharmacyId || null,
          patient: patient,
          case: caseObj,
          offerings: [{ id: product.offering_id }]
        };

        const result = await mdiRequest('POST', '/v1/partner/vouchers', voucherPayload);

        // ── Success! Mark as completed ─────────────────────────
        record.status = 'completed';
        record.completed_at = new Date().toISOString();
        record.mdi_patient_id = result.patient_id;
        record.mdi_case_id = result.id;
        await store.setJSON(key, record);

        console.log(`[RETRY MDI] ✅ SUCCESS: ${key} → Patient: ${result.patient_id}, Case: ${result.id} (retry #${record.retry_count})`);

        // Notify team of successful recovery
        await alertTeam(key, record, 'recovered');
        results.push({ key, status: 'completed', case_id: caseResult.case_id });

      } catch (mdiError) {
        // ── Failed — increment retry count ─────────────────────
        record.retry_count = (record.retry_count || 0) + 1;
        record.last_error = mdiError.message;
        record.last_retry_at = new Date().toISOString();
        await store.setJSON(key, record);

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
      body: JSON.stringify({ error: 'Retry processor failed: ' + error.message })
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
