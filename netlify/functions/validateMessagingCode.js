/**
 * Netlify Function: validateMessagingCode
 *
 * Validates the patient's 2FA code and obtains a patient-scoped access token
 * for the messaging API.
 *
 * Two-step validation:
 *   1. Partner API: POST /v1/partner/patients/auth/2fa/validate
 *      → Returns the patient object (confirms identity, gives us patient_id)
 *   2. Patient API: POST /v1/patient/auth/2fa/validate
 *      → Returns a patient bearer token for messaging API calls
 *
 * POST /.netlify/functions/validateMessagingCode
 * Headers: { Authorization: 'Bearer <supabase-access-token>' }
 * Body:    { "email": "patient@email.com", "verification_code": "ABC123" }
 *
 * Returns: { "access_token": "...", "patient_id": "...", "patient_name": "..." }
 */

const { getAccessToken, getCorsHeaders, BASE_URL, mdiRequest } = require('./lib/mdi-client');
const { verifySupabaseToken } = require('./lib/verify-supabase-token');
const { verifyPatientOwnership } = require('./lib/mdi-order-ownership');

// Cache patient tokens server-side (per cold-start instance)
// Key: email, Value: { access_token, patient_id, expires_at }
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
      return {
        statusCode: 401,
        headers: cors,
        body: JSON.stringify({ error: 'Authentication required. Please sign in.' })
      };
    }

    // ── Step 2: Parse request ────────────────────────────────────
    const { email, verification_code, patient_id } = JSON.parse(event.body);

    if (!email || !verification_code) {
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ error: 'Email and verification code are required.' })
      };
    }

    // The email being validated must be the session's own email, or the MDI
    // email of a patient record this session owns (requestMessagingCode can
    // resolve a different MDI email for an owned patient_id). Anything else is
    // an attempt to validate a code for somebody else's chart.
    const sessionEmail = String(user.email || '').toLowerCase().trim();
    const requestedEmail = String(email).toLowerCase().trim();
    let emailAllowed = requestedEmail === sessionEmail;
    if (!emailAllowed && patient_id && await verifyPatientOwnership(patient_id, user.email, '[VALIDATE CODE]')) {
      try {
        const p = await mdiRequest('GET', '/v1/partner/patients/' + encodeURIComponent(patient_id));
        emailAllowed = String(p && p.email || '').toLowerCase().trim() === requestedEmail;
      } catch (e) {
        console.warn('[VALIDATE CODE] MDI patient lookup failed:', e.message.slice(0, 120));
      }
    }
    if (!emailAllowed) {
      console.warn('[VALIDATE CODE] Refusing: email does not belong to the session user');
      return { statusCode: 403, headers: cors, body: JSON.stringify({ error: 'You can only verify your own account.' }) };
    }

    // ── Step 3: Validate with Partner API first ──────────────────
    // POST /v1/partner/patients/auth/2fa/validate
    // Returns the patient object (name, patient_id, etc.)
    const partnerToken = await getAccessToken();

    console.log(`[VALIDATE CODE] Validating code for: ${email}`);

    const partnerResponse = await fetch(BASE_URL + '/v1/partner/patients/auth/2fa/validate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${partnerToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, verification_code })
    });

    if (!partnerResponse.ok) {
      const errText = await partnerResponse.text();
      console.error(`[VALIDATE CODE] Partner validation failed (${partnerResponse.status}): ${errText}`);

      if (partnerResponse.status === 422 || partnerResponse.status === 400) {
        return {
          statusCode: 400,
          headers: cors,
          body: JSON.stringify({ error: 'Invalid verification code. Please check and try again.' })
        };
      }

      throw new Error(`Partner 2FA validation failed: ${partnerResponse.status}`);
    }

    const patientData = await partnerResponse.json();
    console.log(`[VALIDATE CODE] Partner validation successful for: ${email}`);

    // Extract patient_id from the response
    const patientId = patientData.id || patientData.patient_id;

    // ── Step 4: Get patient bearer token via Patient API ─────────
    // POST /v1/patient/auth/2fa/validate
    // Uses the same code (it may still be valid for the Patient API)
    console.log(`[VALIDATE CODE] Requesting patient bearer token for: ${email}`);

    const patientAuthResponse = await fetch(BASE_URL + '/v1/patient/auth/2fa/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2'
      },
      body: JSON.stringify({ email, verification_code })
    });

    let patientAccessToken = null;

    if (patientAuthResponse.ok) {
      const tokenData = await patientAuthResponse.json();
      patientAccessToken = tokenData.access_token || tokenData.token;
      console.log(`[VALIDATE CODE] Patient bearer token obtained for: ${email}`);
    } else {
      // Patient API token may not work with same code — fall back to partner token approach
      const errText = await patientAuthResponse.text();
      console.warn(`[VALIDATE CODE] Patient token request failed (${patientAuthResponse.status}): ${errText.slice(0, 200)}`);
      console.log(`[VALIDATE CODE] Will use partner token fallback for messaging`);
    }

    // ── Step 5: Cache and return ─────────────────────────────────
    const result = {
      patient_id: patientId,
      patient_name: patientData.first_name ? `${patientData.first_name} ${patientData.last_name || ''}`.trim() : null,
      email: patientData.email || email,
      verified: true
    };

    if (patientAccessToken) {
      result.access_token = patientAccessToken;
      result.token_type = 'patient';

      // Cache the token
      patientTokenCache[email] = {
        access_token: patientAccessToken,
        patient_id: patientId,
        expires_at: Date.now() + (3600 * 1000) // 1 hour
      };
    } else {
      result.token_type = 'partner_verified';
      // Store that this patient is verified (partner token will be used)
      patientTokenCache[email] = {
        access_token: null, // Will use partner token
        patient_id: patientId,
        verified: true,
        expires_at: Date.now() + (3600 * 1000)
      };
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('[VALIDATE CODE] Error:', error);

    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Verification failed. Please try again.' })
    };
  }
};

// Export cache for use by getMessages/sendMessage
exports.patientTokenCache = patientTokenCache;
