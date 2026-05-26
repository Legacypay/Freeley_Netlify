/**
 * Netlify Function: getMessages
 *
 * Fetches messages for a patient from MDI's Patient Messaging API.
 * Requires a patient access_token obtained via the 2FA verification flow.
 *
 * POST /.netlify/functions/getMessages
 * Headers: { Authorization: 'Bearer <firebase-id-token>' }
 * Body: {
 *   "patient_id": "uuid",
 *   "patient_token": "...",          // from validateMessagingCode
 *   "channel": "patient",            // optional, defaults to "patient"
 *   "page": 1,                       // optional
 *   "per_page": 25,                  // optional
 *   "order": "desc"                  // optional
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

    // ── Step 2: Parse request ────────────────────────────────────
    const {
      patient_id,
      patient_token,
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

    if (!patient_token) {
      return {
        statusCode: 401,
        headers: cors,
        body: JSON.stringify({
          error: 'Messaging verification required.',
          code: 'VERIFICATION_REQUIRED'
        })
      };
    }

    // ── Step 3: Fetch messages from MDI ──────────────────────────
    const queryString = `channel=${channel}&page=${page}&per_page=${per_page}&order=${order}`;
    const messagesUrl = `${BASE_URL}/v1/patient/patients/${patient_id}/messages?${queryString}`;

    console.log(`[GET MESSAGES] Fetching messages for patient: ${patient_id}, channel: ${channel}, page: ${page}`);

    const response = await fetch(messagesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${patient_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Version': '2'
      }
    });

    if (response.ok) {
      const messagesData = await response.json();
      console.log(`[GET MESSAGES] Success for patient: ${patient_id}`);
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify(messagesData)
      };
    }

    const errText = await response.text();
    console.warn(`[GET MESSAGES] Patient endpoint returned ${response.status}: ${errText.slice(0, 200)}`);

    // If patient token doesn't work, try partner token as fallback
    if (response.status === 401 || response.status === 403) {
      console.log(`[GET MESSAGES] Trying with partner token as fallback...`);
      const partnerToken = await getAccessToken();

      // Try partner endpoint for messages
      const partnerUrl = `${BASE_URL}/v1/partner/patients/${patient_id}/messages?${queryString}`;
      const partnerResponse = await fetch(partnerUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${partnerToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (partnerResponse.ok) {
        const data = await partnerResponse.json();
        console.log(`[GET MESSAGES] Partner fallback succeeded`);
        return {
          statusCode: 200,
          headers: cors,
          body: JSON.stringify(data)
        };
      }

      console.warn(`[GET MESSAGES] Partner fallback also failed: ${partnerResponse.status}`);
    }

    // Return empty if 404 (no messages yet)
    if (response.status === 404) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ data: [], messages: [], total: 0 })
      };
    }

    return {
      statusCode: response.status === 401 ? 401 : 500,
      headers: cors,
      body: JSON.stringify({
        error: response.status === 401 ? 'Session expired. Please verify again.' : 'Unable to fetch messages.',
        code: response.status === 401 ? 'TOKEN_EXPIRED' : 'FETCH_ERROR'
      })
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
