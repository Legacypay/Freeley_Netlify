<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# content/blog/

## Purpose
140 Markdown blog posts for the Freeley marketing site's SEO blog. Each file is one article: YAML frontmatter followed by a Markdown body. This directory is almost entirely auto-populated: a daily GitHub Actions bot ("Freeley Auto-SEO Bot") generates one new article per day via the OpenAI API and commits it here with the message `🤖 Auto-SEO: new article + rebuilt blog` (see recent git log, and `../AGENTS.md` for the full pipeline). A handful of posts (e.g. `seo-test-article.md`) were added manually for testing.

## Key Files
Not enumerated individually (140 files, uniform structure). Filenames are kebab-case slugs derived from their target SEO keyword, e.g. `where-to-buy-tirzepatide-online-safely.md`, `benefits-of-telehealth-for-hair-loss-solutions.md`. No date prefixes or subfolders — flat directory, one file per article, filename == URL slug (the file is later published at `/<slug>.html` by `build_blog.js`).

## For AI Agents
### Working In This Directory
This directory is consumed by `build_blog.js` at the repo root (see `../AGENTS.md`), **not** by any Astro content collection. When adding a post by hand, match the schema below exactly and re-run `node build_blog.js` afterward to regenerate the static page, `blog.html`, and `sitemap.xml`.

### Frontmatter Schema
Based on sampling 7 representative posts (`503a-compounding-pharmacy-explained.md`, `best-online-weight-loss-clinic-2026.md`, `why-do-i-have-erectile-dysfunction-in-my-30s.md`, `weight-loss-plateau-after-3-months-glp-1.md`, `telehealth-solutions-for-erectile-dysfunction-treatment.md`, `where-to-get-peptide-therapy-for-anti-aging.md`, `florida-telehealth-for-sexual-wellness.md`):

| Field | Required | Type / Format | Notes |
|-------|----------|----------------|-------|
| `title` | Yes | Quoted string | SEO-friendly article title. Used as `<title>` and `<h1>` in the generated page. Falls back to `"Freeley Medical Article"` if missing. |
| `tag` | Yes | Unquoted string, one of a fixed set | Category label shown as the eyebrow/meta line. Observed values: `Medical Education`, `Weight Loss`, `Men's Health`, `Peptides`, `Telehealth`. `seo-agent.js`'s prompt additionally allows `Hair Loss` and `Longevity`. Falls back to `"Medical Education"` if missing. |
| `excerpt` | Yes | Quoted string, 1–2 sentences | Used as the card summary on `blog.html`. Falls back to a generic sentence if missing. |
| `date` | Yes | ISO 8601 timestamp, e.g. `"2023-10-05T10:00:00Z"` | Quoting is inconsistent across files (both `date: "2023-…Z"` and bare `date: 2023-…Z` appear) — both parse fine as YAML. Used to sort `blog.html` newest-first and to build `sitemap.xml` `<lastmod>`. Falls back to `new Date()` (build time) if missing. |
| `image` | No | Quoted relative path, e.g. `"assets/blog/best-online-weight-loss-clinic-2026.jpg"` | Present on only ~20 of 140 posts (a legacy/optional field). **Not read** by `build_blog.js` — the generated page template is typography-only and ignores it. Safe to omit. |

Minimal valid frontmatter block:
```yaml
---
title: "Your SEO-Friendly Title Here"
tag: Weight Loss
excerpt: "One to two sentence summary for search results and the blog index card."
date: "2026-08-12T10:00:00Z"
---
```

### Body Structure
- Pure Markdown, rendered with `marked` (no MDX/Astro components, no raw HTML expected).
- Do **not** include an H1 — the frontmatter `title` already becomes the page's H1; posts start directly with `##` (H2) sections.
- Typical shape: 3–6 `##` sections, some with `###` subsections, mixing prose paragraphs, bold key terms (`**term**`), and bulleted/numbered lists.
- Posts end with an implicit hand-off to the site's CTA (the page template appends its own "Complete Free Assessment" CTA block automatically — do not duplicate one in the Markdown body, though older/manual posts may reference `freeley.com/quiz.html` inline per the AI prompt's instruction).
- Typical length: several hundred to ~1000 words; `build_blog.js` computes read time from word count at 200 wpm.

### Testing Requirements
- No automated tests. After adding/editing a post: run `node build_blog.js` from the repo root and confirm `/<slug>.html`, `blog.html`, and `sitemap.xml` regenerate without errors.
- Filenames must be filesystem-safe/URL-safe kebab-case (`[a-z0-9-]+.md`) — this becomes the live URL path.

### Common Patterns
- Slug/filename is derived from the *source keyword* in `../seo-keywords.txt`, not from the generated `title` — titles are often longer/more editorial than the slug (e.g. slug `weight-loss-plateau-after-3-months-glp-1.md` → title `"Overcoming the Weight Loss Plateau After 3 Months on GLP-1: Strategies and Insights"`).
- Article-topic keywords cluster around Freeley's core verticals: weight loss (semaglutide/tirzepatide/GLP-1), men's health (ED, TRT), hair loss (minoxidil, finasteride), peptides/longevity, and telehealth-in-Florida angles.

## Dependencies
### Internal
- Consumed by `../../build_blog.js` (repo root); populated by `../../seo-agent.js` and the `../../.github/workflows/daily-seo.yml` automation. See `../AGENTS.md` for the full pipeline.

### External
- `gray-matter` — parses the YAML frontmatter block.
- `marked` — renders the Markdown body to HTML.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
