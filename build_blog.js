const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

// Set directories
const CONTENT_DIR = path.join(__dirname, 'content', 'blog');
const OUTPUT_DIR = __dirname; 

// Ensure content directory exists
if (!fs.existsSync(CONTENT_DIR)) {
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
}

// Define HTML Templates
const PAGE_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}} — Freeley Blog</title>
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
  <div class="blog-content reveal reveal-delay-1">
    {{content}}
    <div class="blog-cta">
      <h3 style="margin-top:0">Ready to start your journey?</h3>
      <p style="margin-bottom:24px; font-size:16px;">Consult directly with a licensed physician to find the right treatment path for you.</p>
      <a href="quiz.html" class="btn btn-primary" style="display:inline-block">Complete Free Assessment →</a>
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
  <title>Health & Wellness Blog — Freeley</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="shared.css">
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <style>
    .hub-hero {
      padding: 160px 0 80px;
      text-align: center;
      background-image: url("assets/brand/freeley_pattern_light.jpg");
      background-size: cover;
      background-attachment: fixed;
      background-color: var(--cream);
    }
    .hub-hero h1 {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(48px, 6vw, 72px);
      font-weight: 300;
      color: var(--charcoal);
      margin-bottom: 24px;
    }
    .blog-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 40px;
      padding: 100px 0;
      max-width: 1200px;
      margin: 0 auto;
    }
    .article-card {
      display: block;
      text-decoration: none;
      color: var(--charcoal);
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 32px;
      transition: all 0.3s;
    }
    .article-card:hover {
      box-shadow: 0 10px 30px rgba(0,0,0,0.05);
      transform: translateY(-4px);
      border-color: rgba(61,140,94,0.3);
    }
    .ac-tag {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--green-light);
      font-weight: 600;
      margin-bottom: 16px;
      display: block;
    }
    .ac-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 32px;
      line-height: 1.2;
      margin-bottom: 16px;
      color: var(--charcoal);
    }
    .ac-excerpt {
      font-size: 15px;
      color: var(--text-muted);
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <section class="hub-hero">
    <div class="container reveal">
      <h1>Medical <em>Insights</em></h1>
      <p style="color:var(--text-muted); font-size:18px;">Expert guidance on weight management, longevity, and men's health.</p>
    </div>
  </section>
  <div class="container">
    <div class="blog-grid">
      {{BLOG_LIST_HTML}}
    </div>
  </div>
  <script src="shared.js"></script>
  <script>initPage('');</script>
</body>
</html>`;

function getWordCount(text) {
  return text.split(/\s+/).length;
}

function processBlogs() {
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  
  if (files.length === 0) {
    console.log("No markdown files found in content/blog. Skipping build.");
    return;
  }

  const blogPosts = [];
  
  files.forEach(file => {
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

    // Compile single page HTML
    let pageHTML = PAGE_TEMPLATE
      .replace(/{{title}}/g, title)
      .replace(/{{tag}}/g, tag)
      .replace(/{{read_time}}/g, readTime)
      .replace(/{{content}}/g, htmlContent);

    // Save article out to root
    fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}.html`), pageHTML);
    console.log(`✅ Built ${slug}.html`);

    // Add to collection for blog.html
    blogPosts.push({
      slug, title, tag, excerpt, date: new Date(dateStr)
    });
  });

  // Sort by date newest first
  blogPosts.sort((a, b) => b.date - a.date);

  // Generate hub index list
  let listHTML = '';
  blogPosts.forEach((post, i) => {
    // delay fade in cascade styling
    const delay = (i % 4) + 1; 
    listHTML += `
      <a href="${post.slug}.html" class="article-card reveal reveal-delay-${delay}">
        <span class="ac-tag">${post.tag}</span>
        <h2 class="ac-title">${post.title}</h2>
        <p class="ac-excerpt">${post.excerpt}</p>
      </a>`;
  });

  const finalHub = HUB_TEMPLATE.replace('{{BLOG_LIST_HTML}}', listHTML);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'blog.html'), finalHub);
  console.log(`✅ Built blog.html index with ${blogPosts.length} posts.`);
}

processBlogs();
