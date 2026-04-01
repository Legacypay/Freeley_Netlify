const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

// Set directories
const CONTENT_DIR = path.join(__dirname, 'content', 'blog');
const IMAGES_DIR = path.join(__dirname, 'assets', 'blog');
const OUTPUT_DIR = __dirname; 

// OpenAI API for GPT Image 1 generation
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const BRAND_STYLE = `Photorealistic, clean, modern healthcare aesthetic. 
Soft natural lighting, warm neutral tones (cream, sage green, soft white). 
Minimalist composition with shallow depth of field. 
Premium telehealth brand feel — NOT stock photo looking. 
No text, no logos, no watermarks, no faces showing full identity. 
Shot on Canon EOS R5 with RF 85mm f/1.2L USM lens. Natural available light.
True-to-life textures, zero airbrushing. Completely indistinguishable from a real photograph.`;

const CATEGORY_HINTS = {
  'Weight Loss': 'healthy lifestyle, measuring tape, fresh vegetables, fitness, wellness vials, glass injection pen on marble',
  'Hair Loss': 'hair care products, scalp treatment bottle, hair growth serum, grooming tools on clean surface',
  "Men's Health": 'men\'s wellness products, supplement bottles, confident male silhouette, premium health packaging',
  'ED': 'men\'s health supplement, discreet luxury packaging, pharmacy bottles, wellness',
  'Sexual Wellness': 'wellness supplements, discreet luxury packaging, health products, clean aesthetic',
  'Longevity': 'peptide vials, NAD+ supplements, biohacking devices, longevity science, anti-aging serum',
  'Peptides': 'peptide vials, scientific glassware, medical research, injection supplies on white surface',
  'Telehealth': 'doctor consultation on tablet screen, mobile health app, stethoscope, modern clinic',
  'Medical Education': 'medical reference books, healthcare education materials, clinical setting',
  'Medication Comparison': 'two medication vials side by side on white marble, comparison layout, clean medical'
};

async function generateBlogImage(title, tag, slug) {
  if (!OPENAI_API_KEY) {
    console.log(`   ⚠️  No OPENAI_API_KEY — skipping image generation for ${slug}`);
    return null;
  }

  const hints = CATEGORY_HINTS[tag] || CATEGORY_HINTS['Medical Education'];
  const imagePrompt = `A hero image for a medical health blog article titled "${title}". 
Visual elements: ${hints}. 
${BRAND_STYLE}`;

  console.log(`   📸 Generating GPT Image 1 hero for: ${slug}`);

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: imagePrompt,
        n: 1,
        size: '1536x1024',
        quality: 'high'
      })
    });

    const data = await response.json();

    if (!data.data || !data.data[0]) {
      console.error(`   ❌ GPT Image 1 error: ${JSON.stringify(data.error || 'Unknown')}`);
      return null;
    }

    const b64 = data.data[0].b64_json || data.data[0].b64;
    const imageBuffer = Buffer.from(b64, 'base64');
    
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
    
    const filename = `${slug}.jpg`;
    const filepath = path.join(IMAGES_DIR, filename);
    fs.writeFileSync(filepath, imageBuffer);
    
    const sizeMB = (imageBuffer.length / (1024 * 1024)).toFixed(2);
    console.log(`   ✅ Saved: assets/blog/${filename} (${sizeMB} MB) via GPT Image 1`);
    return `assets/blog/${filename}`;
  } catch (err) {
    console.error(`   ❌ Image generation failed: ${err.message}`);
    return null;
  }
}

// Ensure content directory exists
if (!fs.existsSync(CONTENT_DIR)) {
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
}// Define HTML Templates
const PAGE_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}} — Freeley Blog</title>
  <link rel="canonical" href="https://freeley.com/{{slug}}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="shared.css">
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <style>
    .blog-hero {
      padding: 160px 0 80px;
      text-align: center;
      background-image: url("assets/brand/freeley_pattern_light.jpg");
      background-size: cover;
      background-attachment: fixed;
      background-color: var(--cream);
      border-bottom: 1px solid var(--border);
    }
    .blog-hero h1 {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(38px, 5vw, 64px);
      font-weight: 400;
      color: var(--charcoal);
      margin-bottom: 24px;
      max-width: 800px;
      margin-inline: auto;
      line-height: 1.1;
    }
    .blog-meta {
      font-size: 14px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .blog-content {
      padding: 80px 24px;
      max-width: 760px;
      margin: 0 auto;
      color: var(--charcoal);
      font-size: 18px;
      line-height: 1.8;
      font-weight: 300;
    }
    .blog-content h2 {
      font-family: 'Cormorant Garamond', serif;
      font-size: 36px;
      margin: 48px 0 24px;
      line-height: 1.2;
    }
    .blog-content h3 {
      font-family: 'DM Sans', sans-serif;
      font-weight: 600;
      font-size: 22px;
      margin: 32px 0 16px;
    }
    .blog-content ul {
      margin-bottom: 24px;
      padding-left: 20px;
    }
    .blog-content li {
      margin-bottom: 12px;
    }
    .blog-content p {
      margin-bottom: 24px;
    }
    .blog-content strong {
      font-weight: 600;
    }
    .blog-cta {
      margin-top: 60px;
      padding: 40px;
      background: var(--off-white);
      border: 1px solid var(--border);
      border-radius: 20px;
      text-align: center;
    }
    .blog-hero-img {
      display: block;
      width: 100%;
      max-width: 760px;
      max-height: 420px;
      object-fit: cover;
      margin: -40px auto 0;
      border-radius: 20px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.08);
    }
  </style>
</head>
<body>
  <!-- NAV (Simplified placeholder, assume shared.js handles real nav injection) -->
  <section class="blog-hero">
    <div class="container reveal">
      <div class="blog-meta">{{tag}} · {{read_time}} min read</div>
      <h1>{{title}}</h1>
    </div>
  </section>
  {{hero_image}}
  <div class="blog-content reveal reveal-delay-1">
    {{content}}
    <div class="blog-cta">
      <h3 style="margin-top:0">Ready to start your journey?</h3>
      <p style="margin-bottom:24px; font-size:16px;">Consult directly with a licensed physician to find the right treatment path for you.</p>
      <a href="/quiz" class="btn btn-primary" style="display:inline-block">Complete Free Assessment →</a>
    </div>
  </div>

  <script src="shared.js"></script>
  <script>initPage('');</script>
</body>
</html>`;

const HUB_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Guide to Smarter Weight Loss — Freeley Blog</title>
  <link rel="canonical" href="https://freeley.com/blog">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/remixicon@4.2.0/fonts/remixicon.css" rel="stylesheet" />
  <link rel="stylesheet" href="shared.css">
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <style>
    body { background: var(--cream, #FDFCF7); font-family: 'DM Sans', sans-serif; color: var(--charcoal, #2B2A29); margin: 0; padding: 0; }
    .hub-hero {
      padding: 100px 24px 40px;
      max-width: 1200px;
      margin: 0 auto;
      text-align: left;
    }
    .hub-hero h1 {
      font-weight: 700;
      font-size: clamp(38px, 5vw, 48px);
      color: var(--forest, #3D8C5E);
      margin-bottom: 16px;
      margin-top: 0;
    }
    .hub-hero p {
      color: var(--text-muted, #595959);
      font-size: 18px;
      max-width: 800px;
      line-height: 1.6;
      margin: 0;
    }
    .pill-nav {
      display: flex; gap: 12px; max-width: 1200px; margin: 0 auto; padding: 0 24px 60px; flex-wrap: wrap;
    }
    .pill {
      padding: 8px 24px; border: 1px solid var(--border, #E6E4DD); border-radius: 50px; font-size: 14px; font-weight: 500; color: var(--text-muted, #595959); text-decoration: none; transition: 0.2s; background: transparent;
    }
    .pill:hover, .pill.active { border-color: var(--forest, #3D8C5E); color: var(--forest, #3D8C5E); }
    
    .blog-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 32px;
      padding: 0 24px 100px;
      max-width: 1000px;
      margin: 0 auto;
    }
    @media (max-width: 800px) {
      .blog-grid { grid-template-columns: 1fr; }
    }
    .blog-card {
      text-decoration: none; color: inherit; display: flex; flex-direction: column;
      border: 1px solid var(--border, #E6E4DD); border-radius: 16px; overflow: hidden;
      background: white; transition: all 0.3s ease; position: relative;
    }
    .blog-card:hover { 
      transform: translateY(-4px); 
      box-shadow: 0 16px 40px rgba(61,140,94,0.06);
      border-color: var(--forest, #3D8C5E);
    }
    .blog-card:hover .bc-title { color: var(--forest); }
    .blog-card:hover .bc-read-more { gap: 12px; }
    .bc-content { padding: 40px; display: flex; flex-direction: column; flex: 1; justify-content: flex-start; }
    .bc-category { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: var(--forest); margin-bottom: 20px; display: inline-block; }
    .bc-title { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 600; margin: 0 0 16px 0; line-height: 1.25; transition: 0.2s; color: var(--charcoal); }
    .bc-excerpt { font-size: 16px; color: var(--text-muted); line-height: 1.6; margin: 0 0 32px 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .bc-read-more { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--forest); display: flex; align-items: center; gap: 8px; transition: 0.3s ease; margin-top: auto; }
  </style>
</head>
<body>
  <!-- Simplified minimal nav area can go here if needed -->
  <nav style="padding: 24px; max-width: 1200px; margin: 0 auto; display: flex; align-items: center;">
     <a href="/"><img src="assets/brand/freeley_wordmark_dark.png" alt="Freeley" style="height: 28px;"></a>
  </nav>

  <section class="hub-hero">
    <h1>Your Guide to Smarter Weight Loss</h1>
    <p>Expert insights, real stories, and science-backed tips to help you feel confident, healthy, and in control—one step at a time.</p>
  </section>
  <div class="pill-nav">
    <a href="#" class="pill active">All</a>
    <a href="#" class="pill">Longevity</a>
    <a href="#" class="pill">Men's Health</a>
    <a href="#" class="pill">Weight Loss</a>
  </div>
  {{BLOG_LAYOUT_HTML}}
  <script src="shared.js"></script>
  <script>
    initPage('');
    document.addEventListener('DOMContentLoaded', () => {
      const cards = document.querySelectorAll('.blog-card');
      const pills = document.querySelectorAll('.pill-nav .pill');
      pills.forEach(pill => {
        pill.addEventListener('click', (e) => {
          e.preventDefault();
          pills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          const text = pill.innerText.trim();
          let target = 'all';
          if (text === 'Weight Loss') target = 'weight-loss';
          if (text === 'Longevity') target = 'longevity';
          if (text === "Men's Health") target = 'mens-health';
          cards.forEach(card => {
            if (target === 'all' || card.getAttribute('data-category') === target) {
              card.style.display = 'flex';
            } else {
              card.style.display = 'none';
            }
          });
        });
      });
    });
  </script>
</body>
</html>`;

function getWordCount(text) {
  return text.split(/\s+/).length;
}

async function processBlogs() {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  
  if (files.length === 0) {
    console.log("No markdown files found in content/blog. Skipping build.");
    return;
  }

  const blogPosts = [];
  
  for (const file of files) {
    const rawContent = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    const { data, content } = matter(rawContent);
    const slug = file.replace('.md', '');
    
    // Convert Markdown entirely to safe HTML
    const htmlContent = marked.parse(content);
    
    // Auto-calculate read time (assume 200 words per minute)
    const words = getWordCount(content);
    const readTime = Math.max(1, Math.ceil(words / 200));

    // Fallback data
    const title = data.title || "Freeley Medical Article";
    const tag = data.tag || "Medical Education";
    const excerpt = data.excerpt || "Learn more about the latest research and clinical protocols regarding this treatment.";
    const dateStr = data.date || new Date().toISOString();
    let image = data.image || `assets/blog/${slug}.jpg`;

    // ── IMAGE GENERATION DISABLED ──
    // The blog is now strictly typography-driven based on the new aesthetic.
    // No images will be generated or injected.
    image = '';
    const heroImageHTML = '';

    // Compile single page HTML
    let pageHTML = PAGE_TEMPLATE
      .replace(/{{title}}/g, title)
      .replace(/{{tag}}/g, tag)
      .replace(/{{slug}}/g, slug)
      .replace(/{{read_time}}/g, readTime)
      .replace(/{{hero_image}}/g, heroImageHTML)
      .replace(/{{content}}/g, htmlContent);

    // Ensure Remix Icon is loaded in individual blog pages too
    pageHTML = pageHTML.replace('<link rel="stylesheet" href="shared.css">', '<link href="https://cdn.jsdelivr.net/npm/remixicon@4.2.0/fonts/remixicon.css" rel="stylesheet">\n  <link rel="stylesheet" href="shared.css">');

    // Save article out to root
    fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}.html`), pageHTML);
    console.log(`✅ Built ${slug}.html`);

    // Add to collection for blog.html
    blogPosts.push({
      slug, title, tag, excerpt, date: new Date(dateStr), image
    });
  }

  // Sort by date newest first
  blogPosts.sort((a, b) => b.date - a.date);

  // Generate hub layout
  let layoutHTML = '<div class="blog-grid">';
  blogPosts.forEach(post => {
    let category = 'ARTICLE';
    let dataCat = 'all';
    const s = post.slug.toLowerCase();
    
    if (s.includes('semaglutide') || s.includes('tirzepatide') || s.includes('weight') || s.includes('mounjaro')) { category = 'Weight Loss'; dataCat = 'weight-loss'; }
    else if (s.includes('peptides') || s.includes('longevity') || s.includes('semantics')) { category = 'Longevity'; dataCat = 'longevity'; }
    else if (s.includes('ed-troche') || s.includes('finasteride') || s.includes('sildenafil') || s.includes('minoxidil') || s.includes('test-article')) { category = "Men's Health"; dataCat = 'mens-health'; }

    layoutHTML += `
    <a href="/${post.slug}" class="blog-card" data-category="${dataCat}">
      <div class="bc-content">
        <span class="bc-category">${category}</span>
        <h2 class="bc-title">${post.title}</h2>
        <p class="bc-excerpt">${post.excerpt}</p>
        <span class="bc-read-more">Read Article <i class="ri-arrow-right-line"></i></span>
      </div>
    </a>`;
  });
  layoutHTML += '</div>';

  const finalHub = HUB_TEMPLATE.replace('{{BLOG_LAYOUT_HTML}}', layoutHTML);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'blog.html'), finalHub);
  console.log(`✅ Built blog.html layout with ${blogPosts.length} posts.`);

  // Generate sitemap.xml
  const BASE_URL = 'https://freeley.com';
  const staticPages = [
    '',
    '/how-it-works',
    '/weight-loss',
    '/sexual-wellness',
    '/longevity',
    '/hair-loss',
    '/pricing',
    '/quiz',
    '/about',
    '/contact',
    '/physicians',
    '/faq',
    '/blog'
  ];

  let sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  
  // Add static pages
  const today = new Date().toISOString().split('T')[0];
  staticPages.forEach(page => {
    sitemapXML += `  <url>\n    <loc>${BASE_URL}${page}</loc>\n    <lastmod>${today}</lastmod>\n  </url>\n`;
  });

  // Add blog posts
  blogPosts.forEach(post => {
    const postDate = post.date.toISOString().split('T')[0];
    sitemapXML += `  <url>\n    <loc>${BASE_URL}/${post.slug}</loc>\n    <lastmod>${postDate}</lastmod>\n  </url>\n`;
  });

  sitemapXML += `</urlset>`;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap.xml'), sitemapXML);
  console.log(`✅ Built sitemap.xml`);
}

processBlogs();
