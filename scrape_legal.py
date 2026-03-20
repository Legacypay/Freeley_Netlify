import requests
from bs4 import BeautifulSoup
import re
import html
import os

pages = {
    'terms': 'https://www.rugiet.com/terms-conditions',
    'privacy': 'https://www.rugiet.com/privacy-policy',
    'telehealth': 'https://www.rugiet.com/telehealth-consent'
}

def extract_content(url):
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    content_html: list[str] = []
    
    def clean_text(text):
        if not text: return ""
        text = text.strip()
        text = re.sub(r'Rugiet\s*Health', 'Freeley Health LLC (DBA Freeley)', text, flags=re.IGNORECASE)
        text = re.sub(r'Rugiet', 'Freeley', text, flags=re.IGNORECASE)
        text = re.sub(r'rugiet\.com', 'freeley-health.netlify.app', text, flags=re.IGNORECASE)
        text = re.sub(r'support@rugiet\.com', 'Info@Freeley.com', text, flags=re.IGNORECASE)
        text = re.sub(r'Rugiet\s*Ready', 'Freeley', text, flags=re.IGNORECASE)
        text = text.replace('Performance Medicine for Men™', '')
        return html.escape(text)

    # Let's target the main article or div with text.
    main_div = soup.find('main')
    if not main_div:
        main_div = soup.find('body')
        
    for tag in main_div.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'p', 'ul', 'ol']):
        # skip nav, footer, etc.
        parent = tag.find_parent(['nav', 'footer', 'header'])
        if parent: continue
            
        name = tag.name
        
        if name in ['ul', 'ol']:
            content_html.append(f"<{name}>")
            for li in tag.find_all('li'):
                text = clean_text(li.get_text())
                if text:
                    content_html.append(f"<li>{text}</li>")
            content_html.append(f"</{name}>")
        else:
            text = clean_text(tag.get_text())
            if not text: continue
            if len(text) < 10 and name == 'p': continue
            content_html.append(f"<{name}>{text}</{name}>")

    return "\n".join(content_html)

for page_name, url in pages.items():
    res = extract_content(url)
    with open(f"/Users/anthonydel/.gemini/antigravity/playground/shadow-galileo/Freeley_Netlify/{page_name}_scrape.html", "w") as f:
        f.write(res)
print("Done")
