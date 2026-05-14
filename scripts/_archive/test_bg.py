import os
import glob
import re

html_files = glob.glob('*.html')
for f in html_files:
    with open(f, 'r') as file:
        content = file.read()
    
    # Let's replace the hero backgrounds
    content = re.sub(
        r'background:\s*linear-gradient\([^)]+\)\s*;',
        r'background-image: url("assets/brand/freeley_pattern_dark.jpg"); background-size: cover; background-position: center;',
        content
    )
    
    # also for charcoal backgrounds in hippa etc
    content = re.sub(
        r'background:\s*var\(--charcoal\)\s*;',
        r'background-image: url("assets/brand/freeley_pattern_dark.jpg"); background-size: cover; background-position: center; color: white;',
        content
    )
    
    with open(f, 'w') as file:
        file.write(content)

with open('shared.css', 'r') as file:
    css = file.read()

css = re.sub(
    r'background:\s*var\(--cream\)\s*;',
    r'background-image: url("assets/brand/freeley_pattern_light.jpg"); background-size: cover; background-attachment: fixed; background-color: var(--cream);',
    css
)

css = re.sub(
    r'footer \{\n\s*background:\s*var\(--black\);',
    r'footer {\n  background-image: url("assets/brand/freeley_pattern_dark.jpg"); background-size: cover; background-color: var(--black);',
    css
)

with open('shared.css', 'w') as file:
    file.write(css)

print("Updated backgrounds.")
