const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Fatal Error: Missing OPENAI_API_KEY environment variable. Make sure it is set in GitHub Secrets.');
  process.exit(1);
}

// ── Image Generation Config ────────────────────────────────────
const BLOG_IMAGES_DIR = path.join(__dirname, 'assets', 'blog');
const IMAGE_SIZE = '1792x1024'; // Wide format, perfect for blog heroes
const IMAGE_QUALITY = 'standard'; // 'standard' or 'hd' ($0.04 vs $0.08 per image)

// Brand style guide for consistent image generation
const BRAND_STYLE = `Photorealistic, clean, modern healthcare aesthetic. 
Soft natural lighting, warm neutral tones (cream, sage green, soft white). 
Minimalist composition with shallow depth of field. 
Premium telehealth brand feel — NOT stock photo looking. 
No text, no logos, no watermarks, no faces showing full identity. 
Professional medical/wellness product photography style.`;

/**
 * Generate an image via DALL-E 3 and save it locally.
 * Returns the local file path relative to the project root.
 */
async function generateBlogImage(title, tag, slug) {
  console.log(`🎨 Generating DALL-E 3 image for: "${title}" [${tag}]`);

  // Build a category-aware prompt
  const categoryHints = {
    'Weight Loss': 'healthy lifestyle, measuring tape, fresh vegetables, fitness, wellness vials, injection pen',
    'Hair Loss': 'hair care products, scalp treatment, hair growth serum bottle, grooming',
    "Men's Health": 'men\'s wellness products, supplement bottles, confident male silhouette, health',
    'ED': 'men\'s health supplement, discreet packaging, pharmacy, wellness',
    'Sexual Wellness': 'wellness supplements, discreet luxury packaging, health products',
    'Longevity': 'peptide vials, NAD+ supplements, biohacking, longevity science, anti-aging serum',
    'Peptides': 'peptide vials, scientific laboratory, medical research, injection supplies',
    'Telehealth': 'doctor consultation screen, mobile health app, medical technology, stethoscope',
    'Medical Education': 'medical books, healthcare education, clinical setting, pharmacy'
  };

  const hints = categoryHints[tag] || categoryHints['Telehealth'];

  const imagePrompt = `A hero image for a medical health blog article titled "${title}". 
Visual elements: ${hints}. 
${BRAND_STYLE}`;

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: IMAGE_SIZE,
        quality: IMAGE_QUALITY,
        response_format: 'b64_json'
      })
    });

    const data = await response.json();

    if (!data.data || !data.data[0] || !data.data[0].b64_json) {
      console.error('❌ DALL-E API error:', JSON.stringify(data.error || data));
      return null;
    }

    // Save the image locally
    if (!fs.existsSync(BLOG_IMAGES_DIR)) {
      fs.mkdirSync(BLOG_IMAGES_DIR, { recursive: true });
    }

    const filename = `${slug}.jpg`;
    const filepath = path.join(BLOG_IMAGES_DIR, filename);

    // Convert base64 to buffer and save
    const imageBuffer = Buffer.from(data.data[0].b64_json, 'base64');
    fs.writeFileSync(filepath, imageBuffer);

    const relativePath = `assets/blog/${filename}`;
    const sizeMB = (imageBuffer.length / (1024 * 1024)).toFixed(2);
    console.log(`✅ Image saved: ${relativePath} (${sizeMB} MB)`);

    return relativePath;

  } catch (error) {
    console.error('❌ DALL-E generation failed:', error.message);
    return null;
  }
}

/**
 * Fallback: pick a local category image if DALL-E fails.
 */
function pickFallbackImage(tag) {
  const CATEGORY_FALLBACKS = {
    'Weight Loss': 'assets/blog_cost_semaglutide.png',
    'Hair Loss': 'assets/blog_hero_finasteride_hair.png',
    "Men's Health": 'assets/blog_hero_finasteride_hair.png',
    'ED': 'assets/blog_hero_finasteride_hair.png',
    'Sexual Wellness': 'assets/blog_hero_finasteride_hair.png',
    'Longevity': 'assets/blog_hero_semaglutide_delivery.png',
    'Peptides': 'assets/blog_hero_semaglutide_delivery.png',
    'Telehealth': 'assets/blog_hero_tirzepatide_cost.png',
    'Medical Education': 'assets/blog_hero_tirzepatide_cost.png'
  };

  const fallback = CATEGORY_FALLBACKS[tag] || 'assets/blog_cost_semaglutide.png';

  if (fs.existsSync(path.join(__dirname, fallback))) {
    console.log(`📂 Using fallback image: ${fallback}`);
    return fallback;
  }

  // Last resort
  return 'assets/brand/new_hero.jpeg';
}

// ── Main Pipeline ──────────────────────────────────────────────

const keywordsFile = path.join(__dirname, 'content', 'seo-keywords.txt');

// Read the keywords
let keywordsTxt = '';
try {
  keywordsTxt = fs.readFileSync(keywordsFile, 'utf8');
} catch (err) {
  console.error(`Could not find keywords file at ${keywordsFile}`);
  process.exit(1);
}

const keywords = keywordsTxt.split('\n').map(k => k.trim()).filter(k => k.length > 0);

if (keywords.length === 0) {
  console.log('No more keywords in the queue! Add more to content/seo-keywords.txt');
  process.exit(0);
}

// Take the first keyword
const targetKeyword = keywords[0];
console.log(`\n📝 Working on keyword: "${targetKeyword}"`);

// The remaining keywords
const remainingKeywords = keywords.slice(1).join('\n');

// The AI writes the article — images are generated separately
const prompt = `You are the Chief Medical Officer at Freeley Health. Write an engaging, highly-researched, SEO-optimized medical article about "${targetKeyword}".

Use bolding, H2s, H3s, and format the output STRICTLY in Markdown.

Include YAML frontmatter at the top with EXACTLY these fields:
- "title": A compelling, SEO-friendly article title
- "tag": Choose ONE category from: Weight Loss, Hair Loss, Men's Health, Longevity, Peptides, Telehealth, Medical Education
- "excerpt": A 1-2 sentence compelling summary for search results
- "date": Today's date in ISO format (e.g. "${new Date().toISOString().split('T')[0]}T10:00:00Z")
- "image": Set this to exactly "AUTO"

Conclude with a call to action leading readers to our free medical assessment at freeley.com/quiz.html.

DO NOT wrap the output in markdown block ticks (\`\`\`), output pure raw text.
DO NOT include an H1 heading that duplicates the title — start with H2s.`;

async function run() {
  try {
    // ── Step 1: Generate the article text ─────────────────────
    console.log('📡 Fetching article from OpenAI GPT-4o...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (!data.choices || !data.choices[0]) {
      console.error('Error from OpenAI API:', JSON.stringify(data));
      process.exit(1);
    }

    let markdown = data.choices[0].message.content.trim();

    // Cleanup any lazy formatting from the LLM
    if (markdown.startsWith('```markdown')) {
      markdown = markdown.substring(11).trim();
    }
    if (markdown.startsWith('```')) {
      markdown = markdown.substring(3).trim();
    }
    if (markdown.endsWith('```')) {
      markdown = markdown.slice(0, -3).trim();
    }

    // Extract metadata from the generated article
    const titleMatch = markdown.match(/^title:\s*"?([^"\n]+)"?/m);
    const tagMatch = markdown.match(/^tag:\s*"?([^"\n]+)"?/m);
    const title = titleMatch ? titleMatch[1].trim() : targetKeyword;
    const tag = tagMatch ? tagMatch[1].trim() : 'Medical Education';
    const slug = targetKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    console.log(`📖 Title: "${title}"`);
    console.log(`🏷️  Tag: "${tag}"`);
    console.log(`🔗 Slug: "${slug}"`);

    // ── Step 2: Generate the hero image via DALL-E 3 ──────────
    let imagePath = await generateBlogImage(title, tag, slug);

    // Fall back to local category image if DALL-E fails
    if (!imagePath) {
      console.log('⚠️  DALL-E failed — using local fallback image');
      imagePath = pickFallbackImage(tag);
    }

    // ── Step 3: Insert the image path into the article ────────
    markdown = markdown.replace(
      /^image:\s*"?.*"?$/m,
      `image: "${imagePath}"`
    );

    // ── Step 4: Save the article ──────────────────────────────
    const outputPath = path.join(__dirname, 'content', 'blog', `${slug}.md`);
    const blogDir = path.dirname(outputPath);
    if (!fs.existsSync(blogDir)) {
      fs.mkdirSync(blogDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, markdown);
    console.log(`\n✅ Article saved: ${outputPath}`);

    // ── Step 5: Update the keyword queue ──────────────────────
    fs.writeFileSync(keywordsFile, remainingKeywords);
    console.log(`✅ Removed "${targetKeyword}" from queue (${keywords.length - 1} remaining)`);

    console.log('\n🎉 Done! Article + image generated successfully.');

  } catch (error) {
    console.error('Failed to run SEO agent:', error);
    process.exit(1);
  }
}

run();
