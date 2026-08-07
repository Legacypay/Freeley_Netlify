// Single Supabase client for the whole Health Hub page. A real ES module —
// every other src/lib/hub/*.ts and every Hub*.astro component script
// imports `supabase` (or something that transitively imports it) from
// here, so this file's top-level code (including the listener below) is
// guaranteed by ES module evaluation order to run before any importer's
// own script body does. That guarantee is the whole point: the page used
// to smuggle this client onto `window.hubSupabaseClient` from an
// `is:inline` script, and a *different* `is:inline` script further down
// once referenced a same-page global (`window.openMessaging`) before it
// was assigned, which threw silently and killed that script's own
// `hub:auth` listener. Real imports make that class of ordering bug
// structurally unreachable.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Fires immediately with the current session on subscribe (including one
// restored from the URL hash after the Google OAuth redirect back —
// detectSessionInUrl defaults to true), then again on every sign-in /
// sign-out / token refresh. The `hub:auth` CustomEvent is the deliberate
// decoupling point between "auth state" and "which screen is showing" —
// this module never needs to know about the DOM screens, and hub.astro's
// own script (which does know about them) never needs to import this
// module directly.
supabase.auth.onAuthStateChange((_event, session) => {
  if (session && session.user) {
    window.dispatchEvent(
      new CustomEvent('hub:auth', {
        detail: {
          email: session.user.email,
          displayName: session.user.user_metadata?.full_name || null,
        },
      }),
    );
  }
});
