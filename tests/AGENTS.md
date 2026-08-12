<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# tests/

## Purpose
Test suites for the Freeley telehealth marketing site: an offline/live integration-validation script for the MDI (pharmacy/EHR) product mapping used by the Netlify Functions checkout backend, plus a Playwright end-to-end suite covering the live Astro front end (see `tests/e2e/AGENTS.md`).

## Key Files
| File | Description |
|------|-------------|
| `integration-check.js` | Standalone Node script ("Freeley × MDI Integration Validation Suite") — a hand-rolled test runner (no test framework dependency) that validates product-key mapping, pharmacy IDs, and dose-tier resolution against `netlify/functions/lib/products.js` (`PRODUCTS`, `PHARMACIES`, `getPharmacyId`, `resolveProductKey`, `SEMAGLUTIDE_TIERS`, `TIRZEPATIDE_TIERS`), cross-checked against an `EXPECTED_INTAKES` table hand-transcribed from the MDI mapping spreadsheet (CSV intake-form associations per product). Also exercises live MDI API connectivity when `MDI_CLIENT_ID`/`MDI_CLIENT_SECRET` are set in the environment; without them it still runs full offline validation and `skip()`s the live-API cases. Run directly: `node tests/integration-check.js`. Not wired into `package.json` scripts or CI — run manually when touching product/pharmacy mapping logic in `netlify/functions/lib/products.js`. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `e2e/` | Playwright end-to-end browser test suite exercising the built/previewed Astro site. See `tests/e2e/AGENTS.md`. |

## For AI Agents
### Working In This Directory
- `integration-check.js` imports directly from `../netlify/functions/lib/products` — if that module's exports change shape, this script's assertions will need updating too.
- The file header notes it was "UPDATED 2026-05-06: Rebuilt for DTP compound structure with dose-tiered semaglutide (S1-S5) and tirzepatide (T1-T4)" — treat product/tier naming conventions there as the current source of truth for that domain.

### Testing Requirements
- `node tests/integration-check.js` — for product/pharmacy-mapping changes under `netlify/functions/lib/`. Set `MDI_CLIENT_ID`/`MDI_CLIENT_SECRET` to also exercise live API connectivity; otherwise offline-only checks run.
- `npm run test:e2e` (`playwright test`) / `npm run test:e2e:ui` (`playwright test --ui`) — for front-end/page changes. See `tests/e2e/AGENTS.md` for details. Note: the root `package.json` `"test"` script (`npm test`) is an unrelated placeholder (`echo "Error: no test specified" && exit 1`) — it is not either of these suites.

### Common Patterns
Hand-rolled `test()`/`skip()`/`assert()` helpers (not Jest/Vitest/etc.) for the offline script; standard Playwright `test`/`expect` for the e2e suite.

## Dependencies
### Internal
- `integration-check.js` → `netlify/functions/lib/products.js`.
- `e2e/*` → the built Astro site (`src/pages/*.astro`, `src/components/*`), driven via `playwright.config.ts` at the repo root.

### External
- `@playwright/test` (devDependency) for the e2e suite.
- No external test framework for `integration-check.js` (plain Node).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
