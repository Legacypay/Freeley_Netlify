import os
import re

icon_map = {
    'zap': 'ri-flashlight-fill',
    'pill': 'ri-capsule-fill',
    'package': 'ri-box-3-fill',
    'scale': 'ri-scales-3-fill',
    'dna': 'ri-node-tree',
    'clipboard-list': 'ri-clipboard-line',
    'stethoscope': 'ri-stethoscope-fill',
    'microscope': 'ri-microscope-fill',
    'hospital': 'ri-hospital-fill',
    'lock': 'ri-lock-fill',
    'credit-card': 'ri-bank-card-fill',
    'check': 'ri-check-line',
    'arrow-right': 'ri-arrow-right-line',
    'menu': 'ri-menu-line',
    'x': 'ri-close-line',
    
    # Quiz icons
    'target': 'ri-focus-3-line',
    'activity': 'ri-run-line',
    'brain': 'ri-brain-line',
    'moon': 'ri-moon-fill',
    'battery-charging': 'ri-battery-charge-fill',
    'flame': 'ri-fire-fill',
    'droplets': 'ri-drop-fill',
    'heart-pulse': 'ri-heart-pulse-fill',
    'smile': 'ri-emotion-happy-fill',
    'shield-alert': 'ri-shield-check-fill',
    'frown': 'ri-emotion-sad-fill',
    'bone': 'ri-bone-fill',
    'flask-conical': 'ri-flask-fill',
    'help-circle': 'ri-question-fill',
    'leaf': 'ri-leaf-fill',
    'band-aid': 'ri-medicine-bottle-fill'
}

directory = "/Users/anthonydel/.gemini/antigravity/playground/shadow-galileo/Freeley_Netlify"

for filename in os.listdir(directory):
    if filename.endswith(".html"):
        filepath = os.path.join(directory, filename)
        with open(filepath, "r") as f:
            content = f.read()

        # Replace lucide script with remix icon CSS
        content = re.sub(
            r'<script src="https://unpkg.com/lucide@latest"></script>\s*<script>lucide.createIcons\(\);</script>',
            r'<link href="https://cdn.jsdelivr.net/npm/remixicon@4.2.0/fonts/remixicon.css" rel="stylesheet" />',
            content
        )

        for lucide, remix in icon_map.items():
            content = re.sub(
                fr'<i data-lucide="{lucide}"></i>',
                f'<i class="{remix}"></i>',
                content
            )

        with open(filepath, "w") as f:
            f.write(content)

        print(f"Updated {filename}")

