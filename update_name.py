import os

files = [
    'terms.html',
    'privacy.html',
    'telehealth.html',
    'shared.js',
    'scrape_legal.py',
    'inject_legal.py'
]

for file in files:
    if os.path.exists(file):
        with open(file, 'r') as f:
            content = f.read()
            
        new_content = content.replace('Freeley Health Technologies, LLC', 'Freeley Health LLC (DBA Freeley)')
        
        with open(file, 'w') as f:
            f.write(new_content)

print("Replacement complete.")
