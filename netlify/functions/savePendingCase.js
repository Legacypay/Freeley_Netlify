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

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://freeley.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const data = JSON.parse(event.body);
    const { payment_intent_id } = data;

    if (!payment_intent_id) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'payment_intent_id is required' }) };
    }

    // ── Save to Netlify Blobs ─────────────────────────────────
    const store = getStore('pending-mdi-cases');
    const record = {
      ...data,
      created_at: new Date().toISOString(),
      retry_count: 0,
      status: 'pending'
    };

    await store.setJSON(payment_intent_id, record);
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
      body: JSON.stringify({ error: 'Failed to save pending case' })
    };
  }
};
