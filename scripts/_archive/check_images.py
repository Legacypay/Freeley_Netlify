import os
import re
import urllib.request

html_files = [f for f in os.listdir('.') if f.endswith('.html')]

broken_images = []

for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # find all img tags
    img_tags = re.findall(r'<img[^>]+src="([^">]+)"', content)
    for src in img_tags:
        if src.startswith('http://') or src.startswith('https://'):
            pass # We could check URLs, but let's assume they might be okay unless they are pollinations. Let's at least check them quickly?
            try:
                req = urllib.request.Request(src, headers={'User-Agent': 'Mozilla/5.0'})
                # We'll skip deep HTTP checks for now due to timeouts, just check if pollinations
                if 'pollinations.ai' in src:
                    broken_images.append((file, src, 'pollinations URL'))
            except Exception as e:
                pass
        else:
            # local file
            # strip query params if any e.g., image.png?v=2
            file_path = src.split('?')[0]
            if not os.path.exists(file_path):
                broken_images.append((file, src, 'local file missing'))

if not broken_images:
    print("All image sources are valid locally!")
else:
    for item in broken_images:
        print(f"Broken: {item[0]} -> {item[1]} ({item[2]})")

