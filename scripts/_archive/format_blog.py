import re
from bs4 import BeautifulSoup

with open('blog.html', 'r', encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

# Find all cards
articles = []

featured = soup.select('.featured-card')
for a in featured:
    href = a['href']
    img = a.find('img')
    img_src = img['src'] if img else ''
    img_alt = img.get('alt', '')
    title = a.find(class_='fc-title').get_text(separator=' ', strip=True) if a.find(class_='fc-title') else ''
    # clean out the arrow
    title = title.replace('', '').replace('', '').strip() # removing any stray icon text
    excerpt = a.find(class_='fc-excerpt').get_text(strip=True) if a.find(class_='fc-excerpt') else ''
    articles.append((href, img_src, img_alt, title, excerpt))

sides = soup.select('.side-card')
for a in sides:
    href = a['href']
    img = a.find('img')
    img_src = img['src'] if img else ''
    img_alt = img.get('alt', '')
    title = a.find(class_='sc-title').get_text(separator=' ', strip=True) if a.find(class_='sc-title') else ''
    excerpt = a.find(class_='sc-excerpt').get_text(strip=True) if a.find(class_='sc-excerpt') else ''
    articles.append((href, img_src, img_alt, title, excerpt))

# Generate new HTML for grid
grid_html = '<div class="blog-grid">\n'
for href, img_src, img_alt, title, excerpt in articles:
    grid_html += f"""    <a href="{href}" class="blog-card">
      <img src="{img_src}" alt="{img_alt}">
      <div class="bc-content">
        <h2 class="bc-title">{title}</h2>
        <p class="bc-excerpt">{excerpt}</p>
        <span class="bc-read-more">Read Article <i class="ri-arrow-right-line"></i></span>
      </div>
    </a>\n"""
grid_html += '  </div>'

# New CSS
new_css = """    .blog-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 40px;
      padding: 0 24px 100px;
      max-width: 1200px;
      margin: 0 auto;
    }
    @media (max-width: 900px) {
      .blog-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 600px) {
      .blog-grid { grid-template-columns: 1fr; }
    }
    
    .blog-card {
      text-decoration: none; color: inherit; display: flex; flex-direction: column;
      border: 1px solid var(--border, #E6E4DD); border-radius: 20px; overflow: hidden;
      background: white; transition: 0.2s transform, 0.2s box-shadow;
    }
    .blog-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.06); }
    .blog-card:hover .bc-title { color: var(--forest); }
    
    .blog-card img { width: 100%; height: 220px; object-fit: cover; border-bottom: 1px solid var(--border, #E6E4DD); }
    .bc-content { padding: 24px; display: flex; flex-direction: column; flex: 1; }
    .bc-title { font-size: 20px; font-weight: 700; margin: 0 0 12px 0; line-height: 1.3; transition: 0.2s; }
    .bc-excerpt { font-size: 15px; color: var(--text-muted); line-height: 1.6; margin: 0 0 24px 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .bc-read-more { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--forest); margin-top: auto; display: flex; align-items: center; gap: 8px; }"""

# Replace CSS
css_start = html.find('.blog-layout {')
css_end = html.find('</style>')
if css_start != -1 and css_end != -1:
    html = html[:css_start] + new_css + '\n  ' + html[css_end:]

# Replace HTML body
layout_start = html.find('<div class="blog-layout">')
layout_end = html.find('</div>\n  <script src="shared.js">')
# the </div> is at the end of blog-layout
# better, use bs4 to find and replace the element, or regex
html_part1 = html[:layout_start]
html_part2 = html[html.find('<script src="shared.js">'):]

final_html = html_part1 + grid_html + '\n  ' + html_part2

with open('blog.html', 'w', encoding='utf-8') as f:
    f.write(final_html)
print("Finished formatting blog.html")
