/**
 * Netlify Function: savePendingCase
 * 
 * Called when a patient's payment succeeds but MDI case creation fails.
 * Persists the submission data to Netlify Blobs for automatic retry.
 * Also fires an URGENT alert to the n8n webhook so the team knows immediately.
 * 
 * POST /.netlify/functions/savePendingCase
 * Body: { payment_intent_id, patient, product, quiz_answers, ... }
 */

const { getStore } = require('@netlify/blobs');
const { encryptRecord } = require('./lib/phi-crypto');
const { getCorsHeaders, resolveMdiEnvironment } = require('./lib/mdi-client');
const { validateQuizSubmission } = require('./lib/validate-quiz');

exports.handler = async (event) => {
  const headers = { ...getCorsHeaders(event), 'Content-Type': 'application/json' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    let data;
    try {
      data = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    const { payment_intent_id } = data;

    if (!payment_intent_id || typeof payment_intent_id !== 'string' || payment_intent_id.length > 200) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'payment_intent_id is required' }) };
    }

    // Same validation as submitQuiz — reject malformed PHI before persisting.
    const v = validateQuizSubmission(data);
    if (!v.ok) {
      console.warn('[PENDING CASE] Validation failed:', v.error);
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid submission.' }) };
    }

    // ── Save to Netlify Blobs (PHI encrypted at rest) ─────────
    const store = getStore('pending-mdi-cases');
    // Stamp the environment now — retryPendingCases honors it instead of
    // re-reading MDI_LIVE_MODE, so a queued test never gets promoted to live.
    const isTest = data.is_test === true;
    const record = {
      ...data,
      environment: resolveMdiEnvironment({ isTest }).name,
      is_test: isTest,
      created_at: new Date().toISOString(),
      retry_count: 0,
      status: 'pending'
    };

    let encrypted;
    try {
      encrypted = encryptRecord(record);
    } catch (e) {
      console.error('[PENDING CASE] CRITICAL: PHI encryption failed:', e.message);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to save pending case' }) };
    }

    await store.setJSON(payment_intent_id, encrypted);
    console.log(`[PENDING CASE] ⚠️ Saved pending case for payment: ${payment_intent_id}`);

    // ── URGENT alert to internal webhook ──────────────────────
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'pending_case_alert',
            event_type: 'URGENT_mdi_submission_failed',
            severity: 'critical',
            timestamp: new Date().toISOString(),
            payment_intent_id,
            patient_email: data.patient?.email || 'unknown',
            product: data.product || 'unknown',
            message: 'Patient PAID but MDI case creation FAILED. Queued for auto-retry. Manual intervention may be needed.'
          })
        });
      } catch (e) {
        console.error('[PENDING CASE] Alert webhook failed:', e.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ saved: true, payment_intent_id })
    };

  } catch (error) {
    console.error('[PENDING CASE] Error saving:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Unable to save pending case. Please contact support.' })
    };
  }
};
