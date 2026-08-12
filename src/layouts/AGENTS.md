<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# src/layouts/

## Purpose
Single shared page shell used by most (but not all) pages in `src/pages/`. Provides the common `<html>/<head>/<body>` document structure — font links, global stylesheets, favicon, the page `<title>`, and a mobile Tawk.to-widget size fix — so individual pages only need to supply their own `<title>` and body content.

## Key Files
| File | Description |
|------|-------------|
| `Layout.astro` | The site's one layout. Props: `title: string` (required — sets `<title>{title}</title>`), `bodyClass?: string` (applied to `<body>`). Renders a full `<!doctype html>` document: Google Fonts preconnects/links (Playfair Display, Inter, Poppins, plus the "Impeccable direction" Source Serif 4 / Archivo / Archivo Narrow pairing used by the `wl-` design system), Swiper CSS via CDN, `/global.css` and `/style/style.css` from `public/`, favicon links, and a global `<style>` fix that scales up Tawk.to's mobile chat-launcher iframe (targeted via `iframe[title*="chat" i]` since Tawk's widget is a cross-origin iframe the site can't otherwise restyle). Two `<slot>`s: `slot="head"` (rendered last in `<head>`, so page-supplied styles/links there outrank everything above) and the default slot (page body content). Also includes inline `/preview`-path-awareness JS that rewrites same-origin link clicks to stay under `/preview/*` while browsing the pre-launch preview (excludes `/assessment-quiz`, since `QuizModal.astro` handles that link specially). |

## Subdirectories
None.

## For AI Agents
### Working In This Directory
- Not every page uses `Layout.astro`. Standalone pages (`index.astro`, `compare.astro`, `checkout.astro`, `assessment-quiz.astro`, `assessment-design-2.astro`, `waitlist.astro`) render their own complete `<html>` document instead, each with its own font/stylesheet links. Check for `import Layout from '../layouts/Layout.astro'` in a page's frontmatter before assuming this shell applies.
- Pages that do use it typically pass page-scoped `<style is:inline>` blocks through `<Fragment slot="head">` — this is how each vertical/legal page keeps its own CSS scoped without touching `Layout.astro` itself.
- `import '../styles/tailwind.css'` in `Layout.astro`'s frontmatter is what pulls Tailwind's Preflight reset into every page using this layout — this is also why `QuizModal.astro` has to explicitly restore `margin: auto` on its `<dialog>` (Tailwind's reset zeroes it, and author styles beat UA defaults).

### Testing Requirements
No automated tests. Changes here affect every page using the layout — verify against at least one hot-path vertical page and one legal page after any edit.

### Common Patterns
N/A — single file, no repeated pattern to document beyond the slot convention above.

## Dependencies
### Internal
- `../styles/tailwind.css`.
### External
- Google Fonts (Playfair Display, Inter, Poppins, Source Serif 4, Archivo, Archivo Narrow — all via `<link>`, no local font files), Swiper CSS (CDN), `/global.css` and `/style/style.css` (static files served from `public/`, not part of `src/`), Tawk.to (live chat, embedded per-page rather than here).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
