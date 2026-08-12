<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# scripts/_archive/  — ARCHIVED, NOT PART OF THE ACTIVE BUILD

## Purpose
**This directory is deprecated.** It holds 44 files (40 Python scripts, 3 scraped HTML dumps, 1 zip archive) from an earlier, pre-Astro iteration of the site when it was hand-built as static HTML pages (`quiz.html`, `blog.html`, individual product/legal pages, etc.) rather than the current Astro app under `src/pages/`. None of these scripts run as part of `npm run build`, `npm run dev`, any `package.json` script, or any GitHub Actions workflow. **Do not run or depend on anything here unless the user explicitly asks you to resurrect a specific script for a one-off task.** If you do, treat its file-path assumptions (bare `assets/`, root-level `*.html` pages, `quiz.html`) as stale against the current Astro/`src`+`public` layout and verify/adjust before running.

## Key Files
Representative sample (not exhaustive — 40 `.py` files total follow the same handful of patterns):

| File | Description |
|------|-------------|
| `create_blog.py` | Generated 4 static blog HTML pages + a blog hub page, with hero images from OpenAI's GPT Image 1, against the old root-level `assets/blog/` directory. Superseded by the root-level `build_blog.js` + `content/blog/*.md` pipeline (the current "Auto-SEO" system driven by `.github/workflows/daily-seo.yml`). |
| `seo_batch_1.py` | Idempotent SEO injector for the old static HTML pages — adds FAQPage/BreadcrumbList/Article JSON-LD schema and inline internal links, marking each injected block with an HTML comment so re-runs don't double-inject. |
| `fix_quiz.py`, `patch_quiz.py`, `patch_prices.py`, `patch_tirz.py`, `patch_images.py` | One-off `quiz.html` / pricing / product-copy patchers — regex/string replacement against the old static quiz page, run once to make a specific edit. |
| `process_with_rembg.py`, `remove_bg.py`, `run_rembg.py`, `smart_process.py`, `process_sprites.py`, `slice_sprites.py`, `split_vials.py` | Local image-processing one-offs using `rembg`/`Pillow` — background removal and sprite-sheet slicing for product photography, predating the current `scripts/lib/*-image.js` AI-generation approach. |
| `scrape_legal.py`, `inject_legal.py` | Scraped legal-policy pages (terms/privacy/telehealth-consent) from a competitor site (rugiet.com) and rewrote brand names/emails/domains to Freeley's, for use as a starting draft of the site's own legal pages. |
| `add_canonical.py`, `add_lazy_loading.py`, `add_missing_descriptions.py`, `apply_seo_fixes.py`, `cache_buster.py`, `fix_css_urls.py`, `fix_emojis.py`, `fix_html_links.py`, `format_blog.py`, `update_favicon_refs.py`, `update_name.py` | Assorted single-purpose static-HTML maintenance/SEO patch scripts (canonical tags, lazy-loading attrs, meta descriptions, cache-busting query strings, broken link fixes, emoji cleanup, favicon reference updates, a project-wide brand rename, etc.). |
| `convert_webp.py`, `convert_webp_force.py`, `convert_people.py`, `rename_and_convert.py`, `replace_webp.py`, `replace_icons.py`, `replace_lucide.py`, `fetch_images.py`, `check_images.py`, `generate_premium_vials.py` | Image-format conversion, icon-set replacement, and image-fetch/audit utilities from the same era. |
| `test_bg.py`, `test_pollinations.py`, `test_slice.py` | Ad-hoc test/scratch scripts for the image-processing experiments above. |
| `privacy_scrape.html`, `telehealth_scrape.html`, `terms_scrape.html` | Raw scraped HTML output saved by `scrape_legal.py`, kept as source material. |
| `Freeley_Website.zip` | A zipped snapshot of the site from this earlier static era. |

## Subdirectories
None.

## For AI Agents
### Working In This Directory
- Treat everything here as **historical reference only**. Do not wire any of these into the build, CI, or `package.json`.
- These scripts assume Python 3 with third-party packages (`requests`, `beautifulsoup4`, `Pillow`, `rembg`) that are not part of this repo's Node/npm dependency tree — there is no `requirements.txt` here, so running one requires manually installing whatever it imports.
- Path assumptions inside these scripts (relative `assets/`, root-level `quiz.html`/`blog.html`, etc.) reflect the pre-Astro static-site layout, not the current `src/pages/*.astro` + `public/assets/` structure — do not assume a script's file paths still resolve correctly today.

### Testing Requirements
None — archived, not exercised by any test suite.

### Common Patterns
One-off migration, scraping, image-processing, and SEO-patch scripts, each written to make a single specific change and then be run (at most) a handful of times; several are explicitly idempotent (marker-comment-guarded) but most are not designed for repeat/production use.

## Dependencies
### Internal
None maintained — these predate and are independent of the current `src/`, `scripts/`, and root-level Auto-SEO pipeline.

### External
Python 3 + ad-hoc third-party packages per script (`requests`, `beautifulsoup4`, `Pillow`, `rembg`, etc.) — not tracked in any repo manifest.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
