/**
 * Netlify Function: sendMessage
 *
 * Sends a message from a patient to their clinician via MDI's Messaging API.
 * Uses the Partner bearer token to send messages on behalf of the patient.
 *
 * Tries multiple MDI endpoint patterns:
 *   1. POST /v1/partner/patients/:patient/messages  (Partner scope)
 *   2. POST /v1/patient/patients/:patient/messages   (Patient scope, Partner token)
 *
 * POST /.netlify/functions/sendMessage
 * Headers: { Authorization: 'Bearer <firebase-id-token>' }
 * Body: {
 *   "patient_id": "uuid",
 *   "text": "Message content here",
 *   "channel": "patient",                // optional, defaults to "patient"
 *   "reference_message_id": "uuid"        // optional, for reply threading
 * }
 *
 * Returns: The created message object from MDI.
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
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ error: 'patient_id is required.' })
      };
    }

    if (!text || !text.trim()) {
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ error: 'Message text is required.' })
      };
    }

    // Sanitize: limit message length
    const sanitizedText = text.trim().slice(0, 5000);

    // ── Step 3: Build message payload ────────────────────────────
    const messagePayload = {
      channel,
      text: sanitizedText
    };

    if (reference_message_id) {
      messagePayload.reference_message_id = reference_message_id;
    }

    // ── Step 4: Try multiple endpoint patterns ───────────────────
    const endpoints = [
      `/v1/partner/patients/${patient_id}/messages`,
      `/v1/patient/patients/${patient_id}/messages`
    ];

    const token = await getAccessToken();
    let messageData = null;
    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        console.log(`[SEND MESSAGE] Trying: ${endpoint}`);
        const response = await fetch(BASE_URL + endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Version': '2'
          },
          body: JSON.stringify(messagePayload)
        });

        if (response.ok) {
          messageData = await response.json();
          console.log(`[SEND MESSAGE] Success via: ${endpoint}`);
          break;
        }

        const errText = await response.text();
        console.warn(`[SEND MESSAGE] ${endpoint} returned ${response.status}: ${errText.slice(0, 200)}`);
        lastError = { status: response.status, text: errText };

      } catch (fetchErr) {
        console.warn(`[SEND MESSAGE] Fetch error for ${endpoint}: ${fetchErr.message}`);
        lastError = { status: 500, text: fetchErr.message };
      }
    }

    if (messageData !== null) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify(messageData)
      };
    }

    // All endpoints failed
    console.error(`[SEND MESSAGE] All endpoints failed. Last error: ${lastError?.status}`);
    return {
      statusCode: lastError?.status || 500,
      headers: cors,
      body: JSON.stringify({ error: 'Unable to send message. Please try again.' })
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
