const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Fatal Error: Missing OPENAI_API_KEY environment variable. Make sure it is set in GitHub Secrets.');
  process.exit(1);
}

// ── Category → Local Image Mapping ─────────────────────────────
// Each category has an array of local images. The agent picks one
// that hasn't been used recently for variety.
//
// TO ADD MORE IMAGES:
//   1. Drop your image file into assets/blog/
//   2. Add the path to the appropriate category array below
//   3. Commit and push — the next blog post will use it
//
const CATEGORY_IMAGES = {
  'Weight Loss': [
    'assets/blog/weight-loss-1.jpg',
    'assets/blog/weight-loss-2.jpg',
    'assets/blog/weight-loss-3.jpg'
  ],
  'Hair Loss': [
    'assets/blog/hair-loss-1.jpg',
    'assets/blog/hair-loss-2.jpg',
    'assets/blog/hair-loss-3.jpg'
  ],
  "Men's Health": [
    'assets/blog/mens-health-1.jpg',
    'assets/blog/mens-health-2.jpg',
    'assets/blog/mens-health-3.jpg'
  ],
  'ED': [
    'assets/blog/mens-health-1.jpg',
    'assets/blog/mens-health-2.jpg',
    'assets/blog/mens-health-3.jpg'
  ],
  'Sexual Wellness': [
    'assets/blog/mens-health-1.jpg',
    'assets/blog/mens-health-2.jpg',
    'assets/blog/mens-health-3.jpg'
  ],
  'Longevity': [
    'assets/blog/longevity-1.jpg',
    'assets/blog/longevity-2.jpg',
    'assets/blog/longevity-3.jpg'
  ],
  'Peptides': [
    'assets/blog/longevity-1.jpg',
    'assets/blog/longevity-2.jpg',
    'assets/blog/longevity-3.jpg'
  ],
  'Telehealth': [
    'assets/blog/telehealth-1.jpg',
    'assets/blog/telehealth-2.jpg',
    'assets/blog/telehealth-3.jpg'
  ],
  'Medical Education': [
    'assets/blog/telehealth-1.jpg',
    'assets/blog/telehealth-2.jpg',
    'assets/blog/telehealth-3.jpg'
  ]
};

// Fallback images if category doesn't match
const FALLBACK_IMAGES = [
  'assets/blog/telehealth-1.jpg',
  'assets/blog/telehealth-2.jpg',
  'assets/blog/telehealth-3.jpg'
];

/**
 * Pick an image for a given tag, avoiding recently used images.
 * Reads existing blog posts to see what images have been used.
 */
function pickImageForTag(tag) {
  const blogDir = path.join(__dirname, 'content', 'blog');
  const usedImages = [];

  // Scan existing blog posts to find recently used images
  if (fs.existsSync(blogDir)) {
    const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.md'));
    files.forEach(file => {
      const content = fs.readFileSync(path.join(blogDir, file), 'utf8');
      const imageMatch = content.match(/^image:\s*"?([^"\n]+)"?/m);
      if (imageMatch) usedImages.push(imageMatch[1]);
    });
  }

  // Get the image pool for this tag
  const pool = CATEGORY_IMAGES[tag] || FALLBACK_IMAGES;

  // Filter to only images that exist on disk
  const existingPool = pool.filter(img =>
    fs.existsSync(path.join(__dirname, img))
  );

  // If no images exist yet, return the first from the pool
  // (it will be created when the user adds images)
  if (existingPool.length === 0) {
    console.log(`⚠️  No images found for "${tag}". Using placeholder.`);
    console.log(`   Add images to assets/blog/ and update CATEGORY_IMAGES in seo-agent.js`);
    return pool[0] || FALLBACK_IMAGES[0];
  }

  // Prefer images not recently used
  const unused = existingPool.filter(img => !usedImages.includes(img));
  if (unused.length > 0) {
    return unused[Math.floor(Math.random() * unused.length)];
  }

  // All images used — just pick randomly from the pool
  return existingPool[Math.floor(Math.random() * existingPool.length)];
}

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
console.log(`Working on keyword: ${targetKeyword}`);

// The remaining keywords
const remainingKeywords = keywords.slice(1).join('\n');

// ── Updated Prompt (NO Pollinations) ──────────────────────────
// The AI only generates text content. Images are handled locally.
const prompt = `You are the Chief Medical Officer at Freeley Health. Write an engaging, highly-researched, SEO-optimized medical article about "${targetKeyword}".

Use bolding, H2s, H3s, and format the output STRICTLY in Markdown.

Include YAML frontmatter at the top with EXACTLY these fields:
- "title": A compelling, SEO-friendly article title
- "tag": Choose ONE category from: Weight Loss, Hair Loss, Men's Health, Longevity, Peptides, Telehealth, Medical Education
- "excerpt": A 1-2 sentence compelling summary for search results
- "date": Today's date in ISO format (e.g. "2026-03-20T10:00:00Z")
- "image": Leave this as "AUTO" — it will be replaced automatically

Conclude with a call to action leading readers to our free medical assessment at freeley.com/quiz.html.

DO NOT wrap the output in markdown block ticks (\`\`\`), output pure raw text.
DO NOT include an H1 heading that duplicates the title — start with H2s.`;

async function run() {
  try {
    console.log('Fetching from OpenAI...');

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
      if (markdown.endsWith('```')) {
        markdown = markdown.slice(0, -3).trim();
      }
    }
    if (markdown.startsWith('```')) {
      markdown = markdown.substring(3).trim();
      if (markdown.endsWith('```')) {
        markdown = markdown.slice(0, -3).trim();
      }
    }

    // ── Extract the tag and assign a local image ────────────────
    const tagMatch = markdown.match(/^tag:\s*"?([^"\n]+)"?/m);
    const tag = tagMatch ? tagMatch[1].trim() : 'Medical Education';
    const localImage = pickImageForTag(tag);

    console.log(`📂 Tag: "${tag}" → Image: "${localImage}"`);

    // Replace the AUTO placeholder (or any Pollinations URL) with local image
    markdown = markdown.replace(
      /^image:\s*"?.*"?$/m,
      `image: "${localImage}"`
    );

    // Create the clean filename slug
    const slug = targetKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const outputPath = path.join(__dirname, 'content', 'blog', `${slug}.md`);

    // Ensure directory exists
    const blogDir = path.dirname(outputPath);
    if (!fs.existsSync(blogDir)) {
      fs.mkdirSync(blogDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, markdown);
    console.log(`✅ SEO Article written to ${outputPath}`);

    // Update the keywords list queue
    fs.writeFileSync(keywordsFile, remainingKeywords);
    console.log(`✅ Removed "${targetKeyword}" from the queue. File updated successfully.`);

  } catch (error) {
    console.error('Failed to run SEO agent Engine:', error);
    process.exit(1);
  }
}

run();
