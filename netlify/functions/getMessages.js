/**
 * Netlify Function: getMessages
 *
 * Fetches messages for a patient from MDI's Messaging API.
 * Uses the Partner bearer token to access patient messages.
 *
 * Tries multiple MDI endpoint patterns since the API may vary between
 * Partner and Patient namespaces:
 *   1. GET /v1/partner/patients/:patient/messages  (Partner scope)
 *   2. GET /v1/patient/patients/:patient/messages   (Patient scope, Partner token)
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

const { mdiRequest, getAccessToken, getCorsHeaders, BASE_URL } = require('./lib/mdi-client');
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

    // ── Step 3: Try multiple endpoint patterns ───────────────────
    const queryString = `channel=${channel}&page=${page}&per_page=${per_page}&order=${order}`;

    // MDI endpoint patterns to try (Partner token used for all)
    const endpoints = [
      `/v1/partner/patients/${patient_id}/messages?${queryString}`,
      `/v1/patient/patients/${patient_id}/messages?${queryString}`
    ];

    const token = await getAccessToken();
    let messagesData = null;
    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        console.log(`[GET MESSAGES] Trying: ${endpoint}`);
        const response = await fetch(BASE_URL + endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Version': '2'
          }
        });

        if (response.ok) {
          messagesData = await response.json();
          console.log(`[GET MESSAGES] Success via: ${endpoint}`);
          break;
        }

        const errText = await response.text();
        console.warn(`[GET MESSAGES] ${endpoint} returned ${response.status}: ${errText.slice(0, 200)}`);
        lastError = { status: response.status, text: errText };

      } catch (fetchErr) {
        console.warn(`[GET MESSAGES] Fetch error for ${endpoint}: ${fetchErr.message}`);
        lastError = { status: 500, text: fetchErr.message };
      }
    }

    if (messagesData !== null) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify(messagesData)
      };
    }

    // All endpoints failed
    console.error(`[GET MESSAGES] All endpoints failed. Last error: ${lastError?.status} ${lastError?.text?.slice(0, 200)}`);

    // If 404 on all endpoints, the patient may not have messaging enabled yet
    if (lastError?.status === 404) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ data: [], messages: [], total: 0, note: 'No messages found for this patient.' })
      };
    }

    return {
      statusCode: lastError?.status || 500,
      headers: cors,
      body: JSON.stringify({ error: 'Unable to fetch messages. Please try again.' })
    };

  } catch (error) {
    console.error('[GET MESSAGES] Error:', error);

    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Unable to fetch messages. Please try again.' })
    };
  }
};
