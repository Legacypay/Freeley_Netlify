/**
 * Netlify Function: getMessages
 *
 * Fetches messages for a patient from MDI's Partner Messaging API.
 * Uses the Partner token (server-side) for authentication — no patient 2FA needed.
 * Patient identity is verified via Firebase ID token.
 *
 * POST /.netlify/functions/getMessages
 * Headers: { Authorization: 'Bearer <firebase-id-token>' }
 * Body: {
 *   "patient_id": "uuid",
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

    // ── Step 3: Fetch messages using Partner token ───────────────
    const partnerToken = await getAccessToken();
    const queryString = `channel=${channel}&page=${page}&per_page=${per_page}&order=${order}`;
    const messagesUrl = `${BASE_URL}/v1/partner/patients/${patient_id}/messages?${queryString}`;

    console.log(`[GET MESSAGES] Fetching messages for patient: ${patient_id}, channel: ${channel}, page: ${page}`);

    const response = await fetch(messagesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${partnerToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Version': '2'
      }
    });

    if (response.ok) {
      const messagesData = await response.json();
      console.log(`[GET MESSAGES] Success for patient: ${patient_id}, messages: ${Array.isArray(messagesData) ? messagesData.length : (messagesData.data || []).length}`);
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify(messagesData)
      };
    }

    const errText = await response.text();
    console.warn(`[GET MESSAGES] MDI returned ${response.status}: ${errText.slice(0, 300)}`);

    // Return empty if 404 (no messages yet)
    if (response.status === 404) {
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ data: [], messages: [], total: 0 })
      };
    }

    return {
      statusCode: response.status >= 500 ? 502 : response.status,
      headers: cors,
      body: JSON.stringify({
        error: 'Unable to fetch messages. Please try again.',
        code: 'FETCH_ERROR'
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
