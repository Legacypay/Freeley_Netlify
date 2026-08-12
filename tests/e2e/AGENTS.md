<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# tests/e2e/

## Purpose
Playwright end-to-end browser test suite for the Astro site. Per `playwright.config.ts`, these tests run against the **built and previewed** site (`npm run build && npm run preview`, served at `http://localhost:4321`) — not `astro dev` — so results reflect minified production output with no Vite HMR noise or dev-only routes. Two Playwright projects are configured: `desktop` (Desktop Chrome, runs everything) and `mobile` (Pixel 7 viewport, scoped to `responsive.spec.ts` only via `testMatch`).

## Key Files
| File | Tests |
|------|-------|
| `pages.ts` | Not a test file — shared `PAGES` array (name + path) enumerating all 22 Astro routes under `src/pages/*.astro`, used by the cross-page sweep specs below. |
| `carousels.spec.ts` | Swiper carousel instances across pages — asserts `swiper-initialized` class and exercises next/prev via the instance API (`el.swiper`), since no pages use `navigation` arrows. Filters out known dev-only Sharp/image-processing console noise. |
| `checkout-and-waitlist.spec.ts` | `src/pages/checkout.astro` form flow and `src/pages/waitlist.astro` signup. Explicitly does NOT test/fix: checkout's fake ~2s `setTimeout` "payment" (no real Stripe/Authorize.Net call — asserted as fact, not a bug), or the known-broken pricing Monthly/Quarterly toggle. |
| `console-errors.spec.ts` | Loads every page in `PAGES` and fails on any `console.error` or uncaught page error (warnings excluded, e.g. Swiper's harmless loop-mode warning). |
| `faq-accordions.spec.ts` | `.faq-item` accordion open/close behavior (driven by `public/style/script.js` toggling an `open` class) across `/hair-loss`, `/index-backup`, `/longevity`, `/pricing`, `/sexual-wellness`, `/weight-loss`. |
| `links-and-404s.spec.ts` | Crawls every page in `PAGES`, collecting internal `href="/..."` links and images, asserting no broken internal links/images site-wide. |
| `navigation.spec.ts` | `Header.astro`/`Footer.astro` nav + footer links, scoped to pages that actually import them (`/weight-loss`, `/pricing`, `/about`) — `index.astro`/`compare.astro` render their own inline chrome and are out of scope. |
| `pricing-toggle.spec.ts` | The `/pricing` Monthly/Quarterly billing toggle. Contains a `test.fixme()` (not a plain failing test) documenting a known, deliberately-unfixed bug: the toggle only swaps a CSS class and doesn't affect any displayed price; flagged `NEEDS_CLIENT_INPUT`. |
| `product-toggles.spec.ts` | Per-vertical medication toggle (`[data-medication]` buttons inside `.medication-toggle`) on weight-loss/hair-loss/sexual-wellness/longevity pages — asserts title, price, product image, and active-button state all update on click. |
| `quiz-funnel.spec.ts` | `src/components/QuizModal.astro`, the shared assessment-quiz modal used by all vertical pages — exercised via `/weight-loss` as a representative entry point (fetches `/assessment-quiz` markup, clones it into the modal, initializes `public/quiz-scripts/asw.js`). Regression-tests a previously-fixed double-click-binding bug. |
| `responsive.spec.ts` | No-horizontal-overflow sweep across `PAGES` under the `mobile` Playwright project (Pixel 7 viewport). Scoped to pages that render `Header.astro`. |
| `tracking-pixels.spec.ts` | Site-wide tracking script presence on load — GA4, Microsoft Clarity (via `analytics.js`), Whop pixel, and `attribution.js` first-touch capture — spot-checked on `/weight-loss`, `/`, `/waitlist`. Notes `analytics.js` self-gates (HIPAA) on paths containing `quiz`, `checkout`, or `hub`. |

## Subdirectories
None.

## For AI Agents
### Working In This Directory
- Framework: **Playwright** (`@playwright/test`), configured at the repo-root `playwright.config.ts` (`testDir: './tests/e2e'`, `baseURL: 'http://localhost:4321'`, `fullyParallel: true`, `trace: 'retain-on-failure'`).
- Cross-page sweep specs (`console-errors`, `links-and-404s`, `responsive`) all import the shared `PAGES` list from `./pages.ts` — add a new route there, not by duplicating a page array per spec, when a new Astro page is added.
- Several specs document known, intentionally-out-of-scope bugs inline (fake checkout payment, broken pricing toggle) rather than silently working around them — read the comment block at the top of a spec before "fixing" behavior it asserts is a known limitation.

### Testing Requirements
Run via `npm run test:e2e` (headless, `playwright test`) or `npm run test:e2e:ui` (interactive UI mode). The Playwright `webServer` config runs `npm run build && npm run preview` automatically and reuses an existing server outside CI (`reuseExistingServer: !process.env.CI`) — you don't need to manually start the preview server first, but a stale existing server on port 4321 will be reused rather than rebuilt.

### Common Patterns
- Standard `test`/`expect`/`test.describe` from `@playwright/test`.
- `test.fixme()` (not a failing assertion) for known, deliberately-unfixed bugs pending a product/client decision — follow this convention rather than adding a plain failing test for a known issue.
- Filtering known dev-only or third-party noise (Sharp image-processing errors, Swiper warnings, Tawk chat widget long-polling) out of console-error assertions rather than loosening the assertion itself.

## Dependencies
### Internal
Exercises the built Astro site: `src/pages/*.astro`, `src/components/*.astro` (notably `Header.astro`, `Footer.astro`, `QuizModal.astro`), and `public/` client scripts (`public/style/script.js`, `public/quiz-scripts/asw.js`).

### External
`@playwright/test` (devDependency, repo root `package.json`).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
