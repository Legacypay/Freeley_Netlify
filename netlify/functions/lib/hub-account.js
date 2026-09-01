/**
 * Best-effort Hub (Supabase Auth) account creation after a paid checkout.
 *
 * Flow context: after payment the patient is redirected to MDI's branded
 * patient site, where their MEDICAL account is created (MDI side). MDI's
 * webhook (mdiWebhook.js) reports patient/case events back but never creates
 * a Freeley Hub login — so the checkout does it here.
 *
 * No service-role key is provisioned for these functions, so account
 * creation stays entirely on the anon-key API, in two steps:
 *   1. POST /auth/v1/signup with a freshly generated password — this is what
 *      actually gives the patient a working email+password fallback (Admin
 *      API's `createUser`/`updateUserById` would be the "proper" way to set
 *      a password without email friction, but that needs the service-role
 *      key this codebase deliberately never provisions — see docs/... and
 *      AGENTS.md). KNOWN LIMITATION: Supabase never errors signup() for an
 *      email that's already registered AND confirmed (anti-enumeration by
 *      design) — it also does NOT update that existing account's password.
 *      So the password below only actually takes effect for a genuinely new
 *      patient; a repeat purchaser keeps whatever password they already have
 *      and should use "Forgot password" or the magic link instead. This is
 *      the same fallback path they already had before this change, not a
 *      regression — just not "reset by every purchase".
 *   2. POST /auth/v1/otp with create_user:true — unchanged, the existing
 *      magic-link email. For a brand-new patient this also fires Supabase's
 *      own "Confirm signup" template from step 1 (Auth > Emails > Confirm
 *      signup) — expected, not a bug: it's Supabase's own account
 *      verification step, opening any ONE of the three emails is enough.
 *
 * On top of both, a custom "temporary password" email is sent directly via
 * Resend (see lib/resend-client.js, lib/email-templates/hub-welcome.js) —
 * NOT a Supabase Auth email — spelling out the fallback explicitly for a
 * patient whose magic link didn't work.
 *
 * NOTE: Supabase's built-in SMTP rate-limits its own emails (steps 1-2) to a
 * few per hour — configure Resend as custom SMTP in Supabase Auth settings
 * before real volume (dashboard-only, see docs/RESEND_EMAIL_SETUP.md).
 */

const { sendResendEmail } = require('./resend-client');
const { renderHubWelcomeEmail } = require('./email-templates/hub-welcome');

/** URL-safe, unambiguous (no 0/O/1/l/I) 12-char password — typeable from an email on a phone. */
function generateTempPassword() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = require('crypto').randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function ensureHubAccount(email, redirectTo, opts = {}) {
  const url = process.env.PUBLIC_SUPABASE_URL;
  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !email) return { sent: false, reason: 'missing-config-or-email' };

  // process.env.URL is Netlify's canonical site URL. If the redirect target
  // isn't on Supabase's auth allow-list (e.g. a deploy preview), Supabase
  // falls back to its configured Site URL — the email still works.
  const target = redirectTo || (process.env.URL ? process.env.URL + '/hub' : null);
  const hubUrl = process.env.URL ? process.env.URL + '/hub' : 'https://freeley.com/hub';

  // ── Step 1: set a password (best-effort — see the "known limitation" note above) ──
  const tempPassword = generateTempPassword();
  try {
    const signupRes = await fetch(url + '/auth/v1/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey },
      body: JSON.stringify({ email, password: tempPassword, options: { emailRedirectTo: target || undefined } })
    });
    if (!signupRes.ok) {
      const text = await signupRes.text().catch(() => '');
      console.warn('[HUB ACCOUNT] signup (password set) failed, continuing with magic-link-only:', signupRes.status, text.slice(0, 200));
    }
  } catch (e) {
    console.warn('[HUB ACCOUNT] signup call threw (non-critical):', e.message);
  }

  // ── Step 2: magic-link email (unchanged existing behavior) ──
  const qs = target ? '?redirect_to=' + encodeURIComponent(target) : '';
  const res = await fetch(url + '/auth/v1/otp' + qs, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ email, create_user: true })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { sent: false, reason: res.status + ' ' + text.slice(0, 200) };
  }

  // ── Step 3: our own custom welcome/temp-password email via Resend ──
  // Never blocks or fails the (already-successful) magic-link result above.
  try {
    const html = renderHubWelcomeEmail({ firstName: opts.firstName, email, password: tempPassword, hubUrl });
    const sent = await sendResendEmail({ to: email, subject: 'Welcome to Freeley — your Hub account is ready', html });
    if (!sent.sent) console.warn('[HUB ACCOUNT] Resend welcome email failed (non-critical):', sent.reason);
  } catch (e) {
    console.warn('[HUB ACCOUNT] Resend welcome email threw (non-critical):', e.message);
  }

  return { sent: true };
}

module.exports = { ensureHubAccount, generateTempPassword };
