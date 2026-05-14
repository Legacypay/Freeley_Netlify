"""
Add loading="lazy" decoding="async" to <img> tags that don't already have them.
Skips images with fetchpriority="high" (those are the eager hero ones).

Idempotent: re-running is safe.
"""
from pathlib import Path
import re

REPO = Path(__file__).resolve().parents[2]

IMG_RE = re.compile(r'<img\b([^>]*?)/?>', re.IGNORECASE | re.DOTALL)

def transform_attrs(attrs: str) -> str:
    a = attrs
    if 'fetchpriority="high"' in a or 'fetchpriority=high' in a:
        return attrs
    if 'loading=' not in a:
        a += ' loading="lazy"'
    if 'decoding=' not in a:
        a += ' decoding="async"'
    return a

def process(path: Path) -> int:
    text = path.read_text(encoding='utf-8', errors='ignore')
    count = 0
    def replace(m):
        nonlocal count
        original_attrs = m.group(1)
        new_attrs = transform_attrs(original_attrs)
        if new_attrs == original_attrs:
            return m.group(0)
        count += 1
        return f'<img{new_attrs}>'
    new_text = IMG_RE.sub(replace, text)
    if count:
        path.write_text(new_text, encoding='utf-8')
    return count

def main():
    total = 0
    files_changed = 0
    for path in sorted(REPO.glob('*.html')):
        c = process(path)
        if c:
            total += c
            files_changed += 1
    print(f'Updated {files_changed} files, {total} <img> tags')

if __name__ == '__main__':
    main()
