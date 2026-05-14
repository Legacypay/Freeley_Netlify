import os
import glob
import re

html_files = glob.glob('*.html')

for f in html_files:
    with open(f, 'r') as file:
        content = file.read()
    
    # Simple substitution for .png, .jpg, .jpeg to .webp for local assets
    # Only for assets directory
    content = re.sub(r'(src="assets/[^"]+)\.(png|jpg|jpeg)(")', r'\1.webp\3', content)

    # Add decoding="async" and loading="lazy" if not present
    # We shouldn't lazy load hero images. We can just add decoding="async" globally, 
    # and maybe skip lazy loading for hero or just do lazy loading manually.
    
    with open(f, 'w') as file:
        file.write(content)

print("Updated images to webp.")
