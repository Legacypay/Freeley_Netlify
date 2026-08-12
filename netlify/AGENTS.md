<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# netlify/

## Purpose
Backend for the Freeley telehealth marketing site, deployed as Netlify Functions (AWS Lambda-style serverless handlers). This directory contains no site content — it holds only the `functions/` tree (API endpoints + webhook receivers + scheduled jobs) that the Astro frontend (`src/`) and legacy static pages call via `/.netlify/functions/*`. There is no `netlify/edge-functions/` or other Netlify feature directory in this repo; everything here is classic Netlify Functions.

## Key Files
None directly in this directory — see Subdirectories.

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `functions/` | 21 serverless function handlers: checkout/payment (Stripe, Authorize.Net), MD Integrations (MDI) telehealth case/voucher/messaging proxy, Supabase-authenticated patient hub endpoints, webhook receivers, and scheduled jobs. See `functions/AGENTS.md`. |
| `functions/lib/` | 9 shared utility modules imported by the functions above (MDI API client, Supabase/Firebase token verification, PHI encryption, rate limiting, product catalog, validation, conversion tracking, logging). See `functions/lib/AGENTS.md`. |

## For AI Agents
### Working In This Directory
- This is server-side Node.js (CommonJS — `exports.handler`, `require(...)`), not the Astro frontend. Functions run in Netlify's Lambda environment; no shared state between invocations except a per-cold-start in-memory cache (see `getPatientToken.js`, `validateMessagingCode.js`, `mdi-client.js` token cache).
- Configuration for this whole tree lives in **`netlify.toml`** at the repo root, not here. Relevant settings:
  - `[functions] directory = "netlify/functions"` — wires this tree in as the functions directory.
  - `[functions."retryPendingCases"] schedule = "*/15 * * * *"` — cron-invokes `retryPendingCases.js` every 15 minutes.
  - `[functions."keepSupabaseAlive"] schedule = "@daily"` — cron-invokes `keepSupabaseAlive.js` daily.
  - A large `[[redirects]]` block implements a temporary **"Coming Soon" waitlist gate**: nearly every URL is force-rewritten (200, not redirect) to `/waitlist`. An explicit allow-rule `[[redirects]] from = "/.netlify/functions/*" to = "/.netlify/functions/:splat"` (with `status = 200`, evaluated before the catch-all) lets all functions in this directory stay reachable while the gate is active — this is the "let X past the waitlist gate" pattern referenced in recent commits (e.g. `/analytics.js`, `/attribution.js` are static assets that needed the same treatment, not functions). To remove the gate, delete the marked block in `netlify.toml` between "COMING SOON GATE" and "END COMING SOON GATE" — functions are unaffected either way.
  - Required env vars for MDI (MD Integrations, the telehealth/EHR partner) are documented in a comment block in `netlify.toml`: `MDI_CLIENT_ID`, `MDI_CLIENT_SECRET`, `MDI_BASE_URL`, `MDI_WEBHOOK_SECRET`, `MDI_DEFAULT_PHARMACY_ID`, `N8N_WEBHOOK_URL`.
- Local dev: `npm run dev:netlify` runs `netlify dev`, which serves both the Astro frontend and these functions together.

### Testing Requirements
- No unit test suite for functions in this repo (`npm test` is a stub). Playwright e2e tests live in `tests/` at repo root and exercise the built site, not functions in isolation.
- Manual verification pattern used throughout: `console.log`/`console.error` structured messages tagged like `[SUBMIT QUIZ]`, `[STRIPE WEBHOOK]` — check Netlify function logs after invoking.
- `functions/health.js` (`GET /.netlify/functions/health`) is the uptime/deploy-verification probe.

### Common Patterns
See `functions/AGENTS.md` for the CORS, auth, and error-handling conventions shared across handlers.

## Dependencies
### Internal
- `functions/lib/*` — shared helpers used across nearly every function.
- `../pricing.json` (repo root) — single source of truth for treatment pricing, imported directly via relative path (`../../pricing.json`) by `create-payment-intent.js` and `create-authnet-transaction.js`.
- `../supabase/` — the Postgres backend that `verify-supabase-token.js` authenticates against and that `funnel_leads`/`waitlist` write to (from the frontend directly via Supabase RPC, not from these functions, except `keepSupabaseAlive.js` which pings it).

### External
- `@netlify/blobs` — durable KV-like storage used for order tracking (`mdi-orders` store), pending-case retry queue (`pending-mdi-cases` store), and rate limiting (`rate-limits` store).
- `stripe` (npm) — Stripe SDK, used by `create-payment-intent.js`, `stripeWebhook.js`, `getBillingHistory.js`.
- MD Integrations (MDI) REST API (`api.mdintegrations.com`) — the telehealth partner (case creation, patient messaging, vouchers).
- Authorize.Net REST API (`api.authorize.net` / `apitest.authorize.net`) — alternate payment processor.
- Supabase Auth REST API — token verification (`GET /auth/v1/user`).
- Meta Conversions API and GA4 Measurement Protocol — server-side ad conversion tracking.
- n8n (or Make/Zapier) webhook — internal notification/email dispatch, configured via `N8N_WEBHOOK_URL`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
