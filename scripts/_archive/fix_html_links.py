"""
Convert internal <a href="x.html"> → <a href="/x"> across the entire repo.

WHY: Each time Googlebot crawls a page that links to /weight-loss.html,
it follows the link, hits a 301, and re-flags the URL as "Page with
redirect" in Search Console. Cleaning internal links eliminates the
recurring discovery of the alternate URL.

Safety:
  - Only rewrites href values matching a known internal page name.
  - Skips external links (http(s)://, //, mailto:, tel:, #).
  - Skips 404.html (Netlify-special).
  - Leaves <img>, <script>, <link> alone (only href on <a> / <form>).
  - Idempotent: re-running is a no-op.
"""

from pathlib import Path
import re

REPO = Path(__file__).resolve().parents[2]

# Internal pages that have a clean-URL form. Maps "old.html" -> "/new"
INTERNAL_PAGES = {
    'index.html':         '/',
    'weight-loss.html':   '/weight-loss',
    'sexual-wellness.html': '/sexual-wellness',
    'hair-loss.html':     '/hair-loss',
    'longevity.html':     '/longevity',
    'pricing.html':       '/pricing',
    'quiz.html':          '/quiz',
    'about.html':         '/about',
    'contact.html':       '/contact',
    'faq.html':           '/faq',
    'physicians.html':    '/physicians',
    'how-it-works.html':  '/how-it-works',
    'blog.html':          '/blog',
    'checkout.html':      '/checkout',
    'hub.html':           '/hub',
    'privacy.html':       '/privacy',
    'terms.html':         '/terms',
    'hipaa.html':         '/hipaa',
    'telehealth.html':    '/telehealth',
    'telehealth-consent.html': '/telehealth-consent',
    'partner-pharmacies.html': '/partner-pharmacies',
    'quality.html':       '/quality',
    'app-index.html':     '/app-index',
    # Promo pages
    'promo-weight-loss.html': '/promo-weight-loss',
    'promo-ed.html':      '/promo-ed',
    'promo-hair-loss.html': '/promo-hair-loss',
    'promo-longevity.html': '/promo-longevity',
}

# Skip these paths (special-case files Netlify or the CMS expect to keep .html)
SKIP_TARGETS = {'404.html'}

# Match `href="..."` or `href='...'` (no scheme, no anchor only).
HREF_RE = re.compile(r'''\bhref=["']([^"'#?]+?)(\?[^"']*)?(\#[^"']*)?["']''')

def transform(match):
    target = match.group(1)
    qs = match.group(2) or ''
    fragment = match.group(3) or ''
    # Skip external + protocol-relative + non-link schemes
    if target.startswith(('http:', 'https:', '//', 'mailto:', 'tel:', 'javascript:', 'data:')):
        return match.group(0)
    if target in SKIP_TARGETS:
        return match.group(0)
    # Bare filename with .html?
    if target in INTERNAL_PAGES:
        new = INTERNAL_PAGES[target] + qs + fragment
        return f'href="{new}"'
    # Sub-path variations like "/weight-loss.html" or "./weight-loss.html"
    stripped = target.lstrip('./').lstrip('/')
    if stripped in INTERNAL_PAGES:
        new = INTERNAL_PAGES[stripped] + qs + fragment
        return f'href="{new}"'
    return match.group(0)

def process(path):
    text = path.read_text(encoding='utf-8', errors='ignore')
    new_text = HREF_RE.sub(transform, text)
    if new_text != text:
        path.write_text(new_text, encoding='utf-8')
        return True
    return False

def main():
    changed = []
    # Scan all HTML + JS files (links can be in JS too)
    for ext in ('*.html', '*.js'):
        for p in REPO.glob(ext):
            if process(p):
                changed.append(p.name)
    # Also scan netlify functions JS — sometimes redirects mention paths
    for p in (REPO / 'netlify' / 'functions').glob('*.js'):
        if process(p):
            changed.append('netlify/functions/' + p.name)
    print(f'Updated {len(changed)} file(s):')
    for name in changed:
        print('  -', name)

if __name__ == '__main__':
    main()
