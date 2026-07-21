// Client-side Supabase access, centralized so pages don't re-wire env vars,
// headers and fetch by hand. These PUBLIC_ values are meant to live in the
// browser bundle — data is protected by RLS + SECURITY DEFINER RPCs, not by
// hiding the anon key. Vite inlines import.meta.env at build time, so this
// only works from Vite-bundled <script> tags (not from `is:inline` scripts).
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/** POST to a Supabase RPC (PostgREST). Throws on non-2xx; returns the Response. */
export async function callRpc(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase env vars are not set (PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY).');
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

  if (!res.ok) throw new Error(`Supabase RPC "${fn}" failed: ${res.status}`);
  return res;
}
