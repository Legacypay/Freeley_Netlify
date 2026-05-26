/**
 * Netlify Function: sendMessage
 *
 * Sends a message from a patient to their clinician via MDI's Patient Messaging API.
 * Requires a patient access_token obtained via the 2FA verification flow.
 *
 * POST /.netlify/functions/sendMessage
 * Headers: { Authorization: 'Bearer <firebase-id-token>' }
 * Body: {
 *   "patient_id": "uuid",
 *   "patient_token": "...",          // from validateMessagingCode
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
      patient_token,
      text,
      channel = 'patient',
      reference_message_id
    } = JSON.parse(event.body);

    if (!patient_id) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'patient_id is required.' }) };
    }
    if (!patient_token) {
      return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Messaging verification required.', code: 'VERIFICATION_REQUIRED' }) };
    }
    if (!text || !text.trim()) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Message text is required.' }) };
    }

    const sanitizedText = text.trim().slice(0, 5000);

    // ── Step 3: Send message via MDI Patient API ─────────────────
    const messagePayload = { channel, text: sanitizedText };
    if (reference_message_id) messagePayload.reference_message_id = reference_message_id;

    const messagesUrl = `${BASE_URL}/v1/patient/patients/${patient_id}/messages`;
    console.log(`[SEND MESSAGE] Sending message for patient: ${patient_id}`);

    const response = await fetch(messagesUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${patient_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2'
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
    console.error(`[SEND MESSAGE] MDI error (${response.status}): ${errText.slice(0, 200)}`);

    // Try partner fallback
    if (response.status === 401 || response.status === 403) {
      console.log(`[SEND MESSAGE] Trying partner token fallback...`);
      const partnerToken = await getAccessToken();
      const partnerUrl = `${BASE_URL}/v1/partner/patients/${patient_id}/messages`;

      const partnerResponse = await fetch(partnerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${partnerToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(messagePayload)
      });

      if (partnerResponse.ok) {
        const data = await partnerResponse.json();
        console.log(`[SEND MESSAGE] Partner fallback succeeded`);
        return { statusCode: 200, headers: cors, body: JSON.stringify(data) };
      }
    }

    return {
      statusCode: response.status === 401 ? 401 : 500,
      headers: cors,
      body: JSON.stringify({
        error: response.status === 401 ? 'Session expired. Please verify again.' : 'Unable to send message.',
        code: response.status === 401 ? 'TOKEN_EXPIRED' : 'SEND_ERROR'
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
