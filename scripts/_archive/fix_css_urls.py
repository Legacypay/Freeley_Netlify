import os
import glob
import re

html_files = glob.glob('*.html')

for f in html_files:
    with open(f, 'r') as file:
        content = file.read()
    
    # Simple substitution for .png, .jpg, .jpeg to .webp for local assets
    # Only for assets directory
    content = re.sub(r'(\url\([\'"]?assets/[^\'")]+)\.(png|jpg|jpeg)([\'"]?\))', r'\1.webp\3', content)

    with open(f, 'w') as file:
        file.write(content)

print("Updated background url images to webp.")
