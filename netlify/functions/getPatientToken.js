/**
 * Netlify Function: getPatientToken
 *
 * Obtains a patient-scoped bearer token from MDI so the frontend can
 * call Patient API endpoints (messaging, etc.) through our proxy functions.
 *
 * Flow:
 *   1. Verify Supabase auth (HIPAA requirement)
 *   2. Call Partner API → GET /v1/partner/patients/:patient/auth
 *      → returns { auth_link, verification_code }
 *   3. Validate via POST /v1/patient/auth/2fa/validate
 *      → returns patient bearer token (access_token)
 *   4. Return the token to the caller (our other Netlify functions or frontend)
 *
 * POST /.netlify/functions/getPatientToken
 * Headers: { Authorization: 'Bearer <supabase-access-token>' }
 * Body:    { "patient_id": "uuid-here" }
 *
 * Returns: { "access_token": "...", "patient_id": "...", "expires_in": 3600 }
 */

const { mdiRequest, getCorsHeaders, BASE_URL } = require('./lib/mdi-client');
const { verifySupabaseToken } = require('./lib/verify-supabase-token');
const { verifyPatientOwnership } = require('./lib/mdi-order-ownership');

// Simple in-memory cache for patient tokens (per cold-start instance)
// Key: patient_id, Value: { access_token, expires_at }
const patientTokenCache = {};

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
    // ── Step 1: Verify Supabase authentication ──────────────────
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const user = await verifySupabaseToken(idToken);
    if (!user) {
      console.warn('[PATIENT TOKEN] Unauthorized — no valid Supabase token');
      return {
        statusCode: 401,
        headers: cors,
        body: JSON.stringify({ error: 'Authentication required. Please sign in.' })
      };
    }

    console.log(`[PATIENT TOKEN] Authenticated user: ${user.email}`);

    // ── Step 2: Parse request ────────────────────────────────────
    const { patient_id } = JSON.parse(event.body);

    if (!patient_id) {
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ error: 'patient_id is required.' })
      };
    }

    // ── Step 2a: Ownership — this patient_id must belong to the signed-in
    // user (order record or MDI patient email match). Without this, any
    // signed-in patient could mint a live MDI token for someone else's record.
    if (!(await verifyPatientOwnership(patient_id, user.email, '[PATIENT TOKEN]'))) {
      return {
        statusCode: 404, // same shape as "not found" — never an ownership oracle
        headers: cors,
        body: JSON.stringify({ error: 'Patient record not found.' })
      };
    }

    // ── Step 2b: Check cache ─────────────────────────────────────
    const cached = patientTokenCache[patient_id];
    if (cached && cached.expires_at > Date.now() + 60000) {
      console.log(`[PATIENT TOKEN] Returning cached token for patient: ${patient_id}`);
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          access_token: cached.access_token,
          patient_id,
          expires_in: Math.floor((cached.expires_at - Date.now()) / 1000),
          cached: true
        })
      };
    }

    // ── Step 3: Get auth credentials from Partner API ────────────
    // GET /v1/partner/patients/:patient/auth
    // Returns { auth_link, verification_code }
    console.log(`[PATIENT TOKEN] Requesting auth credentials for patient: ${patient_id}`);
    const authData = await mdiRequest(
      'GET',
      `/v1/partner/patients/${patient_id}/auth`
    );

    console.log(`[PATIENT TOKEN] Got auth_link and verification_code for patient: ${patient_id}`);

    if (!authData.verification_code) {
      throw new Error('MDI did not return a verification_code');
    }

    // ── Step 4: Validate 2FA to get patient bearer token ─────────
    // POST /v1/patient/auth/2fa/validate
    // Body: { email, verification_code, voucher_id? }
    // Returns: { access_token, token_type, expires_in }
    //
    // We extract the email from the auth_link URL or use the Supabase user email.
    // MDI's auth_link typically contains the patient email as a query parameter.
    let patientEmail = user.email;

    // Try to extract email from auth_link if available
    if (authData.auth_link) {
      try {
        const url = new URL(authData.auth_link);
        const emailParam = url.searchParams.get('email');
        // Only accept it when it IS the verified user's email (case-insensitive):
        // ownership was proven above, so a different address here is MDI data we
        // must not act on.
        if (emailParam && emailParam.trim().toLowerCase() === String(user.email || '').trim().toLowerCase()) patientEmail = emailParam.trim();
      } catch { /* use Supabase email */ }
    }

    console.log(`[PATIENT TOKEN] Validating 2FA for: ${patientEmail}`);

    const validateResponse = await fetch(BASE_URL + '/v1/patient/auth/2fa/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2'
      },
      body: JSON.stringify({
        email: patientEmail,
        verification_code: authData.verification_code
      })
    });

    if (!validateResponse.ok) {
      const errText = await validateResponse.text();
      console.error(`[PATIENT TOKEN] 2FA validation failed (${validateResponse.status}): ${errText}`);
      throw new Error(`Patient auth validation failed: ${validateResponse.status}`);
    }

    const tokenData = await validateResponse.json();
    console.log(`[PATIENT TOKEN] Patient token obtained for: ${patient_id}`);

    // Extract the access token — MDI may return different shapes
    const accessToken = tokenData.access_token || tokenData.token || tokenData;

    if (!accessToken || typeof accessToken !== 'string') {
      console.error('[PATIENT TOKEN] Unexpected token response:', JSON.stringify(tokenData).slice(0, 200));
      throw new Error('Could not extract patient access token from MDI response');
    }

    const expiresIn = tokenData.expires_in || 3600;

    // ── Step 5: Cache and return ─────────────────────────────────
    patientTokenCache[patient_id] = {
      access_token: accessToken,
      expires_at: Date.now() + (expiresIn * 1000)
    };

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        access_token: accessToken,
        patient_id,
        expires_in: expiresIn
      })
    };

  } catch (error) {
    console.error('[PATIENT TOKEN] Error:', error);

    if (error.statusCode === 404) {
      return {
        statusCode: 404,
        headers: cors,
        body: JSON.stringify({ error: 'Patient not found.' })
      };
    }

    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Unable to authenticate patient. Please try again.' })
    };
  }
};
