/**
 * Netlify Function: requestMessagingCode
 *
 * Triggers MDI's Partner 2FA flow to send a one-time verification code
 * to the patient's email. This is the first step of the patient messaging
 * authentication flow.
 *
 * POST /.netlify/functions/requestMessagingCode
 * Headers: { Authorization: 'Bearer <firebase-id-token>' }
 * Body:    { "email": "patient@email.com" }
 *
 * MDI Endpoint: POST /v1/partner/patients/auth/2fa
 * Body:         { "email": "patient@email.com" }
 * Returns:      [] (empty array on success — code is sent via email)
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
    const { email } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ error: 'Email is required.' })
      };
    }

    // ── Step 3: Call MDI Partner 2FA endpoint ─────────────────────
    // POST /v1/partner/patients/auth/2fa
    // Sends a one-time verification code to the patient's email
    const token = await getAccessToken();

    console.log(`[MESSAGING CODE] Sending verification code to: ${email}`);

    const response = await fetch(BASE_URL + '/v1/partner/patients/auth/2fa', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[MESSAGING CODE] MDI 2FA request failed (${response.status}): ${errText}`);

      if (response.status === 404 || response.status === 422) {
        return {
          statusCode: 404,
          headers: cors,
          body: JSON.stringify({
            error: 'No patient account found with this email. Please complete your intake first.',
            code: 'PATIENT_NOT_FOUND'
          })
        };
      }

      throw new Error(`MDI 2FA request failed: ${response.status}`);
    }

    console.log(`[MESSAGING CODE] Verification code sent to: ${email}`);

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        success: true,
        message: 'Verification code sent to your email.'
      })
    };

  } catch (error) {
    console.error('[MESSAGING CODE] Error:', error);

    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Unable to send verification code. Please try again.' })
    };
  }
};
