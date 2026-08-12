<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# content/

## Purpose
Data used by the site's SEO blog pipeline: a queue of target keywords and the markdown blog posts generated from them. This directory is **not** an Astro content collection — the Astro app under `src/` (which serves `/hub`) does not read from here. Instead, `content/` is consumed by plain Node scripts at the repo root (`seo-agent.js`, `build_blog.js`) that compile each markdown post into a static `.html` file published at the repo root and deployed as-is by Netlify alongside the Astro build.

## Key Files
| File | Description |
|------|-------------|
| `seo-keywords.txt` | Queue of target SEO keywords/phrases, one per line, no header. `seo-agent.js` pops the first line each run, uses it as the article topic, and rewrites this file with the remainder. `refill-keywords.js` (repo root) tops the queue back up when it runs low. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `blog/` | 140 markdown blog posts (one file per article, YAML frontmatter + Markdown body). See `blog/AGENTS.md` for the frontmatter schema and authoring conventions. |

## For AI Agents
### Working In This Directory
- Do not confuse this with an Astro content collection — there is no `content.config.ts`/`src/content.config.ts` in this repo, and `astro.config.mjs` does not reference `content/` at all. `grep`ing `src/` for `getCollection`/`defineCollection` turns up nothing.
- The actual consumer pipeline (in repo-root scripts, not this directory):
  1. `refill-keywords.js` — replenishes `seo-keywords.txt` when it runs low.
  2. `seo-agent.js` — reads the first line of `seo-keywords.txt`, calls the OpenAI API (`gpt-4o`) with a fixed prompt to write a Markdown article with YAML frontmatter, saves it to `content/blog/<slug>.md`, and rewrites `seo-keywords.txt` minus that keyword.
  3. `build_blog.js` — reads every `content/blog/*.md` file with `gray-matter` + `marked`, renders each into a standalone static HTML page at the **repo root** (`/<slug>.html`), regenerates `blog.html` (the blog index/hub grid) and `sitemap.xml`.
- This entire pipeline is triggered daily by `.github/workflows/daily-seo.yml` ("Daily SEO Content Engine", cron `0 12 * * *`), which runs all three scripts in order and then commits with the bot identity `Freeley Auto-SEO Bot <bot@freeley.com>` — this is the source of the recurring `🤖 Auto-SEO: new article + rebuilt blog` commits in git history.
- If you add a keyword to `seo-keywords.txt` manually, add it as a new line (existing lines have no trailing punctuation or quoting).

### Testing Requirements
- No automated tests cover this directory. After manually adding/editing a blog post, run `node build_blog.js` from the repo root to regenerate the corresponding `.html` file, `blog.html`, and `sitemap.xml` before committing.

### Common Patterns
- Keywords in `seo-keywords.txt` are lowercase, natural-language search phrases (e.g. `telemedicine services for erectile dysfunction`), not slugs.
- `seo-agent.js` derives the output slug/filename by lowercasing the *keyword* and replacing non-alphanumeric runs with `-` — it does not use the AI-generated title for the filename.

## Dependencies
### Internal
- `../seo-agent.js`, `../build_blog.js`, `../refill-keywords.js` — consume/produce this directory's contents.
- `../.github/workflows/daily-seo.yml` — orchestrates the automation.
- `../shared.css`, `../shared.js`, `../assets/` — used by the static HTML pages `build_blog.js` generates from these posts.

### External
- `gray-matter`, `marked` (npm) — frontmatter parsing and Markdown-to-HTML rendering in `build_blog.js`.
- OpenAI API (`gpt-4o`) — article generation in `seo-agent.js`, requires `OPENAI_API_KEY`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
