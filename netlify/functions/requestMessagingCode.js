/**
 * Netlify Function: requestMessagingCode
 *
 * Triggers MDI's Partner 2FA flow to send a one-time verification code
 * to the patient's email. This is the first step of the patient messaging
 * authentication flow.
 *
 * POST /.netlify/functions/requestMessagingCode
 * Headers: { Authorization: 'Bearer <supabase-access-token>' }
 * Body:    { "email": "patient@email.com" }
 *
 * MDI Endpoint: POST /v1/partner/patients/auth/2fa
 * Body:         { "email": "patient@email.com" }
 * Returns:      [] (empty array on success — code is sent via email)
 */

const { mdiRequest, getAccessToken, getCorsHeaders, BASE_URL } = require('./lib/mdi-client');
const { verifySupabaseToken } = require('./lib/verify-supabase-token');
const { verifyPatientOwnership } = require('./lib/mdi-order-ownership');

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
    const { patient_id } = JSON.parse(event.body);

    const token = await getAccessToken();

    // Resolve patient email — prefer MDI's record for a patient_id the caller OWNS
    // (the MDI email may differ from the Supabase login email); otherwise the
    // verified session email. A client-supplied email is never trusted: it would
    // let any signed-in user trigger 2FA codes to (and enumerate) other patients.
    let email = null;

    if (patient_id && !(await verifyPatientOwnership(patient_id, user.email, '[MESSAGING CODE]'))) {
      console.warn('[MESSAGING CODE] patient_id not owned by session user — ignoring it');
    } else if (patient_id) {
      console.log(`[MESSAGING CODE] Looking up MDI patient email for ${patient_id}`);
      try {
        const patientRes = await fetch(`${BASE_URL}/v1/partner/patients/${patient_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        if (patientRes.ok) {
          const patientData = await patientRes.json();
          email = patientData.email;
          console.log(`[MESSAGING CODE] Resolved patient email from MDI record`);
        } else {
          console.warn(`[MESSAGING CODE] Patient lookup failed: ${patientRes.status}`);
        }
      } catch (e) {
        console.warn(`[MESSAGING CODE] Patient lookup error: ${e.message}`);
      }
    }

    // Fall back to the verified Supabase session email
    if (!email) email = user.email;

    if (!email) {
      return {
        statusCode: 400,
        headers: cors,
        body: JSON.stringify({ error: 'Unable to determine your email. Please contact support.' })
      };
    }

    // ── Step 3: Call MDI Partner 2FA endpoint ─────────────────────
    // POST /v1/partner/patients/auth/2fa
    // Sends a one-time verification code to the patient's email
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

    // Log the actual MDI response for debugging
    const responseText = await response.text();
    console.log(`[MESSAGING CODE] MDI 2FA response (${response.status}): ${responseText}`);

    if (!response.ok) {
      const errText = responseText;
      console.error(`[MESSAGING CODE] MDI 2FA request failed (${response.status}): ${errText}`);

      if (response.status === 422) {
        // Email doesn't match any MDI patient — ask user to provide their MDI email
        return {
          statusCode: 422,
          headers: cors,
          body: JSON.stringify({
            error: 'We couldn\'t find a patient account with this email. Please enter the email you used during your medical intake.',
            code: 'EMAIL_MISMATCH'
          })
        };
      }
      if (response.status === 404) {
        return {
          statusCode: 404,
          headers: cors,
          body: JSON.stringify({
            error: 'No patient account found. Please complete your intake first.',
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
        message: 'Verification code sent to your email.',
        email: email  // Return resolved email so frontend can store it
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
