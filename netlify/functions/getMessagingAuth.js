/**
 * Netlify Function: getMessagingAuth
 *
 * Generates a one-time-use, pre-authenticated messaging link for a patient
 * to communicate with their assigned clinician via MDI's secure messaging.
 *
 * REQUIRES a valid Firebase ID token in the Authorization header (HIPAA).
 *
 * POST /.netlify/functions/getMessagingAuth
 * Headers: { Authorization: 'Bearer <firebase-id-token>' }
 * Body:    { "patient_id": "uuid-here" }
 *
 * Returns:
 * {
 *   "auth_link": "https://app.mdintegrations.com/messaging?token=...",
 *   "verification_code": "abc123",
 *   "expires_in": 3600
 * }
 *
 * The auth_link requires the verification_code to be inserted to access it.
 * Either embed the page on your site (iframe) or redirect the patient to it.
 *
 * MDI API Reference:
 *   GET /v1/partner/patients/:patient/auth
 *   → Returns { auth_link, verification_code }
 */

const { mdiRequest, getCorsHeaders } = require('./lib/mdi-client');
const { verifyFirebaseToken } = require('./lib/verify-firebase-token');

exports.handler = async (event) => {
  const cors = getCorsHeaders(event);

  // Handle CORS preflight
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
      console.warn('[MESSAGING AUTH] Unauthorized — no valid Firebase token');
      return {
        statusCode: 401,
        headers: cors,
        body: JSON.stringify({ error: 'Authentication required. Please sign in.' })
      };
    }

    console.log(`[MESSAGING AUTH] Authenticated user: ${user.email}`);

    // ── Step 2: Parse and validate request ───────────────────────
    const { patient_id } = JSON.parse(event.body);

    if (!patient_id) {
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ error: 'patient_id is required.' })
      };
    }

    // ── Step 3: Call MDI auth endpoint ────────────────────────────
    // GET /v1/partner/patients/:patient/auth
    // Returns a one-time-use auth_link + verification_code
    const authData = await mdiRequest(
      'GET',
      `/v1/partner/patients/${patient_id}/auth`
    );

    console.log(`[MESSAGING AUTH] ✅ Auth link generated for patient: ${patient_id}`);

    // ── Step 4: Return the auth link and verification code ───────
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        auth_link: authData.auth_link,
        verification_code: authData.verification_code,
        // Pass through any other fields MDI returns (expiry, etc.)
        ...(authData.expires_in ? { expires_in: authData.expires_in } : {}),
        patient_id
      })
    };

  } catch (error) {
    console.error('[MESSAGING AUTH] Error:', error);

    if (error.statusCode === 404) {
      return {
        statusCode: 404,
        headers: cors,
        body: JSON.stringify({ error: 'Patient not found. Please contact support.' })
      };
    }

    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Unable to generate messaging link. Please try again.' })
    };
  }
};
