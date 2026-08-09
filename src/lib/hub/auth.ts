// Today's window.hubAuth object, as named exports instead of a global.
// Any component script that needs one of these just imports it directly.
import { supabase } from './supabase';

export type AuthResult = { success: true; status?: string } | { success: false; message: string };

// Where Google OAuth, the signup confirmation email and the password-reset
// email send the user back to. Deliberately the CURRENT url instead of a
// hardcoded '/hub': behind the coming-soon gate the page is served at
// /preview/hub, and bare /hub is swallowed by the forced catch-all in
// netlify.toml — so a hardcoded '/hub' returns from Google with a valid
// session in the URL hash and drops the user on the waitlist page, which
// has no hub script to consume it. Reads at call time, not module load.
const returnUrl = () => window.location.origin + window.location.pathname;

function supabaseErrorMessage(message?: string): string {
  const messages: Record<string, string> = {
    'User already registered': 'An account with this email already exists. Try signing in.',
    'Invalid login credentials': 'Invalid email or password. Please try again.',
    'Email not confirmed': 'Please confirm your email before signing in.',
    'Password should be at least 6 characters.': 'Password must be at least 6 characters.',
    'Unable to validate email address: invalid format': 'Please enter a valid email address.',
  };
  return (message && messages[message]) || message || 'Something went wrong. Please try again.';
}

export async function signUp(email: string, password: string, name?: string): Promise<AuthResult> {
  try {
    // emailRedirectTo: without it, the confirmation link sends the user to
    // Supabase's configured Site URL (the marketing homepage "/"), not back
    // here — matches googleSignIn/resetPassword below, which already set
    // this correctly.
    const opts: Parameters<typeof supabase.auth.signUp>[0] = {
      email,
      password,
      options: { emailRedirectTo: returnUrl() },
    };
    if (name) (opts as any).options.data = { full_name: name };

    const res = await supabase.auth.signUp(opts);
    if (res.error) return { success: false, message: supabaseErrorMessage(res.error.message) };

    // Supabase never errors signUp() for a duplicate email — by design, to
    // avoid leaking which addresses are registered, it silently returns a
    // signup-shaped response either way:
    //  - already registered + confirmed: user.identities is []
    //  - already registered + NOT yet confirmed: identities look normal,
    //    but user.created_at is the ORIGINAL account's timestamp (not
    //    "now"), because it's the same row — this is the standard way to
    //    detect that case client-side.
    const u = res.data && res.data.user;
    let status = 'new';
    if (u) {
      if (Array.isArray(u.identities) && u.identities.length === 0) {
        status = 'existing_confirmed';
      } else if (u.created_at && Date.now() - new Date(u.created_at).getTime() > 10000) {
        status = 'existing_unconfirmed';
      }
    }
    return { success: true, status };
  } catch (error: any) {
    return { success: false, message: supabaseErrorMessage(error?.message) };
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (res.error) return { success: false, message: supabaseErrorMessage(res.error.message) };
    return { success: true };
  } catch (error: any) {
    return { success: false, message: supabaseErrorMessage(error?.message) };
  }
}

export async function googleSignIn(): Promise<AuthResult> {
  try {
    // Redirect flow (not a popup): the browser navigates to Google and back
    // to this same /hub URL. There is nothing more to do on success here —
    // the onAuthStateChange listener in supabase.ts picks up the restored
    // session once the page reloads.
    const res = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: returnUrl() },
    });
    if (res.error) return { success: false, message: supabaseErrorMessage(res.error.message) };
    return { success: true };
  } catch (error: any) {
    return { success: false, message: supabaseErrorMessage(error?.message) };
  }
}

export function signOut() {
  return supabase.auth.signOut();
}

export function resetPassword(email: string) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: returnUrl() });
}

export async function accessToken(): Promise<string> {
  try {
    const res = await supabase.auth.getSession();
    return res.data?.session?.access_token || '';
  } catch {
    return '';
  }
}
