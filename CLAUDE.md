# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project scope

This repo contains a lot of legacy/duplicate material alongside the live app. **Treat the live project as `src/` (the Astro app) plus `public/` (Astro's static passthrough — served verbatim, and several `src/*.astro` pages load files directly from it).** Unless a task explicitly asks about them, do not edit or "clean up" these other trees — they are not part of the Astro build:

- **~141 `.html` files at the repo root** — staging output of an Auto-SEO bot (`build_blog.js`, run by `.github/workflows/daily-seo.yml`), never read by `astro build`. Editing one does nothing to the live site.
- **Root-level `assets/`** — a third, separate image tree from the Auto-SEO pipeline (distinct from `src/assets/` and `public/assets/`).
- **`brello-style/`** — competitor/theme screenshot mood-board, not deployed.
- **`archive/legacy-hub/`** — superseded by `src/pages/hub.astro`.
- **`scripts/_archive/`** — deprecated one-off Python scripts from the pre-Astro era.
- **`android/`, `ios/`** — Capacitor-generated mobile scaffolding (`npm run build:mobile` syncs the built web app into these); don't hand-edit generated resource folders.

Nearly every directory has its own `AGENTS.md` with specifics — read the one for the directory you're touching before making changes.

## Commands

```bash
npm run dev              # astro dev — local dev server
npm run build             # astro build — production build to dist/, also the fastest correctness check
npm run preview           # astro preview — serve the built dist/
npm run dev:netlify       # netlify dev — local dev with Netlify Functions available
npm run test:e2e          # playwright test — headless e2e suite (see Testing below)
npm run test:e2e:ui       # playwright test --ui — interactive Playwright UI
```

Run a single Playwright test:
```bash
npx playwright test tests/e2e/checkout-and-waitlist.spec.ts
npx playwright test -g "some test name"
```

`npm test` is an unconfigured stub (`exit 1`) — there is no unit test suite. `npm run build` is the primary regression check for `src/` changes (Astro/TypeScript errors surface there).

## Architecture

**Stack:** Astro 7 frontend (`src/`) + Tailwind CSS v4, deployed to Netlify. Netlify Functions (`netlify/functions/`, CommonJS) form the entire backend API, called from the frontend at `/.netlify/functions/<name>`. Supabase (Postgres + Auth + PostgREST) is the identity/lead-capture layer only — it does **not** hold telehealth case/order data, which lives in Netlify Blobs and in MD Integrations (MDI), the telehealth/EHR partner that actually creates patients, cases, and prescriptions. Stripe and Authorize.Net handle payment (Authorize.Net is an in-progress migration; see `docs/AUTHORIZE_NET_SETUP.md`).

**Verticals:** the site sells physician-prescribed compounded treatment across four verticals — weight loss (GLP-1), hair loss, sexual wellness (ED/TRT), and longevity/peptides. `src/pages/hair-loss.astro`, `longevity.astro`, `sexual-wellness.astro`, and `weight-loss.astro` (the template the other three inherit their `wl-`-prefixed CSS-token structure from) are the most frequently edited files.

**Routing:** file-based — every `.astro` file directly under `src/pages/` becomes a route (`src/pages/hair-loss.astro` → `/hair-loss`). No router config. Most pages use `src/layouts/Layout.astro` + `Header`/`Footer`/`QuizModal` from `src/components/`; a few pages (`index.astro`, `compare.astro`, `checkout.astro`, `assessment-quiz.astro`, `assessment-design-2.astro`, `waitlist.astro`) render a complete standalone `<html>` document instead — `astro.config.mjs` injects the Whop pixel and GA4/Meta/Clarity/attribution tracking scripts via `head-inline` specifically so these six still get them despite not using `Layout.astro`.

**Legacy DOM coupling:** the four vertical landing pages each pair with a legacy plain-JS file under `public/assets/js/` (`hl-script.js`, `longevity.js`, `sw-script.js`, `wl-script.js`) that binds specific DOM ids/classes verbatim for the medication-toggle product gallery. Do not rename/remove those ids or classes in the `.astro` page without updating the matching script.

**Health Hub (`/hub`):** a Supabase-authenticated patient portal, structurally separate from the marketing pages. `src/pages/hub.astro` composes `src/components/hub/*.astro` (markup/wiring only) with all real logic in `src/lib/hub/*.ts` (auth, a Netlify Functions API wrapper, dashboard data loading, secure messaging). `src/lib/hub/supabase.ts` creates the single Supabase client and dispatches a `hub:auth` `CustomEvent` that everything else in the hub listens for — cross-module communication goes through real ES module imports, never `window.*` globals (a past bug class this was refactored away from). Patient data (case status, billing, messages) is fetched through `src/lib/hub/api.ts`'s `authFetch`, which calls `netlify/functions/*` with a `Authorization: Bearer <supabase access token>` header, verified server-side by `netlify/functions/lib/verify-supabase-token.js`. A legacy `verify-firebase-token.js` also exists but is unused — Supabase Auth fully replaced Firebase.

**Netlify Functions groups** (`netlify/functions/`, all CommonJS `exports.handler`):
- Payments: `create-payment-intent.js` (Stripe), `create-authnet-transaction.js` (Authorize.Net) — both price server-side from root `pricing.json`, rate-limited 10/min/IP via `lib/rate-limit.js`.
- Intake: `submitQuiz.js` creates an MDI voucher; on failure `savePendingCase.js` PHI-encrypts (`lib/phi-crypto.js`) and queues to Netlify Blobs, retried by the scheduled `retryPendingCases.js` (every 15 min, cron in `netlify.toml`).
- Patient hub (Supabase-authenticated): `caseStatus.js`, `getEncounterDetails.js`, `patientCases.js`, `getMessages.js`/`sendMessage.js`, `getMessagingAuth.js`/`getPatientToken.js`/`requestMessagingCode.js`/`validateMessagingCode.js`, `getBillingHistory.js`.
- Webhooks (signature-verified, return `500` on failure so the sender retries): `stripeWebhook.js`, `mdiWebhook.js`.
- Scheduled/misc: `health.js`, `keepSupabaseAlive.js` (`@daily`, prevents Supabase free-tier auto-pause), `captureLead.js`, `track-conversion.js`.
- Shared `lib/`: `mdi-client.js` (MDI OAuth2 client + CORS helpers + webhook signature check), `products.js` (product/offering catalog — extend this rather than hardcoding MDI IDs in a handler), `conversion-tracker.js` (HIPAA-safe Meta CAPI + GA4 firing, PII hashed, medical content never sent), `validate-quiz.js`, `logger.js` (defined but unused — functions use inline `console.log('[TAG] ...')` instead; match that convention).

**Pricing:** `pricing.json` at the repo root is the single source of truth, imported directly by both payment functions server-side — the client never sends a dollar amount.

**The site currently sits behind a waitlist gate**: `netlify.toml` has a "COMING SOON GATE" block that force-rewrites every route to `/waitlist` except an explicit allowlist (functions, static assets, a few pages). All 21 Netlify Functions stay reachable regardless of gate state. See `WAITLIST.md` for how to remove it — and don't drop the `waitlist` Supabase table, which holds real captured emails.

**Blog/SEO pipeline (legacy, outside `src/`):** `content/blog/*.md` (140 posts) is **not** an Astro content collection — it's consumed by root-level scripts `refill-keywords.js` → `seo-agent.js` (OpenAI) → `build_blog.js` (gray-matter + marked → static `<slug>.html` at repo root + rebuilds `blog.html`/`sitemap.xml`), run daily by `.github/workflows/daily-seo.yml` (commits as "🤖 Auto-SEO: new article + rebuilt blog"). This pipeline is disconnected from the Astro build; syncing its output into `public/` is a documented manual step, not automated.

**Testing:** Playwright e2e suite (`tests/e2e/`) runs against the **built and previewed** site (`npm run build && npm run preview`, port 4321), not `astro dev`. Two projects: `desktop` (runs everything) and `mobile` (Pixel 7 viewport, `responsive.spec.ts` only). Cross-page sweep specs (`console-errors`, `links-and-404s`, `responsive`) share a `PAGES` list from `tests/e2e/pages.ts` — add new routes there rather than duplicating a page array per spec. Some specs intentionally assert known, unfixed bugs via `test.fixme()` (e.g. the pricing Monthly/Quarterly toggle) rather than silently working around them — read a spec's top comment before "fixing" behavior it documents as a known limitation.
