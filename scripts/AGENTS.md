<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# scripts/

## Purpose
One-off / on-demand **AI image generation** utilities for populating `public/assets/...` imagery across the Astro site (hero photos, transparent cutout portraits, icon art, before/after treatment photos, etc.). These are manually invoked from the command line — they are NOT wired into `npm run build`, `npm run dev`, or any `package.json` "scripts" entry, and are not part of any GitHub Actions workflow either. They are dev-time content tooling only.

**Important:** this directory is *not* the "Auto-SEO" blog generator referenced in commits like "🤖 Auto-SEO: new article + rebuilt blog". That pipeline (`refill-keywords.js`, `seo-agent.js`, `build_blog.js`, `regenerate-blog-images.js`) lives at the **repo root**, not here, and is driven by `.github/workflows/daily-seo.yml` and `.github/workflows/regenerate-images.yml`. The two scripts in this directory are a separate, unrelated tool for generating/editing arbitrary image assets used by the Astro pages.

## Key Files
| File | Description |
|------|-------------|
| `generate-images.js` | Generic image generate/edit tool. Given a manifest JSON, for each entry: if `output` already exists, backs it up as `<name>.original.<ext>` (once) and sends the current image + prompt to the image model for a true image-conditioned edit ("keep everything identical, only change X"), resized to match the original's own dimensions; if it doesn't exist, does pure text-to-image (or edits from another manifest entry's already-generated output via `editFrom`) at the manifest's `width`/`height`. Uses `sharp` to resize/reformat the result before writing. Run: `node scripts/generate-images.js <manifest.json>`. |
| `generate-cutout-images.js` | Generates transparent full-body **cutout** portraits (matching the site's hero convention, e.g. `public/assets/wl/hero.png`). Always generates fresh (no edit mode): forces every prompt to describe the subject against a solid green-screen backdrop, then does its own chroma-key removal — sampling the actual backdrop color from the image's four corners (the model doesn't reproduce an exact hex from text), keying by green-dominance rather than fixed color distance so it's robust to the model's lighting gradient/vignette, applying edge de-spill to avoid a green fringe/halo on hair, then cropping to the actual alpha content bounding box before the final resize so the subject fills the canvas the way the site's existing hero cutouts do. Run: `node scripts/generate-cutout-images.js <manifest.json>`. |

Both scripts import from `./lib/` (see `scripts/lib/AGENTS.md`) for the actual model call, and both throttle with a 3s delay between manifest entries and continue past individual failures (reporting a final `success/total` count).

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `lib/` | Shared, interchangeable image-generation backends (Gemini "nano banana" and OpenAI `gpt-image-1`) that both top-level scripts call through a common `generateImage(prompt, sourceImage)` interface. See `scripts/lib/AGENTS.md`. |
| `_archive/` | Deprecated one-off Python scripts and scrape dumps from the pre-Astro static-HTML iteration of the site. Not part of the active build — see `scripts/_archive/AGENTS.md`. Do not run or depend on these unless explicitly asked to resurrect something from them. |

## For AI Agents
### Working In This Directory
- The 14 `image-manifest*.json` files (`image-manifest.json`, `image-manifest-p1.json`, `image-manifest-round2.json`, `image-manifest-hiw-*.json`, `image-manifest-cutouts.json`, `image-manifest-cellular-fix.json`, `image-manifest-hl-retry.json`, `image-manifest-targeted-fix.json`, `image-manifest-vial-retry.json`, etc.) are **data files, not code** — each is an ad-hoc, dated batch of image-generation jobs (an array of `{ output, prompt, width?, height?, editFrom? }` objects) created for a specific past request (a round of hero-image fixes, a "how it works" platform illustration set, a vial photo retry, etc.). They are historical/one-shot inputs to the two scripts above, kept for reference/re-run rather than as ongoing config. When adding a new batch of image jobs, create a new manifest file following the same shape rather than editing an old one in place.
- `output` (and `editFrom`) paths inside manifests are repo-root-relative and almost always point into `public/assets/...` — that's the directory that's actually served by the Astro site (see the root-level `assets/` folder's own `AGENTS.md` for why the *other*, similarly-named `assets/` directory at the repo root is a different, largely-unrelated tree).
- Both scripts require an API key in the environment (`GEMINI_API_KEY` for `lib/gemini-image.js`, `OPENAI_API_KEY` for `lib/openai-image.js`) and will hard-exit immediately if it's missing.

### Testing Requirements
No automated tests target this directory. Validate changes by running a script against a small manifest and visually inspecting the resulting file(s) under `public/assets/`.

### Common Patterns
- Manifest-driven batch processing with per-entry try/catch so one bad prompt/API error doesn't abort the whole run.
- Always resize/reformat through `sharp` after the raw model output, so output dimensions and file format are deterministic regardless of what the model actually returned.

## Dependencies
### Internal
- `scripts/lib/gemini-image.js`, `scripts/lib/openai-image.js` — shared model-call backends.
- Writes into `public/assets/**` (see `public/AGENTS.md` if present, or the site's Astro pages under `src/pages/*.astro` for how those paths get referenced).

### External
- `sharp` (npm) — image resize/format conversion.
- Gemini API (`gemini-2.5-flash-image`) and/or OpenAI API (`gpt-image-1`), called directly via `fetch`, no SDK dependency.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
