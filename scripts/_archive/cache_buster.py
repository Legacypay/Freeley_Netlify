import glob
import re

files = glob.glob('*.html')
files.extend(glob.glob('*.js'))

for f in files:
    with open(f, 'r') as file:
        content = file.read()
    
    # Replace all instances of assets/sema_new.webp with assets/sema_new.webp?v=2
    # Same for all other vials we replaced
    replacements = [
        ("assets/sema_new.webp", "assets/sema_new.webp?v=2"),
        ("assets/tirz.webp", "assets/tirz.webp?v=2"),
        ("assets/peptides_new.webp", "assets/peptides_new.webp?v=2"),
        ("assets/nad_plus.webp", "assets/nad_plus.webp?v=2"),
        ("assets/sermorelin.webp", "assets/sermorelin.webp?v=2")
    ]
    
    modified = content
    for old, new in replacements:
        # First ensure we don't accidentally stack them by removing existing ?v=2 if present
        modified = modified.replace(new, old)
        modified = modified.replace(old, new)

    with open(f, 'w') as file:
        file.write(modified)

print("Cache busters injected.")
