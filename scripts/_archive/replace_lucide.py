import os
import re

icon_map = {
    'flower': 'ri-seedling-fill',
    'trending-up': 'ri-line-chart-fill',
    'thermometer': 'ri-temp-hot-fill',
    'heart-crack': 'ri-heart-pulse-fill',
    'thumbs-up': 'ri-thumb-up-fill',
    'ban': 'ri-forbid-2-fill',
    'sofa': 'ri-armchair-fill',
    'user': 'ri-user-fill',
    'syringe': 'ri-syringe-fill',
    'arrow-right': 'ri-arrow-right-line',
    'check': 'ri-check-line'
}

directory = "/Users/anthonydel/.gemini/antigravity/playground/shadow-galileo/Freeley_Netlify"

for filename in os.listdir(directory):
    if filename.endswith(".html"):
        filepath = os.path.join(directory, filename)
        with open(filepath, "r") as f:
            content = f.read()

        for lucide, remix in icon_map.items():
            content = re.sub(
                fr'<i data-lucide="{lucide}"></i>',
                f'<i class="{remix}"></i>',
                content
            )

        with open(filepath, "w") as f:
            f.write(content)

        print(f"Updated remaining icons in {filename}")
