# Freeley_Netlify

## Purpose
Marketing site and backend for **Freeley** (Freeley Health LLC, freeley.com), a telehealth platform connecting U.S. patients to licensed physicians and 503A compounding pharmacies across four verticals: **GLP-1 weight loss**, **sexual wellness** (ED/TRT), **hair loss**, and **longevity/peptides**. The live stack is an **Astro** frontend (`src/`) deployed to **Netlify**, backed by **Netlify Functions** (serverless handlers), **Supabase** (Postgres — lead capture, waitlist, patient-hub auth), **Stripe**/**Authorize.Net** (payment), and **MD Integrations (MDI)** (the telehealth/EHR partner that actually creates patient cases and prescriptions). A **Capacitor** wrapper (`android/`, `ios/`) packages the same website as a mobile app. The public site is currently sitting behind a **temporary "coming soon" waitlist gate** — see `WAITLIST.md` and the `netlify.toml` redirects block.

## Known-Messy Area: ~141 Root-Level `.html` Files
The repo root contains ~141 stray static `.html` files (e.g. `503a-compounding-pharmacy-explained.html`, `best-online-weight-loss-clinic-2026.html`, `blog.html`) sitting directly alongside real project config (`package.json`, `astro.config.mjs`, `netlify.toml`). **Do not assume these are part of the live Astro site.** They are generated output of `build_blog.js` (which reads `content/blog/*.md` and writes `<slug>.html` + `blog.html` + `sitemap.xml` back to the repo root — see `OUTPUT_DIR = __dirname` in that script), driven by `.github/workflows/daily-seo.yml` (daily cron: `refill-keywords.js` → `seo-agent.js` → `build_blog.js` → commit as "🤖 Auto-SEO: new article + rebuilt blog", visible throughout git history) and `.github/workflows/regenerate-images.yml`.

**They are not deployed as-is.** `netlify.toml`'s `[build] command = "npm run build"` runs `astro build`, which only emits `src/` output plus a verbatim passthrough of `public/`. Astro does **not** read arbitrary root-level files. The actual live blog/legacy pages are a separate, manually-synced copy living in `public/` (236 `.html` files there vs. 141 at root — overlapping but not identical sets; `public/` also has files like `404.html`, `app-index.html`, `contact.html`, `faq.html` that don't exist at root). `netlify.toml` documents this explicitly: *"KNOWN GAP: `build_blog.js` ... is not wired into this build yet — new/edited blog posts need manual re-sync into `public/` until that's automated."*

**Practical rule for agents:** treat root-level `*.html` as the *source/staging output* of the SEO bot, not the live site. To change what's actually served, edit `content/blog/*.md` and/or the corresponding file in `public/`, and re-run `build_blog.js` to keep root in sync — then manually copy the result into `public/` (there is no automated step that does this yet). Also present at root: `shared.css`/`shared.js` (styling/behavior for the legacy static pages, not used by Astro `src/` pages), `seo.js`, `seo-agent.js`, `seo-test-article.html`, `exit-intent.js`, several `generate-*.js`/`regenerate-*.js` one-off image-generation scripts, and known junk noted in `PLANV2.md` (`test_curl.jpg`, `dummy.js`, `n8n_seo_config.json`, etc.) — treat these as legacy/utility scripts for the static-page era, not part of the Astro build graph, unless a grep proves otherwise.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | Scripts: `dev` (`astro dev`), `build` (`astro build`), `preview` (`astro preview`), `dev:netlify` (`netlify dev`), `test:e2e`/`test:e2e:ui` (Playwright), `build:mobile` (rsync repo into `www/` + `npx cap sync` for Capacitor). `npm test` is an unimplemented stub (`exit 1`). Key deps: `astro`, `@tailwindcss/vite`/`tailwindcss` v4, `@supabase/supabase-js`, `stripe`, `@netlify/blobs`, `sharp`, `marked`/`gray-matter` (blog pipeline), `@capacitor/*`. Dev deps: `@playwright/test`, `@capacitor/cli`, `@capacitor/assets`. |
| `astro.config.mjs` | Astro config. Injects the Whop conversion pixel and GA4/Meta Pixel/Clarity + attribution-capture loader as `head-inline` scripts (deliberately, not via `Layout.astro`, so they reach the 6 pages that render their own `<html>` — see in-file comments). Self-hosts three Google Fonts (Source Serif 4, Archivo, Archivo Narrow) at build time. Tailwind v4 via Vite plugin. |
| `netlify.toml` | Build command/publish dir (`npm run build` → `dist`), scheduled functions (`retryPendingCases` every 15 min, `keepSupabaseAlive` daily), the full `[[redirects]]` table, security headers/CSP, and the **"COMING SOON GATE"** block — a forced catch-all rewrite (`/* → /waitlist`, `status = 200`, `force = true`) that currently makes every real route unreachable except an explicit allow-list (`/_astro/*`, `/.netlify/*`, `/waitlist`, `/preview`, `/compare`, `/assessment-quiz`, `/partner-pharmacies`, legal pages, static asset paths, and Astro-dev-only paths). Also has a `.html` → clean-URL 301 rule. See `WAITLIST.md` for how to remove the gate. |
| `WAITLIST.md` | Single source of truth for the coming-soon gate: what it is, how to remove it (delete one block in `netlify.toml`), and what must never be deleted (the `public.waitlist` Supabase table/migration — it holds real captured emails). |
| `PRODUCT.md` | Product brief: four equal-weight verticals, positioning (`$99/month, no membership` vs. competitors), funnel shape (quiz → physician review → compounding → shipping), `pricing.json` as pricing source of truth. |
| `PLANV2.md` | Client feedback tracker (Aug 2026 walkthrough) — design/copy tasks per page (`weight-loss.astro`, `hair-loss.astro`, `sexual-wellness.astro`, `longevity.astro`, `how-it-works.astro`), plus a "known repo housekeeping" section listing already-identified junk files safe to ignore/delete. |
| `MEETING-PLAN-2026-08-03.md`, `IMAGE-PROMPTS.md` | Meeting notes and a batch of image-generation prompts (paired with `scripts/generate-images.js` and the `scripts/image-manifest-*.json` files) used for the redesign work tracked in `PLANV2.md`. |
| `pricing.json` | Single source of truth for treatment pricing, imported directly by Netlify checkout functions — authoritative over anything the UI displays. |
| `capacitor.config.json` | Capacitor app config (`appId: com.freeley.app`, `webDir: "www"`) — the source config for the `android/`/`ios/` wrapper projects. |
| `README.md` | High-level architecture doc — **partially stale**: describes a pre-Astro static-HTML architecture (`index.html`, `quiz.html`, `hub.html` at root) and Firebase Auth, whereas the live app is now Astro (`src/pages/*.astro`) with Supabase-backed hub auth. Still accurate for env-var names, the Netlify Functions list, and deployment command. |
| `build_blog.js`, `seo-agent.js`, `refill-keywords.js`, `regenerate-blog-images.js` | The legacy SEO/blog automation pipeline — see `content/AGENTS.md` for the full flow. |
| `sitemap.xml`, `robots.txt`, `manifest.json`, `_redirects` | Static SEO/PWA files. Note `netlify.toml`'s `[[redirects]]` table is the authoritative redirect config for the live build; `_redirects` predates it and may be superseded — verify before editing. |
| `lighthouserc.json`, `playwright.config.ts` | Config for the Lighthouse CI workflow and the Playwright e2e suite (`tests/`), respectively. |
| `design.md` | Design-system notes (referenced by the redesign work in `PLANV2.md`). |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| [src/](src/AGENTS.md) | The live Astro application — pages, components, layouts, client-side lib, data, styles, build-time-optimized assets. This is what actually builds and deploys. |
| [netlify/](netlify/AGENTS.md) | Netlify Functions backend — 21 serverless handlers (checkout, MDI telehealth proxy, Supabase-authenticated hub endpoints, webhooks, scheduled jobs) + shared `lib/`. |
| [public/](public/AGENTS.md) | Astro's static passthrough directory — served verbatim at the site root. Holds the **live** legacy static pages (236 `.html` files, a manually-synced snapshot of the SEO blog output — see the root-level `.html` note above), plus `assets/`, `products-imgs/`, `quiz-scripts/`, `style/`, `global.css`, `analytics.js`, `attribution.js`. |
| [content/](content/AGENTS.md) | SEO blog pipeline data — `seo-keywords.txt` queue and `blog/` (140 Markdown posts), consumed by the root-level `build_blog.js`/`seo-agent.js` scripts, not by Astro content collections. |
| [scripts/](scripts/AGENTS.md) | Node utility scripts, mostly image-generation tooling (`generate-images.js`, `generate-cutout-images.js`, `image-manifest-*.json` batch specs) used for the `PLANV2.md` redesign work, plus a `lib/` with `gemini-image.js`/`openai-image.js` API clients. Also has an `_archive/` subfolder of superseded scripts. |
| [tests/](tests/AGENTS.md) | Playwright end-to-end tests (`tests/e2e/*.spec.ts`) covering carousels, checkout/waitlist, console errors, FAQ accordions, links/404s, navigation, pricing toggles, product toggles, the quiz funnel, responsive layout, and tracking pixels — run via `npm run test:e2e`. Plus `integration-check.js`. |
| [supabase/](supabase/AGENTS.md) | Database layer — SQL migrations only (no CLI config/seed data checked in). Backs funnel-lead capture, the waitlist table, and patient-hub auth/profiles. |
| [assets/](assets/AGENTS.md) | Root-level image assets (blog heroes, brand, lifestyle, OG images, physician photos, promo, videos) used by the legacy static `.html` pages and the SEO blog pipeline — distinct from `src/assets/` (Astro-optimized) and `public/assets/` (legacy-page runtime assets). |
| [brello-style/](brello-style/AGENTS.md) | Visual reference/mood-board of 153 competitor/theme screenshot images ("Bre-style reference" mentioned in `PLANV2.md`). Not code, not deployed, not referenced anywhere. |
| [docs/](docs/AGENTS.md) | Operator runbooks — currently one doc covering the Stripe → Authorize.Net checkout migration. |
| [android/](android/AGENTS.md) | Capacitor-generated Android project (Gradle/Java/XML), wraps the built web app as a native shell. Mostly auto-generated scaffolding. |
| [ios/](ios/AGENTS.md) | Capacitor-generated iOS/Xcode project, same role as `android/` for iOS. |
| [email_templates/](email_templates/AGENTS.md) | 3 standalone HTML email templates (abandoned-cart drip sequence) — not currently wired into any function or script in this repo. |
| [archive/](archive/AGENTS.md) | Deprecated reference-only code — a legacy patient-hub HTML/JS implementation superseded by `src/pages/hub.astro`. Not referenced by any build or redirect config. |
| [models/](models/AGENTS.md) | Two 3D body-mesh `.obj` files + two large anthropometric measurement `.json` files. Not referenced anywhere in `src/` or `public/` — appears to be an orphaned/future-feature asset. |
| [new-503-drugs/](new-503-drugs/AGENTS.md) | 8 PDF reference documents (compounding pharmacy product info sheets) — regulatory/patient-info reference material, not code. |
| [.github/](.github/workflows/AGENTS.md) | GitHub Actions CI — daily SEO content generation, image optimization/regeneration, Lighthouse audits, broken-link checking, uptime monitoring. |

## For AI Agents
### Working In This Directory
- The site is **currently gated**: every route except a short allow-list renders the waitlist page (`netlify.toml` "COMING SOON GATE" block). Do not assume `/pricing`, `/checkout`, etc. are reachable in production without checking this first. See `WAITLIST.md` before touching routing.
- There are effectively **two frontends** coexisting: the live Astro app (`src/pages/*.astro`, 22 routes) and a much larger set of legacy static HTML pages served from `public/` verbatim. When a task mentions a page by URL, check `src/pages/` first (the modern surface); if it's not there, look in `public/`.
- `pricing.json` at repo root is the pricing source of truth — the Netlify checkout functions import it directly. Don't hardcode prices elsewhere without checking this file first.
- Six standalone pages render their own complete `<html>` document instead of using `src/layouts/Layout.astro` (checkout, waitlist, compare, `/preview`'s prototype/index, assessment-quiz, assessment-design-2) — `astro.config.mjs` injects tracking scripts via `head-inline` specifically so these six still get them.

### Testing Requirements
- `npm test` is a stub — no unit tests exist. Use `npm run test:e2e` (Playwright, config in `playwright.config.ts`, specs in `tests/e2e/`) for the closest thing to an automated regression suite.
- `npm run build` (Astro build) is the fastest correctness check for `src/` changes — it catches most `.astro`/TypeScript errors.
- No `tsconfig.json` exists at the repo root; type checking is whatever Astro/Vite do implicitly during build.

### Common Patterns
- `wl-` CSS class prefix is the shared design-system namespace for the modern Astro vertical landing pages (weight-loss, hair-loss, sexual-wellness, longevity, how-it-works, pricing, about, partner-pharmacies, legal pages) — separate from the legacy `global.css`/`style/style.css` cascade used by `public/` pages.
- Automated commits from CI bots follow a recognizable pattern in git history: `🤖 Auto-SEO: new article + rebuilt blog` (daily-seo.yml) and `🎨 Regenerated all blog hero images via DALL-E 3` (regenerate-images.yml).

## Dependencies
### Internal
- `src/` is the composition root for the live site; `netlify/functions/` is its backend; `supabase/` and Netlify Blobs are its data stores.
- `content/` + root-level scripts (`build_blog.js`, `seo-agent.js`, `refill-keywords.js`) form a separate legacy SEO pipeline feeding `public/`'s static pages.

### External
- **Netlify** — hosting, Functions runtime, scheduled jobs, redirects/headers, Blobs storage.
- **Astro** (v7) + **Tailwind CSS** v4 — frontend framework/styling.
- **Supabase** — Postgres + Auth + PostgREST (lead capture, waitlist, patient-hub auth).
- **Stripe** and **Authorize.Net** — payment processing (Authorize.Net is a documented in-progress migration; see `docs/AUTHORIZE_NET_SETUP.md`).
- **MD Integrations (MDI)** — telehealth/EHR partner; creates patients, cases, prescriptions.
- **Capacitor** — wraps the site as native Android/iOS apps (`android/`, `ios/`).
- OpenAI API (`gpt-4o`, DALL-E 3) — the SEO blog/article and image generation pipeline (`.github/workflows/daily-seo.yml`, `regenerate-images.yml`).
- Google Fonts, GA4, Meta Pixel, Microsoft Clarity, Whop (conversion pixel), Tidio/Tawk.to (chat widgets, one per era) — see the CSP allowlist in `netlify.toml` for the full third-party surface.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
