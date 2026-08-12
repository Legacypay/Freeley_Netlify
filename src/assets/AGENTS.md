<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# src/assets/

## Purpose
Image assets referenced via `astro:assets` (`import x from '../assets/...'` + Astro's `<Image>` component), which lets Astro/Sharp optimize and resize these images at build time. This is distinct from `public/assets/`, whose contents ship untouched — anything that needs `astro:assets` optimization (logos, hero cutouts, badges, product vials) lives here instead. Purely a data tree: no `.astro`, `.ts`, or other code files live under this directory, and no AGENTS.md files exist in its subdirectories (they are asset dumps, not code).

## Subdirectories
| Directory | Contents (by name/usage) |
|-----------|---------------------------|
| `badges/` | Trust badges used in page hero sections and trust bars — LegitScript (`49921676.png`), HIPAA (`hipaa_badge.png`), Trustpilot (`trust_pilot.png`), Made-in-USA (`usa_badge.png`). All `.png`. |
| `before-after/` | Two before/after patient photo pairs (`before.png`/`after.png`, `before2.png`/`after2.png`) used in hair-loss-style progress galleries. All `.png`. |
| `brand/` | Freeley logo files — transparent green and white `.webp` wordmarks (used by `Header.astro`/`Footer.astro`) plus one legacy `.png` mask/graphic asset. |
| `figma-v5/` | Design-export assets for the `/prototype`-lineage homepage: a hero couple photo (`.jpg`, plus an `.original.jpg` unprocessed source), 4 press-logo PNGs (Bloomberg, Forbes, NYT, TechCrunch), and 4 product-vial PNGs (one per treatment vertical). |
| `home/` | Single mobile hero image (`hero-mob.png`) for the homepage. |
| `icons/` | Two small UI icon PNGs — `arrow-circle-right.png`, `close.png`. |
| `products-imgs/` | 4 numbered product images (`image-18.png`–`image-21.png`) used on the pricing page's plan cards. |
| `waitlist/` | Assets for the `/waitlist` gate page — a hero photo (`hero-green-2.png`), a troche hero (`freeley_troche_hero.jpg`), and per-vertical product vial/troche PNGs (weight loss, sexual wellness, hair loss, longevity) shown in the "what's launching" preview grid. |

## For AI Agents
### Working In This Directory
- Do **not** create AGENTS.md files inside these subdirectories — they are image dumps, not code, and don't warrant per-directory documentation.
- New images that need Astro's build-time optimization (resizing, format conversion) should be added under an appropriately-named subfolder here and imported via `astro:assets`, not dropped into `public/assets/` (which serves files as-is, unoptimized).
- File naming here is inconsistent by design (some folders use kebab-case, some numbered, some copied verbatim from Figma exports) — match the existing convention within whichever subfolder you're adding to rather than imposing a new one site-wide.

### Testing Requirements
N/A — no code to test. Confirm new images actually render via `npm run dev` on the page that imports them.

### Common Patterns
N/A — this is a static asset tree, not code.

## Dependencies
### Internal
- Imported from `.astro` frontmatter across `../pages/` and `../components/` via relative paths (e.g. `import logo from '../assets/brand/freeley_logo_transparent_green.webp'`).
### External
- Astro's built-in `astro:assets` image pipeline (Sharp, at build time).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
