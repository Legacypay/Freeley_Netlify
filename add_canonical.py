import os
import re

canonical_regex = re.compile(r'<link\s+rel=["\']canonical["\'].*?>', re.IGNORECASE)

html_files = [f for f in os.listdir('.') if f.endswith('.html')]

for f in html_files:
    if f.startswith('terms_scrape') or f.startswith('privacy_scrape') or f.startswith('telehealth_scrape'):
        continue

    slug = "" if f == "index.html" else f.replace('.html', '')
    canonical_url = f"https://freeley.com/{slug}" if slug else "https://freeley.com/"
    canonical_tag = f'<link rel="canonical" href="{canonical_url}">'
    
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    if canonical_regex.search(content):
        print(f"Canonical tag already exists in {f}")
        continue
    
    # insert before </head>
    new_content = content.replace('</head>', f'  {canonical_tag}\n</head>', 1)
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(new_content)
    
    print(f"Added canonical tag to {f}: {canonical_url}")
