import os
import glob
import re

html_files = glob.glob('*.html')
for f in html_files:
    try:
        with open(f, 'r') as file:
            content = file.read()
        
        # Replace the favicon link tag in HTML
        content = re.sub(r'<link rel="icon".*?href="favicon\.svg">', r'<link rel="icon" type="image/png" href="favicon.png">', content)
        content = re.sub(r'<link rel="icon".*?href="favicon\.ico">', r'<link rel="icon" type="image/png" href="favicon.png">', content)

        with open(f, 'w') as file:
            file.write(content)
    except Exception as e:
        print(f"Error on {f}: {e}")

js_files = glob.glob('*.js')
for f in js_files:
    try:
        with open(f, 'r') as file:
            content = file.read()
            
        content = content.replace('"https://freeley.com/favicon.svg"', '"https://freeley.com/favicon.png"')
        
        with open(f, 'w') as file:
            file.write(content)
    except Exception as e:
        print(f"Error on {f}: {e}")

print("Favicon references updated.")
