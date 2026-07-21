# Coming-Soon Waitlist — What it is & how to remove it

The site is currently behind a **temporary "under construction" gate**: every
URL renders a waitlist page that collects emails into Supabase. This document
is the single source of truth for turning it off again.

> **AI agent note:** If you were asked to "remove the waitlist" / "quitar la
> waitlist" / "launch the real site", follow **Step 1** below. That single
> change restores the full site. Do not delete data or the reusable helper.

---

## How it works

| Piece | File | Purpose |
| --- | --- | --- |
| The gate | `netlify.toml` → `COMING SOON GATE` block | Forced `200` rewrite that serves the waitlist at every URL, keeping the address bar unchanged. Allow-rules above it let `/_astro/*`, `/.netlify/*` and favicons through. |
| The page | `src/pages/waitlist.astro` | Self-contained branded waitlist landing (own `<html>`, inline styles, `noindex`). |
| Email capture | `src/lib/supabaseClient.ts` | Generic `callRpc()` helper. **Reusable — not waitlist-specific.** |
| Database | `supabase/migrations/0002_waitlist.sql` | `public.waitlist` table + `join_waitlist(p_email)` RPC (`SECURITY DEFINER`, granted to `anon`; RLS on, zero policies — the RPC is the only write path). |

Data flow: form → bundled `<script>` imports `callRpc` → `POST` to
`/rest/v1/rpc/join_waitlist` → row in `public.waitlist`.

> **Env vars** (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`) are inlined by
> Vite **at build time**. They must be set in Netlify (they already are — the
> quiz uses them). With empty envs, the build dead-code-eliminates the `fetch`.
> A gitignored local `.env` with the public values keeps local builds honest.

---

## Step 1 — Remove the gate (the only required step)

In `netlify.toml`, delete the **entire** `COMING SOON GATE` block — from the
`# COMING SOON GATE` banner down to the `# END COMING SOON GATE` banner
(inclusive). Leave every other `[[redirects]]` rule untouched (the
`.html`→clean-URL and trailing-slash rules must stay).

Redeploy. The full site is back. **Nothing else is required.**

> ⚠️ Do not remove only the `force = true` line or a single rule — the gate
> relies on the allow-rules + forced catch-all working together. Remove the
> whole block or none of it.

## Step 2 — Optional cleanup (safe to skip)

- Delete `src/pages/waitlist.astro` **only** if you don't want a `/waitlist`
  page to exist anymore.
- **Keep** `src/lib/supabaseClient.ts` — it's a generic helper, unrelated to the
  gate.

## What to NEVER delete

- **The `public.waitlist` table / its migration.** It holds real emails people
  submitted. Dropping it discards leads. Export them first if you ever must.
- The `join_waitlist` RPC and other `[[redirects]]` rules in `netlify.toml`.

---

## Verifying after removal

1. `npm run build` succeeds.
2. On the deploy preview, `/`, `/pricing`, `/checkout` render their real pages
   again (not the waitlist).
3. `/waitlist` still works only if you kept the page in Step 2.
