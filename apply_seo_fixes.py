import os
import re

html_files = [f for f in os.listdir('.') if f.endswith('.html')]

# 1. Update index.html Title
with open("index.html", "r") as f:
    content = f.read()

content = re.sub(
    r"<title>Freeley \| Online Medical Weight Loss & Wellness</title>",
    r"<title>Compounded GLP-1 & Peptide Telehealth | Freeley Wellness</title>",
    content
)
with open("index.html", "w") as f:
    f.write(content)


# 2. Iterate through Blog files
author_block_html = """
    <div class="blog-author-card" style="margin-top: 60px; padding: 32px; background: var(--off-white); border-radius: 16px; display: flex; align-items: center; gap: 24px;">
      <div style="width: 80px; height: 80px; border-radius: 50%; background: #ddd; flex-shrink: 0; overflow: hidden;">
        <img src="assets/favicon.svg" alt="Freeley Medical Team" style="width: 100%; height: 100%; object-fit: cover;">
      </div>
      <div>
        <h4 style="margin: 0 0 8px; font-family: 'Cormorant Garamond', serif; font-size: 24px;">Medically Reviewed by the Freeley Clinical Team</h4>
        <p style="margin: 0; font-size: 15px; color: var(--text-muted); line-height: 1.5;">Our board-certified physicians and medical directors ensure all content is highly accurate, clinically sound, and based on the latest peer-reviewed medical research.</p>
      </div>
    </div>
"""

for file in html_files:
    # Check if it is a blog file
    with open(file, "r") as f:
        html = f.read()
        
    if 'class="blog-content' in html or '<div class="blog-content">' in html:
        changed = False
        
        # A. Inject Meta Description if missing
        if '<meta name="description"' not in html:
            # find first <p>
            p_match = re.search(r'<p>(.*?)</p>', html, flags=re.IGNORECASE | re.DOTALL)
            if p_match:
                desc_text = re.sub(r'<[^>]+>', '', p_match.group(1)).strip()
                # truncate to 160 chars
                if len(desc_text) > 155:
                    desc_text = desc_text[:155] + "..."
                
                # inject before </title> or <link rel="canonical"
                meta_tag = f'\n  <meta name="description" content="{desc_text}">'
                html = re.sub(r'(<title>.*?</title>)', r'\1' + meta_tag, html, count=1)
                changed = True
                
        # B. Inject Author Block before blog-cta
        if 'blog-author-card' not in html and 'blog-cta' in html:
            html = html.replace('<div class="blog-cta">', author_block_html + '\n    <div class="blog-cta">')
            changed = True
            
        if changed:
            with open(file, "w") as f:
                f.write(html)
            print(f"Patched {file}")

print("SEO script completed.")
