<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# src/styles/

## Purpose
The two global CSS files in the project's Vite/Tailwind pipeline (as opposed to the many page-scoped `<style is:inline>` blocks living directly inside `.astro` files, and the legacy `public/global.css`/`public/style/style.css`, which define the CSS custom properties — `--green`, `--brand`, `--cream`, `--gold`, `--font-serif`, etc. — that both this directory's and the page-scoped styles build on).

## Key Files
| File | Description |
|------|-------------|
| `tailwind.css` | Tailwind CSS v4 entrypoint (`@import "tailwindcss"`). Overrides Tailwind's default breakpoints in an `@theme` block to match Bootstrap 5's breakpoints (`sm: 576px`, `md: 768px`, `lg: 992px`, `xl: 1200px`, `2xl: 1400px`) — the comment notes this is so classes converted from an earlier Bootstrap-based markup (display/column utility classes) collapse at the same widths they originally did. Imported by `src/layouts/Layout.astro` and by several standalone pages (`assessment-design-2.astro`, `assessment-quiz.astro`, `checkout.astro`, `waitlist.astro`) that render their own `<html>` doc without going through `Layout.astro`. |
| `hub.css` | Cross-cutting styles shared by 2+ `src/components/hub/*.astro` components: the sticky-footer page shell (`.hub-page`, `#dashboard-screen`/`#auth-screen` flex sizing), shared button system (`.hub-btn`, `.hub-btn--outline`, `.hub-btn--sm`, `.hub-btn__ic` "coin" icon chip — deliberately mirrors the marketing pages' `.wl-btn`/`.wl-arw` silhouette), the app-shell grid (`.hub-app`, `.hub-shell`, `.hub-main` — the *only* scroll region on the page, `.hub-grid`), card/badge/empty/loading-state primitives (`.hub-card`, `.hub-card--hero`, `.hub-badge`, `.hub-empty`, `.hub-spinner`), and the provider-message card (`.hub-msg`). Genuinely single-owner style blocks (auth screen, topbar, nav, chat drawer, post-payment banner, panel-only classes like `.hub-med`/`.hub-status`/`.hub-pm`/`.hub-table`) live scoped inside their own `Hub*.astro` component instead — see `src/components/hub/AGENTS.md`. Imported once, as a plain Vite CSS import (same pattern as `tailwind.css`), from `src/pages/hub.astro`'s frontmatter. |

## Subdirectories
None.

## For AI Agents
### Working In This Directory
- `hub.css` only contains classes genuinely shared by 2+ components — before adding a new class here, check whether it actually belongs scoped inside a single `Hub*.astro` component instead (the file's own top comment states this rule explicitly).
- Neither file defines the site's actual design tokens (colors/fonts) — those live in `public/style/style.css`'s `:root`, outside `src/`. Both files here (and every `wl-`/`hub-` scoped style elsewhere) consume `var(--green)` etc. rather than redefining them.
- `tailwind.css`'s breakpoint overrides matter for any Bootstrap-derived utility class (`d-md-flex`, `col-lg-6`, etc.) still present in older/legacy markup — don't "fix" them to Tailwind's stock breakpoints without checking for that.

### Testing Requirements
No automated tests. Verify visually — `hub.css` changes should be checked against `/hub` at both desktop and the `900px` mobile-drawer breakpoint; `tailwind.css` changes should be checked against any page still using Bootstrap-style utility classes.

### Common Patterns
N/A — two files, each documented individually above.

## Dependencies
### Internal
- `hub.css` is consumed by every component in `../components/hub/`.
### External
- `tailwindcss` (npm package, v4 `@import` syntax — no `tailwind.config.js`, configuration lives in the `@theme` block itself).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
