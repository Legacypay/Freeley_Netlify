<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# public/style/

## Purpose
10 CSS files plus one shared interaction script, all **live** — this is the stylesheet set for the Astro pages (`../../src/pages/*.astro`), not the legacy `.html` pages (which use `../shared.css` instead, per `../AGENTS.md`). One file, `style.css`, is the sitewide base (linked from `../../src/layouts/Layout.astro`, so every Astro page gets it); the rest are single-page stylesheets, each named after and linked by exactly one `.astro` page.

## Key Files
| File | Description |
|------|-------------|
| `style.css` (3,775 lines) | Sitewide base stylesheet — linked directly in `../../src/layouts/Layout.astro`, so every Astro page gets it. Its `:root` block is the canonical source of the design tokens (`--green`, `--green-deep`, `--brand`, `--cream`, `--ink`, `--muted`, `--gold`, `--line`, `--card`, `--font-serif`, `--font-sans`, `--font-condensed`) that page-scoped `<style>` blocks and shared components consume via `var(...)` rather than redefining (see `../../src/components/AGENTS.md`, `../../src/styles/AGENTS.md`). Also carries an older, separate `--primary-color`/`--secondary-color` token pair (legacy palette, still used by some component styles) plus large "Header section" and "Footer section" blocks. Also explicitly `<link>`ed a second time by `checkout.astro`, `assessment-quiz.astro`, and `assessment-design-2.astro` (redundant with the `Layout.astro` include, but harmless — same file). |
| `checkoutstyle.css` (840 lines) | `checkout.astro` only. Defines its own `._palette` custom-property namespace (`--forest`, `--cream`, `--im8-red`, `--gold`, `--playfair` = "Playfair Display", `--poppins` = "Inter") independent of `style.css`'s tokens, plus `._canvas`/`._display*` typographic classes. |
| `quizstyle.css` (1,173 lines) | Standalone `.quiz-popup`/`.quiz-card` modal styles (750px max-width). Linked by `assessment-quiz.astro`, and also dynamically injected at runtime by `../../src/components/QuizModal.astro` (`addStylesheetOnce('/style/quizstyle.css')`) — so it backs the shared quiz-modal component wherever it's rendered (e.g. on `hair-loss.astro`), not just the standalone quiz page. Backgrounds reference `../assets/quiz/f-overlay.png`. |
| `quiz2style.css` (1,268 lines) | `assessment-design-2.astro` only — a full-width variant of the quiz popup (`max-width: 100%`, 1440px inner card, `#f4f2ed` background) rather than the 750px modal treatment in `quizstyle.css`. Not shared with `QuizModal.astro`. |
| `blogsstyle.css` (607 lines) | `blogs.astro` only. |
| `faqsstyle.css` (670 lines) | `faqs.astro` only. |
| `pricestyle.css` (568 lines) | `pricing.astro` only. |
| `qualitystyle.css` (1,045 lines) | `quality-trust.astro` only. |
| `worksstyle.css` (558 lines) | `how-it-works.astro` only. |
| `aboutstyle.css` (1,568 lines) | `about.astro` only. |
| `script.js` (74 lines) | Shared interaction script (not page-specific) linked by `blogs.astro`, `faqs.astro`, `pricing.astro`, `hair-loss.astro`, `sexual-wellness.astro`, `longevity.astro`, and `weight-loss.astro`. Three independent behaviors: (1) FAQ accordion — click-toggles `.open` on `.faq-item`/`.faq-question`, closing siblings; (2) mobile nav toggle — shows/hides `.navbar-nav-custom.d-lg-none` on `.navbar-toggler-custom` click; (3) sticky mobile assessment bar — pins `#start-assessment` to the viewport top below the 768px breakpoint on scroll, guarded so pages without that anchor (e.g. `weight-loss.astro`) simply no-op. |

`aboutstyle.css`, `blogsstyle.css`, `faqsstyle.css`, `pricestyle.css`, `qualitystyle.css`, and `worksstyle.css` all open with the same duplicated `:root` token block (legacy `--primary-color`/`--secondary-color`/`--bg-cream`/`--dark-green`/etc.) — a copy-paste convention from the pre-Astro-migration design system, not an accident. Editing one of those tokens in one file does not affect the others; if the palette needs to change sitewide, all six need editing.

## For AI Agents
### Working In This Directory
- Before editing a page-specific stylesheet, confirm which single `.astro` page links it (see table above) — these files are not shared, so changes are scoped to that one route.
- `style.css` is the exception: it's sitewide. A change there affects every Astro page via `Layout.astro`, plus whatever the explicit second `<link>` pages layer on top.
- `quizstyle.css` is also cross-cutting via `QuizModal.astro` — check where the shared quiz modal is rendered (currently at least `hair-loss.astro`) before assuming a change only affects `assessment-quiz.astro`.
- The six files sharing the duplicated `:root` block (see above) are not wired together — a token fix needs to be applied six times, or consolidated deliberately.

### Testing Requirements
No automated tests. Verify visually with `npm run build` + a local preview, or `netlify dev`, on the one page each stylesheet backs.

### Common Patterns
- Page-specific stylesheets are named `<page>style.css` and linked with a leading-slash absolute path from the matching `.astro` file's `<head>` (e.g. `<link rel="stylesheet" href="/style/faqsstyle.css" />` in `faqs.astro`).
- Design tokens are consumed via `var(--token)`, not redeclared, in every file except the six carrying their own duplicated legacy `:root` block and `checkoutstyle.css`'s independent `._palette` namespace.

## Dependencies
### Internal
- `../../src/layouts/Layout.astro` (links `style.css` sitewide)
- `../../src/pages/*.astro` (each links its own single-page stylesheet)
- `../../src/components/QuizModal.astro` (dynamically loads `quizstyle.css`)
- `../assets/quiz/f-overlay.png` (background image referenced from `quizstyle.css`)

### External
- Google Fonts: Playfair Display, Inter (referenced via `checkoutstyle.css`'s `--playfair`/`--poppins` tokens; the actual `<link>` tags live in the consuming `.astro` pages/`Layout.astro`, not here).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
