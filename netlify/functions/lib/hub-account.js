/**
 * Best-effort Hub (Supabase Auth) account creation after a paid checkout.
 *
 * Flow context: after payment the patient is redirected to MDI's branded
 * patient site, where their MEDICAL account is created (MDI side). MDI's
 * webhook (mdiWebhook.js) reports patient/case events back but never creates
 * a Freeley Hub login — so the checkout does it here.
 *
 * No service-role key is provisioned for these functions, so this uses the
 * anon-key OTP endpoint with create_user:true — one call both creates the
 * auth user (when new) and emails a magic sign-in link to the patient.
 * For an existing account it just sends a login link, so it's idempotent.
 *
 * NOTE: Supabase's built-in SMTP rate-limits these emails to a few per hour —
 * configure custom SMTP in Supabase Auth settings before real volume.
 */
async function ensureHubAccount(email, redirectTo) {
  const url = process.env.PUBLIC_SUPABASE_URL;
  const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !email) return { sent: false, reason: 'missing-config-or-email' };

  // process.env.URL is Netlify's canonical site URL. If the redirect target
  // isn't on Supabase's auth allow-list (e.g. a deploy preview), Supabase
  // falls back to its configured Site URL — the email still works.
  const target = redirectTo || (process.env.URL ? process.env.URL + '/hub' : null);
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
  return { sent: true };
}

module.exports = { ensureHubAccount };
