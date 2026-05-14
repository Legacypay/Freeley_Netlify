import os
import glob
import re

html_files = glob.glob('*.html')

for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    if file == 'checkout.html':
        content = content.replace('194.97', '194.29')
        content = content.replace('149.97', '149.29')
        content = content.replace('124.97', '124.29')
        content = content.replace('99.97', '99.29')

    # Now replace 134 -> 194.29 across the site
    # But ONLY for Semaglutide / generally, we grep_search found 134 in specific places.
    # Let's replace "134" with "194.29" and "114" (quarterly in pricing.html) with "149.29"
    content = content.replace('$134', '$194.29')
    content = content.replace('data-monthly="134"', 'data-monthly="194.29"')
    content = content.replace('data-quarterly="114"', 'data-quarterly="149.29"')
    content = content.replace('price-val" data-monthly="194.29" data-quarterly="149.29">134</span>', 'price-val" data-monthly="194.29" data-quarterly="149.29">194.29</span>')
    content = content.replace('freeley: { sema: 134, tirz: 134', 'freeley: { sema: 194.29, tirz: 194.29')
    
    # In promo-weight-loss.html, the starting at text.
    content = content.replace('starting at just $194.29/month', 'starting at just $99.29/month')
    
    # In weight-loss.html hero string: "<sup>$</sup>134"
    content = content.replace('<sup>$</sup>134', '<sup>$</sup>194.29')
    content = content.replace('hero-proof-val">$134</div>', 'hero-proof-val">$194.29</div>')

    if content != original_content:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file}")

print("Done")
