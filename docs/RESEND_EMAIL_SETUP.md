# Resend + Supabase email setup (added 2026-09-01)

Two independent things, easy to conflate — see the "How this actually works"
section in `netlify/functions/lib/resend-client.js` for the short version:

1. **Supabase Auth's own emails** (Confirm signup, Magic Link, Reset
   Password, Change Email Address) are generated entirely by Supabase using
   templates you paste into its dashboard. Resend is only the delivery
   mechanism (SMTP) once you connect it — it never sees "a template", just a
   fully-rendered email to send.
2. **The Hub welcome / temporary-password email** is a custom email this
   codebase composes itself and sends by calling Resend's HTTP API directly
   (`netlify/functions/lib/resend-client.js`) — nothing to configure in
   Supabase for this one, it already works once `RESEND_API_KEY` is set
   (done — see Netlify env vars) and the sending domain is verified in Resend
   (pending — see "Domain verification" below).

## 1. Domain verification in Resend (blocks real delivery until done)

Until `freeley.com` is verified in Resend, `no-reply@freeley.com` sends will
likely land in spam or be rejected outright. Add the DNS records Resend gave
you (DKIM TXT, the two SPF/DKIM CNAMEs, the DMARC TXT) at wherever
`freeley.com`'s DNS is actually hosted — tell me the provider (registrar's own
DNS, Cloudflare, Netlify DNS, etc.) and I'll give you the exact
click-by-click steps; I don't have a tool that can add DNS records for you.
Then click "Verify" in Resend's dashboard.

## 2. Connect Resend as Supabase's custom SMTP

Supabase dashboard → your project → **Authentication → Emails → SMTP
Settings** → enable custom SMTP:

| Field | Value |
|---|---|
| Sender email | `no-reply@freeley.com` (must match a verified domain in Resend, and match `RESEND_FROM_EMAIL` below) |
| Sender name | `Freeley` |
| Host | `smtp.resend.com` |
| Port | `465` (or `587`) |
| Username | `resend` |
| Password | your Resend API key (`re_...`) |

Supabase's own built-in mailer is rate-limited to a handful of emails/hour —
this step is what actually removes that limit for signup/magic-link/reset
emails at real patient volume.

## 3. Paste the four templates into Supabase

Dashboard → **Authentication → Emails → Templates**. For each one, paste the
**Subject** and the **HTML** from the matching file in
`docs/email-templates/supabase/`:

| Supabase template | Subject | File |
|---|---|---|
| Confirm signup | Confirm your Freeley account | `confirm-signup.html` |
| Magic Link | Your Freeley Hub sign-in link | `magic-link.html` |
| Reset Password | Reset your Freeley password | `reset-password.html` |
| Change Email Address | Confirm your new email for Freeley | `change-email.html` |

Each file already contains the exact Supabase template variables it needs
(`{{ .ConfirmationURL }}`, `{{ .NewEmail }}`) — paste the file's content
as-is, don't retype the variables. "Invite user" and "Reauthentication"
templates are left as Supabase's defaults — this app doesn't send admin
invites and doesn't use MFA today.

All four render from the same brand shell (`netlify/functions/lib/email-
templates/shared.js` — logo, colors, footer) as the Hub welcome email, so
every patient-facing email looks consistent. To change the look later, edit
`shared.js` and re-run the generator (see that file's own comment) rather
than hand-editing the four HTML files, so they don't drift apart again.

## 4. Environment variables (already set in Netlify)

| Var | Value | Purpose |
|---|---|---|
| `RESEND_API_KEY` | `re_...` (secret) | Used by `lib/resend-client.js` for the custom welcome email |
| `RESEND_FROM_EMAIL` | `Freeley <no-reply@freeley.com>` | Sender for that same custom email — change if you'd rather send from a different verified address (e.g. `hello@freeley.com`) |

## 5. The temporary-password email (custom, not a Supabase template)

`netlify/functions/lib/hub-account.js`'s `ensureHubAccount()` now does three
things after a paid checkout, in order:

1. `POST /auth/v1/signup` (anon key) with a freshly generated 12-character
   password — sets a real password on the account. **Known limitation:**
   Supabase silently no-ops this for an email that's already registered and
   confirmed (anti-enumeration by design), so this only actually takes
   effect for a genuinely new patient. A repeat purchaser keeps their
   existing password — same as before this change, use "Forgot password" or
   the magic link for that case.
2. `POST /auth/v1/otp` with `create_user:true` — the existing magic-link
   email (unchanged), delivered via Resend once step 2 above is done.
3. The custom Resend welcome email (`lib/email-templates/hub-welcome.js`)
   spelling out both the magic link and the email+password fallback, with
   a note that the password can be changed from the portal.

A brand-new patient may see up to three emails on first purchase (Supabase's
own Confirm-signup email, the Magic Link email, and this welcome email) —
opening any one of them is enough to get in. If that feels like too many once
you see it in practice, the cleanest simplification is turning off "Confirm
signup" delivery in Supabase's Auth settings (Authentication → Providers →
Email → uncheck "Confirm email") — that's a deliberate account-security
trade-off (removes email-ownership verification for self-serve sign-ups on
the Hub's own Create Account form), so it's left as your call, not made here.
