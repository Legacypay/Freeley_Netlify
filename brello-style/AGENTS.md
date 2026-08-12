<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# brello-style/

## Purpose
A visual reference / mood-board tree of 153 image files (jpg, jpeg, png, webp) — screenshots and exported assets from a competitor or theme reference (the directory name suggests a "Brello" Shopify theme). It mirrors the shape of a marketing site: a `pages/` tree of page-type screenshots and a `products/` tree of per-product screenshots. There is no code, markdown, or text content anywhere in this tree — confirmed by a full file-extension scan of all 153 files. These images are design inspiration/reference material only.

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `pages/about-us/` | Reference screenshots/crops for an "About Us" page layout. |
| `pages/blog/` | Reference screenshots/crops for a blog listing/article page layout. |
| `pages/contact-us/` | Reference screenshots/crops for a "Contact Us" page layout. |
| `pages/faq/` | Reference screenshots/crops for an FAQ page layout. |
| `pages/home/` | Reference screenshots/crops for the homepage layout (hero sections, app promo imagery, fitness/nutrition class visuals, background textures). |
| `pages/shop/` | Reference screenshots/crops for a shop/product-listing page layout. |
| `pages/start-wellness/` | Reference screenshots/crops for a "start/onboarding" wellness funnel page layout. |
| `products/compounded-nad/` | Reference imagery for a compounded NAD product page/listing. |
| `products/compounded-sermorelin/` | Reference imagery for a compounded Sermorelin product page/listing. |
| `products/empowered-longevity-lifestyle-plan/` | Reference imagery for an "Empowered Longevity" lifestyle-plan product page/listing. |
| `products/glutathione/` | Reference imagery for a glutathione product page/listing. |
| `products/micc/` | Reference imagery for a MIC/MICC (lipotropic injection) product page/listing. |
| `products/midlife-thrive/` | Reference imagery for a "Midlife Thrive" product/plan page/listing. |
| `products/semaglutide-b6/` | Reference imagery for a semaglutide + B6 product page/listing. |
| `products/thrive-forward-longevity-lifestyle-plan/` | Reference imagery for a "Thrive Forward Longevity" lifestyle-plan product page/listing. |
| `products/tirzepatide-b6/` | Reference imagery for a tirzepatide + B6 product page/listing. |

## For AI Agents
### Working In This Directory
- **This tree is not part of the live site and is not source code.** Nothing under `brello-style/` is imported, referenced, or built by the Astro app (`src/`), the legacy static HTML pages at the repo root, or any build script (`build_blog.js`, `astro.config.mjs`, etc.).
- Treat every file here as a passive design/competitor reference asset, not as a production image to link to, optimize, or ship. Do not add code, content collections, or build steps that read from this directory.
- Do not create AGENTS.md files inside `pages/`, `products/`, or their subfolders — this single root file documents the whole tree.

### Testing Requirements
None — no code, no build step touches this directory.

### Common Patterns
- Filenames are inconsistent/raw export names (some are UUID-style, e.g. `366ef3ef-8004-4321-bcd9-46003ff099e9.jpg`; others are descriptive, e.g. `glutathione-thumb.webp`, `Beyond_Use_Date_900x600.webp`) — treat them as opaque reference assets, not a naming convention to replicate elsewhere in the repo.

## Dependencies
### Internal
None — this tree is not referenced by any other part of the repo.

### External
None.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
