import os
import re

files = [
    "index.html",
    "quiz.html",
    "promo-weight-loss.html",
    "promo-ed.html",
    "promo-longevity.html",
    "longevity.html",
    "weight-loss.html",
    "sexual-wellness.html",
    "checkout.html",
    "pricing.html",
    "hub.html"
]

images = [
    "semag_transparent.png",
    "tirzz_transparent.png",
    "freeley_troche_transparent.png",
    "sermorelin_vial.png",
    "glutathione_vial.png",
    "nad_vial.png",
    "longevity_3vials_transparent.png",
]

def modify_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    for img in images:
        # Regex to match the img tag containing the src
        pattern = r'(<img[^>]*src=[\'"](?:[^\'"]*/)?' + re.escape(img) + r'[\'"][^>]*>)'
        
        def replacer(match):
            img_tag = match.group(1)
            # If it already has a scale transformation inserted by us, don't double dip
            if 'scale(1.25)' in img_tag or 'scale(1.3)' in img_tag or 'scale(1.35)' in img_tag:
                return img_tag
            
            # If it has a style attribute, append to it
            if 'style="' in img_tag:
                img_tag = re.sub(r'style="([^"]*)"', r'style="\1 transform: scale(1.3);"', img_tag)
            elif "style='" in img_tag:
                img_tag = re.sub(r"style='([^']*)'", r"style='\1 transform: scale(1.3);'", img_tag)
            else:
                # Add a style attribute right before closing tag
                img_tag = img_tag.replace('>', ' style="transform: scale(1.3);">')
            
            return img_tag

        content = re.sub(pattern, replacer, content)
        
    with open(filepath, 'w') as f:
        f.write(content)

for file in files:
    if os.path.exists(file):
        modify_file(file)
        print(f"Patched {file}")
