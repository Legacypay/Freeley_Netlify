"""
SEO batch 1 — schema + internal linking.

Adds to every applicable HTML page:
  1. FAQPage schema  (extracted from .faq-item / .faq-q markup)
  2. BreadcrumbList schema  (derived from URL path + page title)
  3. Article schema  (blog articles only — @type Article + author org +
     datePublished/dateModified from sitemap lastmod)
  4. Inline internal linking — first occurrence of key treatment terms
     in blog article body becomes a link to the relevant treatment page.

Idempotent: every injected block is wrapped with a marker comment so
re-running the script doesn't double-inject. Safe to run repeatedly.
"""

from pathlib import Path
import re
import json
from datetime import date
from html import unescape

REPO = Path(__file__).resolve().parents[2]

# ─── helpers ──────────────────────────────────────────────────

MARKER_FAQ = '<!-- SEO_FAQ_SCHEMA_AUTO -->'
MARKER_CRUMB = '<!-- SEO_CRUMB_SCHEMA_AUTO -->'
MARKER_ARTICLE = '<!-- SEO_ARTICLE_SCHEMA_AUTO -->'
MARKER_INTERNAL = '<!-- SEO_INTERNAL_LINK_DONE -->'

TAG_RE = re.compile(r'<[^>]+>')


def strip_tags(s):
    return unescape(TAG_RE.sub(' ', s)).strip()


def collapse_ws(s):
    return re.sub(r'\s+', ' ', s).strip()


def title_of(html):
    m = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
    return collapse_ws(strip_tags(m.group(1))) if m else None


def head_close_index(html):
    m = re.search(r'</head>', html, re.IGNORECASE)
    return m.start() if m else None


def inject_before_head_close(html, block):
    idx = head_close_index(html)
    if idx is None:
        return html
    return html[:idx] + block + '\n' + html[idx:]


def already_has(html, marker):
    return marker in html


# ─── 1. FAQPage schema ────────────────────────────────────────

FAQ_BLOCK_PATTERNS = [
    # promo-page style: <div class="faq-item"> ... <div class="faq-q">Q</div> ... <div class="faq-a">A</div>
    (
        re.compile(r'<div\s+class="faq-item"[^>]*>(.*?)</div>\s*</div>', re.IGNORECASE | re.DOTALL),
        re.compile(r'<div\s+class="faq-q"[^>]*>(.*?)</div>\s*<div\s+class="faq-a"[^>]*>(.*?)</div>', re.IGNORECASE | re.DOTALL),
    ),
    # treatment-page style: <button class="faq-question">Q</button><div class="faq-answer"><div class="faq-answer-inner">A
    (
        re.compile(r'<div\s+class="faq-item"[^>]*>(.*?)</div>\s*</div>', re.IGNORECASE | re.DOTALL),
        re.compile(r'<button[^>]*class="faq-question"[^>]*>(.*?)</button>.*?<div\s+class="faq-answer-inner"[^>]*>(.*?)</div>', re.IGNORECASE | re.DOTALL),
    ),
]


def extract_faqs(html):
    """Return list of (question, answer) plaintext pairs, or empty list."""
    faqs = []
    # promo-page pattern first
    for q_match in re.finditer(r'<div\s+class="faq-q"[^>]*>(.*?)</div>\s*<div\s+class="faq-a"[^>]*>(.*?)</div>', html, re.IGNORECASE | re.DOTALL):
        q = collapse_ws(strip_tags(q_match.group(1)))
        a = collapse_ws(strip_tags(q_match.group(2)))
        if q and a and len(q) > 5 and len(a) > 10:
            faqs.append((q, a))
    # treatment-page pattern
    for q_match in re.finditer(r'<button[^>]*class="faq-question"[^>]*>(.*?)</button>.*?<div\s+class="faq-answer-inner"[^>]*>(.*?)</div>', html, re.IGNORECASE | re.DOTALL):
        q = collapse_ws(strip_tags(q_match.group(1)))
        a = collapse_ws(strip_tags(q_match.group(2)))
        if q and a and len(q) > 5 and len(a) > 10:
            # de-dupe in case it overlapped with above pattern
            if not any(q == eq for eq, _ in faqs):
                faqs.append((q, a))
    return faqs


def build_faq_schema(faqs):
    data = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': [
            {
                '@type': 'Question',
                'name': q,
                'acceptedAnswer': {'@type': 'Answer', 'text': a}
            }
            for q, a in faqs
        ]
    }
    body = json.dumps(data, indent=2, ensure_ascii=False)
    return f'{MARKER_FAQ}\n<script type="application/ld+json">\n{body}\n</script>'


# ─── 2. BreadcrumbList schema ────────────────────────────────

PRETTY_NAMES = {
    '/': 'Home',
    'weight-loss': 'GLP-1 Weight Loss',
    'sexual-wellness': 'Sexual Wellness',
    'hair-loss': 'Hair Loss',
    'longevity': 'Longevity & Peptides',
    'how-it-works': 'How It Works',
    'pricing': 'Pricing',
    'physicians': 'Our Physicians',
    'about': 'About',
    'contact': 'Contact',
    'faq': 'FAQ',
    'blog': 'Blog',
    'hipaa': 'HIPAA',
    'telehealth': 'Telehealth',
    'privacy': 'Privacy',
    'terms': 'Terms',
    'quality': 'Quality',
    'partner-pharmacies': 'Partner Pharmacies',
    'telehealth-consent': 'Telehealth Consent',
}


def humanize_slug(slug):
    if slug in PRETTY_NAMES:
        return PRETTY_NAMES[slug]
    # Title-case from slug, keeping common acronyms
    parts = slug.replace('-', ' ').split()
    pretty = []
    for p in parts:
        if p.upper() in ('GLP', 'ED', 'NAD', 'B12', 'HSA', 'FSA', 'FDA', 'USA', 'HIPAA', 'BBB'):
            pretty.append(p.upper())
        elif p.lower() in ('vs',):
            pretty.append(p.lower())
        else:
            pretty.append(p.capitalize())
    return ' '.join(pretty)


def categorize_slug(slug):
    """Decide what hub a blog-style article belongs under for breadcrumbs."""
    s = slug.lower()
    if any(k in s for k in ('semaglutide', 'tirzepatide', 'glp-1', 'glp1', 'weight-loss', 'weight_loss', 'compounded-glp', 'mounjaro', 'ozempic', 'mic', 'b12-mic')):
        return 'weight-loss', 'GLP-1 Weight Loss'
    if any(k in s for k in ('finasteride', 'minoxidil', 'hair-loss', 'hair_loss', 'dutasteride', 'receding')):
        return 'hair-loss', 'Hair Loss'
    if any(k in s for k in ('ed-', 'erectile', 'tadalafil', 'sildenafil', 'troche', 'sexual')):
        return 'sexual-wellness', 'Sexual Wellness'
    if any(k in s for k in ('peptide', 'sermorelin', 'nad', 'glutathione', 'longevity')):
        return 'longevity', 'Longevity & Peptides'
    return None, None


def build_breadcrumb_schema(slug, page_title):
    """Slug is the file basename without .html. '' or 'index' = homepage."""
    base = 'https://freeley.com'
    items = [{'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': base + '/'}]

    if slug in ('', 'index'):
        return None  # Don't show breadcrumb on the home page itself

    # Top-level routes get just Home → page
    top_level = set(PRETTY_NAMES.keys()) - {'/'}
    if slug in top_level:
        items.append({
            '@type': 'ListItem',
            'position': 2,
            'name': humanize_slug(slug),
            'item': f'{base}/{slug}'
        })
    else:
        # Blog/article — sit under a category hub if we can categorize
        cat_slug, cat_name = categorize_slug(slug)
        if cat_slug:
            items.append({
                '@type': 'ListItem',
                'position': 2,
                'name': cat_name,
                'item': f'{base}/{cat_slug}'
            })
            items.append({
                '@type': 'ListItem',
                'position': 3,
                'name': humanize_slug(slug),
                'item': f'{base}/{slug}'
            })
        else:
            items.append({
                '@type': 'ListItem',
                'position': 2,
                'name': 'Blog',
                'item': f'{base}/blog'
            })
            items.append({
                '@type': 'ListItem',
                'position': 3,
                'name': humanize_slug(slug),
                'item': f'{base}/{slug}'
            })

    data = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': items
    }
    body = json.dumps(data, indent=2, ensure_ascii=False)
    return f'{MARKER_CRUMB}\n<script type="application/ld+json">\n{body}\n</script>'


# ─── 3. Article schema (blog articles only) ───────────────────

# Articles = HTML pages that are not core treatment pages or app shells
CORE_PAGES = {
    'index.html', '404.html', 'app-index.html', 'checkout.html', 'hub.html',
    'quiz.html', 'weight-loss.html', 'sexual-wellness.html', 'hair-loss.html',
    'longevity.html', 'pricing.html', 'about.html', 'contact.html', 'faq.html',
    'physicians.html', 'how-it-works.html', 'blog.html', 'privacy.html',
    'terms.html', 'hipaa.html', 'telehealth.html', 'telehealth-consent.html',
    'quality.html', 'partner-pharmacies.html',
    # Promo pages have their own MedicalWebPage schema
    'promo-weight-loss.html', 'promo-ed.html', 'promo-hair-loss.html', 'promo-longevity.html',
}


def parse_sitemap_lastmod():
    """Return {slug: 'YYYY-MM-DD'} from sitemap.xml."""
    sm = REPO / 'sitemap.xml'
    if not sm.exists():
        return {}
    text = sm.read_text(encoding='utf-8', errors='ignore')
    out = {}
    for m in re.finditer(r'<loc>https://freeley\.com/([^<]*?)</loc>\s*<lastmod>([^<]+)</lastmod>', text):
        slug = m.group(1).strip().rstrip('/')
        if not slug:
            slug = 'index'
        out[slug] = m.group(2).strip()
    return out


def find_og_image(html):
    m = re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"', html, re.IGNORECASE)
    return m.group(1) if m else 'https://freeley.com/assets/brand/freeley_logo_primary.png'


def find_description(html):
    m = re.search(r'<meta\s+name="description"\s+content="([^"]+)"', html, re.IGNORECASE)
    return m.group(1) if m else ''


def build_article_schema(slug, html, lastmod_map):
    title = title_of(html) or humanize_slug(slug)
    description = find_description(html)
    image = find_og_image(html)
    url = f'https://freeley.com/{slug}'
    last = lastmod_map.get(slug) or date.today().isoformat()
    data = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': title[:110],  # Google likes <110 chars
        'description': description[:300] if description else None,
        'image': image,
        'datePublished': last,
        'dateModified': last,
        'mainEntityOfPage': {'@type': 'WebPage', '@id': url},
        'author': {
            '@type': 'Organization',
            'name': 'Freeley Health',
            'url': 'https://freeley.com'
        },
        'publisher': {
            '@type': 'Organization',
            'name': 'Freeley Health',
            'logo': {
                '@type': 'ImageObject',
                'url': 'https://freeley.com/assets/brand/freeley_logo_primary.png'
            }
        }
    }
    # Strip Nones
    data = {k: v for k, v in data.items() if v is not None}
    body = json.dumps(data, indent=2, ensure_ascii=False)
    return f'{MARKER_ARTICLE}\n<script type="application/ld+json">\n{body}\n</script>'


# ─── 4. Inline internal linking ───────────────────────────────

INTERNAL_LINK_TERMS = [
    # (regex pattern with word boundaries, target_url, anchor_preserve)
    # First match per file becomes a link; case-insensitive match, preserve original case.
    (re.compile(r'\bsemaglutide\b', re.IGNORECASE), '/weight-loss'),
    (re.compile(r'\btirzepatide\b', re.IGNORECASE), '/weight-loss'),
    (re.compile(r'\bGLP-1\b', re.IGNORECASE), '/weight-loss'),
    (re.compile(r'\bfinasteride\b', re.IGNORECASE), '/hair-loss'),
    (re.compile(r'\bminoxidil\b', re.IGNORECASE), '/hair-loss'),
    (re.compile(r'\bsermorelin\b', re.IGNORECASE), '/longevity'),
    (re.compile(r'\bNAD\+', re.IGNORECASE), '/longevity'),
    (re.compile(r'\btadalafil\b', re.IGNORECASE), '/sexual-wellness'),
    (re.compile(r'\bsildenafil\b', re.IGNORECASE), '/sexual-wellness'),
]

# We only do internal-linking on blog articles, and only inside <p>...</p>
P_RE = re.compile(r'<p\b([^>]*)>(.*?)</p>', re.IGNORECASE | re.DOTALL)


def inject_internal_links(html, current_slug):
    """Replace first occurrence of each treatment term inside <p> tags with a link to the relevant page, unless we're already on that page."""
    if MARKER_INTERNAL in html:
        return html, 0

    used_targets = set()
    inserted_total = 0

    def transform_paragraph(p_match):
        nonlocal inserted_total
        attrs, inner = p_match.group(1), p_match.group(2)
        # Skip paragraphs that already contain a link (avoid nesting)
        if '<a ' in inner.lower():
            return p_match.group(0)
        new_inner = inner
        for term_re, target in INTERNAL_LINK_TERMS:
            if target in used_targets:
                continue
            # Don't link back to the same page we're on
            current_url = f'/{current_slug}'
            if target == current_url or target.lstrip('/') == current_slug:
                continue
            m = term_re.search(new_inner)
            if not m:
                continue
            matched_text = m.group(0)
            replacement = f'<a href="{target}">{matched_text}</a>'
            new_inner = new_inner[:m.start()] + replacement + new_inner[m.end():]
            used_targets.add(target)
            inserted_total += 1
            # Only one link insertion per paragraph for readability
            break
        return f'<p{attrs}>{new_inner}</p>'

    new_html = P_RE.sub(transform_paragraph, html)
    if inserted_total:
        # Mark file so we don't re-run.
        new_html = new_html.replace('</body>', f'{MARKER_INTERNAL}\n</body>', 1)
    return new_html, inserted_total


# ─── orchestrator ─────────────────────────────────────────────

def process_file(path, lastmod_map):
    text = path.read_text(encoding='utf-8', errors='ignore')
    original = text
    slug = path.stem
    actions = []

    # 1. FAQ schema — any page with extractable FAQs and not yet injected
    if not already_has(text, MARKER_FAQ):
        faqs = extract_faqs(text)
        if faqs:
            block = build_faq_schema(faqs)
            text = inject_before_head_close(text, block)
            actions.append(f'FAQ({len(faqs)})')

    # 2. Breadcrumb schema — all pages except literal index/homepage and noindex shells
    if not already_has(text, MARKER_CRUMB) and slug not in ('index', 'app-index', '404'):
        crumb = build_breadcrumb_schema(slug, title_of(text))
        if crumb:
            text = inject_before_head_close(text, crumb)
            actions.append('Crumb')

    # 3. Article schema — only on blog articles (not core pages)
    if not already_has(text, MARKER_ARTICLE) and (path.name not in CORE_PAGES):
        block = build_article_schema(slug, text, lastmod_map)
        text = inject_before_head_close(text, block)
        actions.append('Article')

    # 4. Internal linking — only on blog articles
    if path.name not in CORE_PAGES:
        text, inserted = inject_internal_links(text, slug)
        if inserted:
            actions.append(f'Links({inserted})')

    if text != original:
        path.write_text(text, encoding='utf-8')
        return actions
    return []


def main():
    lastmod_map = parse_sitemap_lastmod()
    changed = 0
    for p in sorted(REPO.glob('*.html')):
        actions = process_file(p, lastmod_map)
        if actions:
            changed += 1
            print(f'  + {p.name:50s} {", ".join(actions)}')
    print(f'\nTotal files updated: {changed}')


if __name__ == '__main__':
    main()
