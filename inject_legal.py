import re

replacements = [
    (r'MSB Holdings, Inc\.', 'Freeley Health LLC (DBA Freeley)'),
    (r'MSB Holdings and Affiliates', 'Freeley Health LLC (DBA Freeley)'),
    (r'MSB Holdings', 'Freeley Health LLC (DBA Freeley)'),
    (r'Medco23 LLC and Affiliates', 'Freeley Health LLC (DBA Freeley)'),
    (r'Medco23', 'Freeley Health LLC (DBA Freeley)'),
    (r'RX23, LLC', 'Freeley Health LLC (DBA Freeley)'),
    (r'RX23', 'Freeley Health LLC (DBA Freeley)'),
    (r'310 Comal Street BLDG A, Ste 272Austin, TX 78702', ''),
    (r'310 Comal Street BLDG A Ste 272 Austin, TX 78702', ''),
    (r'310 Comal Street Ste 272 Austin, TX 78702', ''),
    (r'855-581-9620', ''),
    (r'www\.Freeleymen\.com\s*and\s*', ''),
    (r'www\.Freeleymen\.com', 'www.Freeley.com'),
    (r'Freeleymen\s*', 'Freeley '),
    (r'support@Freeley\.com', 'Info@Freeley.com'),
    (r'legal@Freeley\.com', 'Info@Freeley.com'),
    (r'customercare@Freeley\.com', 'Info@Freeley.com'),
]

pages = ['terms', 'privacy', 'telehealth']

for page in pages:
    # Read scraped HTML
    with open(f"{page}_scrape.html", "r") as f:
        content = f.read()

    # Apply all replacements
    for old, new in replacements:
        content = re.sub(old, new, content, flags=re.IGNORECASE)

    # Read the actual website file
    filepath = f"{page}.html"
    with open(filepath, "r") as f:
        html_file = f.read()

    # Extract EVERYTHING between <div class="legal-content"> and </div>
    # Using a regex that handles newlines
    pattern = r'(<section class="legal-content">\s*<div class="container reveal">)(.*?)(</div>\s*</section>)'
    
    # We want to keep the outer div and section, but replace the inner text
    def replacer(match):
        return match.group(1) + "\n" + content + "\n" + match.group(3)

    new_html_file = re.sub(pattern, replacer, html_file, flags=re.DOTALL)
    
    # Write back to actual website file
    with open(filepath, "w") as f:
        f.write(new_html_file)

print("Replacement complete.")
