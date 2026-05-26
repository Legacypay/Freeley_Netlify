/**
 * Netlify Function: getMessages
 *
 * Fetches messages for a patient from MDI's Patient Messaging API.
 * Acts as a secure proxy — the patient bearer token is obtained server-side
 * via getPatientToken, then used to call MDI's messaging endpoint.
 *
 * POST /.netlify/functions/getMessages
 * Headers: { Authorization: 'Bearer <firebase-id-token>' }
 * Body: {
 *   "patient_id": "uuid",
 *   "channel": "patient",        // optional, defaults to "patient"
 *   "page": 1,                   // optional, defaults to 1
 *   "per_page": 25,              // optional, defaults to 25
 *   "order": "desc"              // optional, defaults to "desc"
 * }
 *
 * Returns: MDI messages array with sender info, timestamps, and content.
 */

const { getCorsHeaders, BASE_URL } = require('./lib/mdi-client');
const { verifyFirebaseToken } = require('./lib/verify-firebase-token');

// Import the patient token helper
const getPatientTokenModule = require('./getPatientToken');

/**
 * Get a patient bearer token by calling our getPatientToken function internally.
 * This avoids a network round-trip — we call it as a module.
 */
async function obtainPatientToken(event, patientId) {
  // Build a synthetic event to pass to getPatientToken handler
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

    // ── Step 2: Parse request ────────────────────────────────────
    const {
      patient_id,
      channel = 'patient',
      page = 1,
      per_page = 25,
      order = 'desc'
    } = JSON.parse(event.body);

    if (!patient_id) {
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ error: 'patient_id is required.' })
      };
    }

    // ── Step 3: Get patient bearer token ─────────────────────────
    const patientToken = await obtainPatientToken(event, patient_id);

    // ── Step 4: Fetch messages from MDI ──────────────────────────
    // GET /v1/patient/patients/:patient/messages?channel=patient&page=1&per_page=25&order=desc
    const queryParams = new URLSearchParams({
      channel,
      page: String(page),
      per_page: String(per_page),
      order
    });

    const messagesUrl = `${BASE_URL}/v1/patient/patients/${patient_id}/messages?${queryParams}`;
    console.log(`[GET MESSAGES] Fetching messages for patient: ${patient_id}, channel: ${channel}, page: ${page}`);

    const response = await fetch(messagesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${patientToken}`,
        'Accept': 'application/json',
        'Version': '2'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[GET MESSAGES] MDI API error (${response.status}): ${errText}`);

      if (response.status === 401) {
        // Token may have expired — clear cache and return auth error
        return {
          statusCode: 401,
          headers: cors,
          body: JSON.stringify({ error: 'Patient session expired. Please refresh.' })
        };
      }

      throw new Error(`MDI messages API error: ${response.status}`);
    }

    const messagesData = await response.json();
    console.log(`[GET MESSAGES] Retrieved messages for patient: ${patient_id}`);

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify(messagesData)
    };

  } catch (error) {
    console.error('[GET MESSAGES] Error:', error);

    return {
      statusCode: error.statusCode || 500,
      headers: cors,
      body: JSON.stringify({ error: error.message || 'Unable to fetch messages. Please try again.' })
    };
  }
};
