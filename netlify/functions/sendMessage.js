/**
 * Netlify Function: sendMessage
 *
 * Sends a message from a patient to their clinician via MDI's Patient Messaging API.
 * Acts as a secure proxy — the patient bearer token is obtained server-side.
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

const { getCorsHeaders, BASE_URL } = require('./lib/mdi-client');
const { verifyFirebaseToken } = require('./lib/verify-firebase-token');

// Import the patient token helper
const getPatientTokenModule = require('./getPatientToken');

async function obtainPatientToken(event, patientId) {
  const syntheticEvent = {
    httpMethod: 'POST',
    headers: event.headers,
    body: JSON.stringify({ patient_id: patientId })
  };

  const result = await getPatientTokenModule.handler(syntheticEvent);

  if (result.statusCode !== 200) {
    const errData = JSON.parse(result.body);
    const error = new Error(errData.error || 'Failed to obtain patient token');
    error.statusCode = result.statusCode;
    throw error;
  }

  return JSON.parse(result.body).access_token;
}

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

    // ── Step 3: Get patient bearer token ─────────────────────────
    const patientToken = await obtainPatientToken(event, patient_id);

    // ── Step 4: Send message via MDI ─────────────────────────────
    // POST /v1/patient/patients/:patient/messages
    // Body: { channel*, text, reference_message_id?, files?, notified_model_type?, notified_model_id? }
    const messagePayload = {
      channel,
      text: sanitizedText
    };

    if (reference_message_id) {
      messagePayload.reference_message_id = reference_message_id;
    }

    const messagesUrl = `${BASE_URL}/v1/patient/patients/${patient_id}/messages`;
    console.log(`[SEND MESSAGE] Sending message for patient: ${patient_id}, channel: ${channel}`);

    const response = await fetch(messagesUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${patientToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2'
      },
      body: JSON.stringify(messagePayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[SEND MESSAGE] MDI API error (${response.status}): ${errText}`);

      if (response.status === 401) {
        return {
          statusCode: 401,
          headers: cors,
          body: JSON.stringify({ error: 'Patient session expired. Please refresh.' })
        };
      }

      throw new Error(`MDI send message error: ${response.status}`);
    }

    const messageData = await response.json();
    console.log(`[SEND MESSAGE] Message sent for patient: ${patient_id}`);

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify(messageData)
    };

  } catch (error) {
    console.error('[SEND MESSAGE] Error:', error);

    return {
      statusCode: error.statusCode || 500,
      headers: cors,
      body: JSON.stringify({ error: error.message || 'Unable to send message. Please try again.' })
    };
  }
};
