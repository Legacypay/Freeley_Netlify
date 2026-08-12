<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# src/

## Purpose
Primary Astro application source for the Freeley telehealth marketing site. This directory holds no files of its own — everything lives in typed subdirectories following Astro's standard project layout (pages, components, layouts, lib, data, styles, assets). The site is a set of physician-prescribed-care marketing verticals (weight loss, hair loss, sexual wellness, longevity) plus a Supabase-backed patient portal ("Health Hub"), a multi-step assessment quiz, and legal/compliance pages, all currently gated behind a waitlist page at the Netlify layer (see `netlify.toml`).

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| [pages/](pages/AGENTS.md) | File-based routes — 22 `.astro` pages, one per URL. Includes the three hot-path vertical landing pages. |
| [components/](components/AGENTS.md) | Shared, reusable `.astro` components (header, footer, modals, legal-article chrome) plus the `hub/` subtree for the patient portal UI. |
| [layouts/](layouts/AGENTS.md) | Single shared `Layout.astro` — the `<html>/<head>/<body>` shell most pages wrap themselves in. |
| [lib/](lib/AGENTS.md) | Client-side TypeScript modules — Supabase helpers, plus the `hub/` subtree of patient-portal business logic (auth, chat, dashboard data). |
| [data/](data/AGENTS.md) | Static typed data modules — currently the Freeley-vs-competitors comparison table (`compare.ts`). |
| [styles/](styles/AGENTS.md) | Global CSS — Tailwind entrypoint and the Health Hub's shared stylesheet. |
| [assets/](assets/AGENTS.md) | Build-time-optimized images (via `astro:assets`), organized into per-feature subfolders. |

## For AI Agents
### Working In This Directory
- Astro uses **file-based routing**: every `.astro` file directly under `src/pages/` becomes a route at the matching URL (`src/pages/hair-loss.astro` → `/hair-loss`, `src/pages/index.astro` → `/`). There is no separate router config.
- Most marketing pages import `Layout` from `src/layouts/Layout.astro` plus `Header`/`Footer`/`QuizModal` from `src/components/`, then define page-scoped CSS in a `<style is:inline>` block passed via the `slot="head"` fragment. A few standalone pages (`index.astro`, `compare.astro`, `checkout.astro`, `assessment-quiz.astro`) render their own complete `<html>` document instead of using `Layout.astro`.
- TypeScript is used for typed data (`src/data/`) and client-side logic (`src/lib/`), imported into `.astro` files either in frontmatter (build-time) or in `<script>` tags (browser-side, real ES modules — see `src/lib/hub/supabase.ts` for why that specifically matters on the Hub page).
- The whole site currently sits behind a waitlist gate enforced in `netlify.toml` (a catch-all rewrite to `/waitlist`), independent of anything in `src/`. `WAITLIST.md` at the repo root documents removing it.

### Testing Requirements
No test suite exists in this repo. Verify changes with `npm run dev` / `npm run build` (Astro's own build-time checks catch most breakage) and manual browser verification of the affected route.

### Common Patterns
- **`wl-` class prefix**: the shared "vertical landing" design-system namespace introduced on `/weight-loss` and reused on `/hair-loss`, `/sexual-wellness`, `/longevity`, `/how-it-works`, `/pricing`, `/about`, `/partner-pharmacies`, and the legal pages — keeps these pages' styles off the legacy `public/global.css`/`public/style/style.css` cascade.
- **Shared closing CTA**: `<FinalCta>` (`src/components/FinalCta.astro`) is the single source of truth for the "Feel better, starting today" band with drifting pill decorations — do not hand-roll a page-local copy.
- **Quiz modal**: `<QuizModal />` (`src/components/QuizModal.astro`) intercepts clicks on any `<a href="/assessment-quiz">` and opens the quiz in a `<dialog>` instead of navigating. Nearly every page renders it once, near the end of `<body>`.
- **Data/CSS single-sourcing**: comparison data lives once in `src/data/compare.ts` and is read by both `/compare` (full table) and the homepage capsule (`heroRows` subset) to prevent drift.

## Dependencies
### Internal
- All subdirectories are cross-referenced from `src/pages/*.astro`, which is the composition root for the whole app.
### External
- Astro (framework), Tailwind CSS v4 (`@import "tailwindcss"` in `src/styles/tailwind.css`), `@supabase/supabase-js` (auth + data for the waitlist form and the Health Hub), Swiper (carousels, loaded via CDN `<script>`/`<link>` tags rather than an npm import), RemixIcon (Hub UI icon font, CDN).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
