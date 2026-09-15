# Resend + Supabase email setup (added 2026-09-01)

> **Update 2026-09-10**: This file's original claims had it backwards.
> `freeley.com` was actually verified in Resend since 2026-09-01 —
> deliverability was never blocked. `RESEND_API_KEY`, on the other hand,
> was **never actually set in production** despite this doc saying "done" —
> every email this codebase tried to send via Resend (the Hub welcome
> email, and now the much larger set added in `docs/EMAIL_FLOWS.md`) was
> silently failing with `RESEND_API_KEY not set`. Both a fresh
> `RESEND_API_KEY` and `RESEND_WEBHOOK_SECRET` were set in Netlify and a
> webhook registered, all via the Resend MCP — see `docs/EMAIL_FLOWS.md`'s
> checklist for what's still outstanding (Authorize.Net webhook events,
> `EMAIL_POSTAL_ADDRESS`).

Two independent things, easy to conflate — see the "How this actually works"
section in `netlify/functions/lib/resend-client.js` for the short version:

1. **Supabase Auth's own emails** (Confirm signup, Magic Link, Reset
   Password, Change Email Address) are generated entirely by Supabase using
   templates you paste into its dashboard. Resend is only the delivery
   mechanism (SMTP) once you connect it — it never sees "a template", just a
   fully-rendered email to send.
2. **The Hub welcome / temporary-password email**, and everything else added
   in `docs/EMAIL_FLOWS.md`, are custom emails this codebase composes itself
   and sends by calling Resend's HTTP API directly
   (`netlify/functions/lib/resend-client.js`) — nothing to configure in
   Supabase for these. Both prerequisites are now in place: `RESEND_API_KEY`
   is set (done, 2026-09-10) and `freeley.com` is verified in Resend (done,
   since 2026-09-01).

## 1. Domain verification in Resend — done

`freeley.com` is verified in Resend (confirmed 2026-09-10, verified since
2026-09-01). Nothing to do here.

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
| `RESEND_API_KEY` | `re_...` (secret) | **Set** (2026-09-10, key "Freeley Netlify Functions", `sending_access` scoped to `freeley.com`). Used by `lib/resend-client.js` for every email this codebase sends directly (`docs/EMAIL_FLOWS.md`) |
| `RESEND_FROM_EMAIL` | `Freeley <no-reply@freeley.com>` | Set. Sender for those same emails — change if you'd rather send from a different verified address (e.g. `hello@freeley.com`) |

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
