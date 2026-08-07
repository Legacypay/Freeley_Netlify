/**
 * Supabase Auth access token verification via Supabase's Auth REST API.
 *
 * Unlike the Firebase verifier this replaces, this does NOT validate a JWT
 * signature locally — it asks Supabase's own API whether the token is valid:
 *   GET {SUPABASE_URL}/auth/v1/user
 *   Headers: { apikey: <anon key>, Authorization: Bearer <accessToken> }
 * A 200 response confirms the token belongs to a live session and returns
 * the user record; any non-200 means the token is invalid/expired.
 *
 * No service-role key is needed — the anon key only identifies the Supabase
 * project when calling its public Auth API and does not grant elevated
 * access, so it's safe to keep in a public (PUBLIC_*) env var.
 *
 * Required env vars: PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY
 * (falls back to SUPABASE_URL / SUPABASE_ANON_KEY if the PUBLIC_ ones are absent)
 */

/**
 * Verify a Supabase access token. Returns { uid, email, email_verified,
 * auth_time } on success, or null on any failure. Never throws.
 */
async function verifySupabaseToken(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') return null;

  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    console.error('[SUPABASE AUTH] PUBLIC_SUPABASE_URL/PUBLIC_SUPABASE_ANON_KEY not set — refusing to verify token');
    return null;
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !data.id) return null;

    return {
      uid: data.id,
      email: data.email || null,
      email_verified: !!data.email_confirmed_at,
      auth_time: data.last_sign_in_at ? Math.floor(new Date(data.last_sign_in_at).getTime() / 1000) : null
    };
  } catch (e) {
    console.error('[SUPABASE AUTH] Token verification error:', e.message);
    return null;
  }
}

module.exports = { verifySupabaseToken };
