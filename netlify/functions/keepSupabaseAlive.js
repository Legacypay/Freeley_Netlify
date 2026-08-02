/**
 * Netlify Function: keepSupabaseAlive
 *
 * Supabase free-tier projects auto-pause after 7 days with no API activity.
 * This pings PostgREST daily so the project never goes idle.
 *
 * Scheduled via netlify.toml: [functions."keepSupabaseAlive"] schedule = "@daily"
 */

exports.handler = async () => {
  const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[KEEP ALIVE] Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY');
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase env vars are not set' }) };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist?select=id&limit=1`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    console.log(`[KEEP ALIVE] Pinged Supabase — status ${res.status}`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, status: res.status }) };
  } catch (error) {
    console.error('[KEEP ALIVE] Ping failed:', error.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Ping failed' }) };
  }
};
