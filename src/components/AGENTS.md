<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# src/components/

## Purpose
Shared, reusable `.astro` components used across the marketing pages: site chrome (header/footer), the two modal systems (quiz, product-info popup), and the shared legal-article layout. The `hub/` subdirectory (see its own AGENTS.md) holds a separate set of components specific to the logged-in Health Hub patient portal and is not used by any marketing page.

## Key Files
| File | Description |
|------|-------------|
| `FinalCta.astro` | Shared closing-CTA band ("Feel better, starting today") with an array-driven, animated decorative pill background (`ctaPills`). Takes a `features: string[]` prop and three slots (`default` = heading, `subheading`, `cta`). Centralizes what used to be a duplicated per-page section so background/pill styling can't drift page to page. |
| `Footer.astro` | Site-wide `<footer>`, mirrors the homepage's own footer markup exactly. Treatments/Company/Legal link columns, brand blurb, copyright + compounded-medication disclaimer line. No props. |
| `Header.astro` | Site-wide `<header>`: logo, nav links (7 items — 4 verticals + How It Works/Pricing/About), "Start Assessment" CTA (`id="start-assessment-header"`, opened by `QuizModal.astro`'s wiring or falls back to navigating to `/assessment-quiz` if no modal exists on the page), mobile burger + slide-down panel. Also contains `/preview`-path-awareness logic that rewrites internal links so browsing the pre-launch preview stays under `/preview/*`. No props. |
| `LegalArticle.astro` | Shared chrome for the 4 legal/compliance pages (`privacy.astro`, `terms.astro`, `hipaa.astro`, `telehealth-consent.astro`). Renders `Layout` + `Header` + hero (`eyebrow`/`heroPlain`/`heroEm`/`updated` props) + a styled body wrapper for the default slot (verbatim legal HTML) + `FinalCta` (via `ctaHeading`/`ctaSub` slots + `ctaFeatures` prop) + `Footer` + `QuizModal`. Props: `metaTitle`, `eyebrow`, `heroPlain`, `heroEm`, `updated?`, `ctaFeatures: string[]`. |
| `ProductInfoModal.astro` | Generic "plan details" `<dialog>` popup used by `/hair-loss`, `/sexual-wellness`, `/longevity` product showcases to present non-photo info (What's Included, Clinical Timeline, Shipping, Benefits) as a tabbed panel instead of stuffing them into the product-photo carousel as fake slides. Exports `InfoItem`/`InfoSection` TS interfaces. Props: `sections: InfoSection[]`, `idSuffix: string`, `triggerLabel?: string`. Self-contained client `<script>` wires tab switching, open/close, and backdrop-click dismissal per-instance via `document.querySelectorAll("[data-pim]")`. |
| `QuizModal.astro` | The free-assessment quiz rendered inside a `<dialog id="quizModal">`. Built on native `<dialog>`/`showModal()` for top-layer stacking, `::backdrop`, Escape-to-close, and focus-trapping. Progressive enhancement: quiz CTAs stay real `<a href="/assessment-quiz">` links; a document-level delegated click listener intercepts them, fetches `/assessment-quiz`, clones its `.quiz-popup` markup into the dialog, and runs `window.initFreeleyQuiz()` (from `public/quiz-scripts/asw.js`). Also wires `Header.astro`'s `#start-assessment-header` button. No props — rendered once per page, usually near the end of `<body>`. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| [hub/](hub/AGENTS.md) | Components composing the `/hub` patient-portal dashboard (auth screen, topbar, sidebar nav, 4 panel views, chat widget, post-payment banner). Not used outside `src/pages/hub.astro`. |

## For AI Agents
### Working In This Directory
- These components assume the CSS custom properties defined in `public/style/style.css`'s `:root` (`--green`, `--brand`, `--cream`, `--gold`, `--font-serif`, `--font-sans`, `--font-condensed`, etc.) are already loaded — they don't redefine tokens themselves.
- `QuizModal.astro` and `ProductInfoModal.astro` are both built on the native `<dialog>` element rather than a div+z-index approach — keep that pattern for any new modal (top-layer stacking, backdrop, focus trap, and Escape-to-close all come free from the platform).
- `FinalCta.astro`'s slotted content (not hardcoded copy) lets each page keep its own button/modal-trigger wiring (some link into `QuizModal`, some navigate directly) while sharing layout/background.

### Testing Requirements
No automated tests. Verify any modal change by opening it via the dev server and confirming Escape/backdrop-click/tab-switching still work.

### Common Patterns
- Components that get their markup injected at runtime via `innerHTML` (not compiled by Astro) use `<style is:global>` instead of Astro's default scoped styles — see `ProductInfoModal.astro`'s comment and the `hub/` components for the same pattern.
- Buttons that are plain-text "link" actions use `<button>` rather than `<a href="#">`, to sidestep a sitewide `a:not([class*="btn"])` CSS trap that forces anchor text blue.

## Dependencies
### Internal
- `../layouts/Layout.astro` (LegalArticle.astro only).
- `../lib/hub/*` is NOT imported here — only by `hub/` subcomponents.
### External
- Font Awesome (icon glyphs used inline in some SVG/quiz markup), no JS framework — all component scripts are vanilla TS/JS in `<script>` tags.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
