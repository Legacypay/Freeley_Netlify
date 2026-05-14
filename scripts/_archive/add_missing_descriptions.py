"""
Insert a <meta name="description"> into every HTML page that lacks one.

Strategy:
  - Pull the <title> (strip " | Freeley" / " — Freeley" suffix).
  - Pull the first content paragraph (<p>...</p>) under the <body>.
  - Combine into a ~150-char description and insert it after the <title>.

Run once from the repo root.
"""
from pathlib import Path
import re
import html as html_lib

REPO = Path(__file__).resolve().parents[2]

TITLE_RE = re.compile(r'<title>(.*?)</title>', re.IGNORECASE | re.DOTALL)
DESC_RE = re.compile(r'<meta\s+name="description"', re.IGNORECASE)
P_RE = re.compile(r'<p[^>]*>(.*?)</p>', re.IGNORECASE | re.DOTALL)
TAG_RE = re.compile(r'<[^>]+>')

SUFFIXES = [' | Freeley', ' — Freeley', ' - Freeley', ' | Freeley Health']

def clean(s):
    s = html_lib.unescape(s)
    s = TAG_RE.sub(' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def build_description(title, paragraph):
    base = title
    for suf in SUFFIXES:
        if base.endswith(suf):
            base = base[: -len(suf)].strip()
            break
    if paragraph:
        combined = f"{base}. {paragraph}"
    else:
        combined = base
    if len(combined) > 158:
        cut = combined[:155].rsplit(' ', 1)[0]
        combined = cut.rstrip('.,;:') + '…'
    return combined

def process(path: Path):
    text = path.read_text(encoding='utf-8', errors='ignore')
    if DESC_RE.search(text):
        return False
    title_match = TITLE_RE.search(text)
    if not title_match:
        return False
    title = clean(title_match.group(1))
    if not title:
        return False
    paragraph = ''
    body_idx = text.lower().find('<body')
    body_text = text[body_idx:] if body_idx >= 0 else text
    for m in P_RE.finditer(body_text):
        candidate = clean(m.group(1))
        if 40 <= len(candidate) <= 400:
            paragraph = candidate
            break
    desc = build_description(title, paragraph)
    desc = desc.replace('"', "'")
    new_tag = f'  <meta name="description" content="{desc}">\n'
    new_text = TITLE_RE.sub(lambda m: m.group(0) + '\n' + new_tag.rstrip('\n'), text, count=1)
    path.write_text(new_text, encoding='utf-8')
    return True

def main():
    changed = 0
    for path in sorted(REPO.glob('*.html')):
        # Skip 404 and app/auth shells (we set descriptions on those manually)
        if path.name in ('404.html', 'checkout.html', 'hub.html', 'quiz.html', 'app-index.html'):
            continue
        if process(path):
            print(f'  + {path.name}')
            changed += 1
    print(f'Updated: {changed}')

if __name__ == '__main__':
    main()
