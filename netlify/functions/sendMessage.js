/**
 * Netlify Function: sendMessage
 *
 * Sends a message from a patient to their clinician via MDI's Partner Messaging API.
 * Uses the Partner token (server-side) for authentication — no patient 2FA needed.
 * Patient identity is verified via Firebase ID token.
 *
 * POST /.netlify/functions/sendMessage
 * Headers: { Authorization: 'Bearer <firebase-id-token>' }
 * Body: {
 *   "patient_id": "uuid",
 *   "text": "Message content",
 *   "channel": "patient"             // optional
 * }
 */

const { getAccessToken, getCorsHeaders, BASE_URL } = require('./lib/mdi-client');
const { verifyFirebaseToken } = require('./lib/verify-firebase-token');

exports.handler = async (event) => {
  const cors = getCorsHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: cors,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // ── Step 1: Verify Firebase authentication ──────────────────
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const user = await verifyFirebaseToken(idToken);
    if (!user) {
      return {
        statusCode: 401,
        headers: cors,
        body: JSON.stringify({ error: 'Authentication required. Please sign in.' })
      };
    }

    // ── Step 2: Parse and validate request ───────────────────────
    const {
      patient_id,
      text,
      channel = 'patient',
      reference_message_id
    } = JSON.parse(event.body);

    if (!patient_id) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'patient_id is required.' }) };
    }
    if (!text || !text.trim()) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Message text is required.' }) };
    }

    const sanitizedText = text.trim().slice(0, 5000);

    // ── Step 3: Send message via MDI Partner API ─────────────────
    const partnerToken = await getAccessToken();
    const messagePayload = { channel, text: sanitizedText };
    if (reference_message_id) messagePayload.reference_message_id = reference_message_id;

    const messagesUrl = `${BASE_URL}/v1/partner/patients/${patient_id}/messages`;
    console.log(`[SEND MESSAGE] Sending message for patient: ${patient_id}`);

    const response = await fetch(messagesUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${partnerToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(messagePayload)
    });

    if (response.ok) {
      const messageData = await response.json();
      console.log(`[SEND MESSAGE] Message sent for patient: ${patient_id}`);
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify(messageData)
      };
    }

    const errText = await response.text();
    console.error(`[SEND MESSAGE] MDI error (${response.status}): ${errText.slice(0, 300)}`);

    return {
      statusCode: response.status >= 500 ? 502 : response.status,
      headers: cors,
      body: JSON.stringify({
        error: 'Unable to send message. Please try again.',
        code: 'SEND_ERROR'
      })
    };

  } catch (error) {
    console.error('[SEND MESSAGE] Error:', error);
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Unable to send message. Please try again.' })
    };
  }
};
