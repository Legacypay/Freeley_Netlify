import os, re

emoji_map = {
    '⚖️': 'scale', '⚡': 'zap', '🧬': 'dna', '📋': 'clipboard-list', '👨‍⚕️': 'stethoscope', '🔬': 'microscope', 
    '📦': 'package', '🔄': 'refresh-cw', '💬': 'message-circle', '📊': 'bar-chart-2', '🔔': 'bell', '💳': 'credit-card', 
    '🚚': 'truck', '✅': 'check-circle', '🏥': 'hospital', '🧪': 'test-tube', '🌡️': 'thermometer', '🩺': 'stethoscope', 
    '🔒': 'lock', '⚠️': 'alert-triangle', '📞': 'phone', '😴': 'moon', '📉': 'trending-down', '💔': 'heart-crack', 
    '🧠': 'brain', '😔': 'frown', '📈': 'trending-up', '😰': 'frown', '💤': 'moon', '🦴': 'bone', '🌫️': 'cloud-fog', 
    '💉': 'syringe', '🧴': 'flask-conical', '💨': 'wind', '💊': 'pill', '🩸': 'droplet', '🌸': 'flower', '💪': 'activity', 
    '👍': 'thumbs-up', '🚫': 'ban', '🛋️': 'sofa', '🚶': 'user', '🏋️': 'activity', '👨': 'user', '💡': 'lightbulb', 
    '📬': 'mail', '📲': 'smartphone', '⚗️': 'flask-conical', '❓': 'help-circle', '🤍': 'heart', '⚖': 'scale', '⚕️': 'activity',
    '⚕': 'activity', '✔': 'check', '✖': 'x'
}

# Add variations without variation selector-16
emoji_map.update({k.replace('\ufe0f', ''): v for k, v in emoji_map.items() if '\ufe0f' in k})

def replace_emojis(match):
    e = match.group(0)
    for k, v in emoji_map.items():
        if k in e:
            return f'<i data-lucide="{v}"></i>'
    # Fallback to a checkmark if not found in map, or just empty if we can't map it
    return f'<i data-lucide="check-circle"></i>'

d = "/Users/anthonydel/.gemini/antigravity/playground/shadow-galileo/Freeley_Netlify"
for f in os.listdir(d):
    if f.endswith(".html"):
        path = os.path.join(d, f)
        text = open(path).read()
        
        # Replace emojis
        pattern = re.compile(r"[\U00010000-\U0010ffff]|\u2696\ufe0f|\u2696|\u2600-\u27BF")
        
        # We also need to add Lucide script at the bottom of the body
        if "lucide@latest" not in text:
            # Replace emojis in text using mapping
            def replacer(m):
                char = m.group(0)
                if char in emoji_map:
                    return f'<i data-lucide="{emoji_map[char]}"></i>'
                return char # If not mapped, just return it (or use a fallback)
            
            # Use regex to find all emojis and replace them
            for k, v in emoji_map.items():
                text = text.replace(k, f'<i data-lucide="{v}"></i>')
                
            # Add scripts
            lucide_script = '<script src="https://unpkg.com/lucide@latest"></script>\n<script>lucide.createIcons();</script>\n</body>'
            text = text.replace("</body>", lucide_script)
            
            open(path, "w").write(text)
            print(f"Updated {f}")

