<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# .github/workflows/

## Purpose
GitHub Actions CI/CD for the repo: automated SEO content generation, image tooling, performance/link auditing, and uptime monitoring. Several of these workflows commit directly back to `main` under a bot identity (`Freeley Auto-SEO Bot <bot@freeley.com>`), which is the source of the recurring `🤖 Auto-SEO: new article + rebuilt blog` and `🎨 Regenerated all blog hero images via DALL-E 3` commits visible in git history.

## Key Files
| File | Description |
|------|-------------|
| `daily-seo.yml` | **Daily SEO Content Engine.** Trigger: cron `0 12 * * *` (12 PM UTC / 8 AM EST daily) + manual `workflow_dispatch`. Runs `node refill-keywords.js` (tops up `content/seo-keywords.txt`), then `node seo-agent.js` (OpenAI `gpt-4o` writes one new Markdown article from the next queued keyword into `content/blog/`), then `node build_blog.js` (regenerates the root-level `<slug>.html`, `blog.html`, `sitemap.xml`). Commits `content/blog/*.md`, `content/seo-keywords.txt`, `*.html`, `sitemap.xml` and pushes to `main`. Requires `OPENAI_API_KEY` secret. |
| `regenerate-images.yml` | **Regenerate Blog Images (DALL-E 3).** Trigger: manual `workflow_dispatch` only. Runs `node regenerate-blog-images.js` then `node build_blog.js`, commits `assets/blog/`, `content/blog/*.md`, `*.html`, `sitemap.xml`. Requires `OPENAI_API_KEY` secret. |
| `image-optimizer.yml` | **Image Optimizer.** Trigger: `pull_request` touching `**.jpg`/`**.jpeg`/`**.png`/`**.webp`. Uses `calibreapp/image-actions` to compress images in the PR (jpeg/png/webp quality 80) and commit the optimized versions back to the PR branch. |
| `lighthouse.yml` | **SEO & Performance Auditor.** Trigger: `push`/`pull_request` on `main`. Runs Lighthouse CI (`treosh/lighthouse-ci-action`) against `lighthouserc.json` at the repo root, uploads results to temporary public storage. |
| `link-checker.yml` | **Broken Link Checker.** Trigger: cron `0 2 * * 0` (2 AM UTC every Sunday) + manual `workflow_dispatch`. Runs `lycheeverse/lychee-action` over all `*.html`/`*.md` files (excludes social-media/app-store domains), opens a GitHub issue titled "🚨 Broken Links Detected" on failure. |
| `uptime-monitor.yml` | **Uptime Monitor.** Trigger: cron `*/30 * * * *` (every 30 minutes) + manual `workflow_dispatch`. `curl`s `https://freeley.com`, fails the job (no issue/notification step) if the status code isn't 200. Note: while the "coming soon" waitlist gate is active (see root `WAITLIST.md`), the site force-rewrites every route to 200, so this check effectively only confirms the domain resolves and Netlify is serving *something*. |

## For AI Agents
### Working In This Directory
- `daily-seo.yml` and `regenerate-images.yml` are the ones that write to `content/` and to the ~141 root-level `.html` files documented in the root `AGENTS.md` — if you see unexplained new `.md`/`.html` files or blog-image changes in git history, check these workflows before assuming a human made them.
- Both content-writing workflows push straight to `main` with no PR/review step — be aware that CI can change `content/blog/`, root `*.html`, and `sitemap.xml` at any time (daily, in the case of `daily-seo.yml`).
- `OPENAI_API_KEY` must be set as a repository secret for `daily-seo.yml` and `regenerate-images.yml` to succeed; missing it fails the workflow silently up to whatever `refill-keywords.js`/`seo-agent.js`/`regenerate-blog-images.js` do on API error.
- These workflows write to the repo root and `content/` — they do **not** touch `public/`, so their output does not appear on the live site until someone manually re-syncs (see the root-level `.html` note in the root `AGENTS.md`).

### Testing Requirements
No tests here — these are automation/ops workflows. Verify changes by checking the Actions tab run logs after a push, or trigger `workflow_dispatch`-enabled workflows manually to test.

### Common Patterns
- Workflows that commit back to the repo use `git config --global user.name "Freeley Auto-SEO Bot"` / `user.email "bot@freeley.com"` and `git commit ... || echo "No changes"` so a no-op run doesn't fail the job.
- `actions/checkout`, `actions/setup-node` (Node 22) are pinned to major version tags (`@v4`/`@v5`) across the newer workflows; `lighthouse.yml` still uses older `@v3` actions and Node 18 — inconsistent, not yet unified.

## Dependencies
### Internal
- `daily-seo.yml` → `refill-keywords.js`, `seo-agent.js`, `build_blog.js`, `content/seo-keywords.txt`, `content/blog/`.
- `regenerate-images.yml` → `regenerate-blog-images.js`, `build_blog.js`, `assets/blog/`.
- `lighthouse.yml` → `lighthouserc.json` (repo root).

### External
- OpenAI API (`gpt-4o` for articles, DALL-E 3 for images) via `OPENAI_API_KEY`.
- `calibreapp/image-actions`, `treosh/lighthouse-ci-action`, `lycheeverse/lychee-action`, `peter-evans/create-issue-from-file` (third-party GitHub Actions).
- `freeley.com` (production domain) — polled by `uptime-monitor.yml`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
