<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# assets/

## Purpose
Root-level, image-only asset tree (confirmed via glob — no code, no markup files other than images). This is a **third, distinct** asset directory in this repo, alongside `src/assets/` (Astro-processed/imported assets) and `public/assets/` (the directory Astro actually publishes verbatim to the site root, i.e. what every `src="/assets/..."` reference in `src/pages/*.astro` and `src/components/*.astro` resolves to at runtime).

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `blog/` | Blog post hero/cover images (`.jpg`), one per slug, matching `content/blog/*.md` post filenames. |
| `brand/` | Logo, icon, and vial/product art, including a `_figma_v5/` subfolder of Figma-exported assets for a specific design revision. |
| `lifestyle/` | Lifestyle/stock-style photography. |
| `og/` | Open Graph share-card images. |
| `physicians/` | Physician/provider photos. |
| `promo/` | Promotional graphics. |
| `videos/` | Video assets. |

Do not create `AGENTS.md` files inside these subdirectories.

## Live-vs-orphaned finding
**Not directly served by the live Astro site, but not simply orphaned either — it's the working directory of a separate, parallel legacy pipeline.**

- Every `/assets/...` path referenced in `src/pages/*.astro` and `src/components/*.astro` (e.g. `/assets/brand/freeley_logo_transparent_green.png`, `/assets/hl/hero-cutout.png`) resolves at build/runtime to **`public/assets/...`**, since Astro copies `public/` to the site root and `astro.config.mjs` sets no alternate public/out dir. Grepping `src/` for `"/assets/` confirms every hit is a root-relative URL string, not an import of this top-level directory — Astro's asset pipeline never touches this `assets/` folder.
- However, this root-level `assets/` is exactly where the **repo-root legacy static-HTML pipeline** operates: `build_blog.js`/`seo-agent.js`/`refill-keywords.js`/`regenerate-blog-images.js` (the "Auto-SEO" system driven by `.github/workflows/daily-seo.yml` and `regenerate-images.yml`) generate/regenerate root-level `*.html` blog pages from `content/blog/*.md`, and those workflows explicitly `git add assets/blog/` after regenerating images — i.e. this directory (specifically `assets/blog/`) is that pipeline's live working output.
- Per `netlify.toml`'s build comment, the actual **deployed** copies of those legacy pages/images live under `public/` ("Legacy pages ... were copied as-is into `public/` — Astro passes through `public/` untouched"), and `public/assets/blog/` currently mirrors `assets/blog/` file-for-file (20/20 files match). The same comment flags a **known gap**: `build_blog.js`'s output is not wired into the Astro build, so newly-generated files here need a **manual re-sync into `public/`** before they actually go live.

**Practical implication for agents:** editing/adding files under this `assets/` directory (via the root Auto-SEO scripts or by hand) has no effect on the live site until those files are also copied into the corresponding `public/assets/...` path. If asked to update a blog image or brand asset that's meant to be live, check whether the target is this directory, `public/assets/`, or `src/assets/` before assuming a change is visible.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
