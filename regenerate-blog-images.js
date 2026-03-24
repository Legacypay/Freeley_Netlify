/**
 * One-time script to regenerate GPT Image 1 hero images for ALL existing blog posts.
 * 
 * Usage: OPENAI_API_KEY=sk-xxx node regenerate-blog-images.js
 * 
 * This will:
 * 1. Read every .md file in content/blog/
 * 2. Generate a unique GPT Image 1 image based on the title and tag
 * 3. Save images to assets/blog/
 * 4. Update the frontmatter image path in each .md file
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing OPENAI_API_KEY. Run with: OPENAI_API_KEY=sk-xxx node regenerate-blog-images.js');
  process.exit(1);
}

const BLOG_DIR = path.join(__dirname, 'content', 'blog');
const IMAGES_DIR = path.join(__dirname, 'assets', 'blog');
const IMAGE_SIZE = '1536x1024';
const IMAGE_QUALITY = 'high';

const BRAND_STYLE = `Hyperrealistic photograph, completely indistinguishable from a real photo. 
Shot on Canon EOS R5 with RF 85mm f/1.2L USM lens at f/2.0. Natural available light from a large window.
Soft natural lighting, warm neutral tones (cream, sage green, soft white). 
Shallow depth of field with creamy bokeh background. 
Premium telehealth brand feel — NOT stock photo looking, NOT AI-generated looking. 
No text, no logos, no watermarks, no faces showing full identity.
True-to-life skin textures, real fabric wrinkles, authentic surface imperfections.
Subtle lens flare, natural color grading, film grain at ISO 400.
Magazine editorial quality — Kinfolk / Cereal magazine aesthetic.`;

const CATEGORY_HINTS = {
  'Weight Loss': 'healthy lifestyle, measuring tape, fresh vegetables, fitness, wellness vials, glass injection pen on marble',
  'Hair Loss': 'hair care products, scalp treatment bottle, hair growth serum, grooming tools on clean surface',
  "Men's Health": 'men\'s wellness products, supplement bottles, confident male silhouette, premium health packaging',
  'ED': 'men\'s health supplement, discreet luxury packaging, pharmacy bottles, wellness',
  'Sexual Wellness': 'wellness supplements, discreet luxury packaging, health products, clean aesthetic',
  'Longevity': 'peptide vials, NAD+ supplements, biohacking devices, longevity science, anti-aging serum',
  'Peptides': 'peptide vials, scientific glassware, medical research, injection supplies on white surface',
  'Telehealth': 'doctor consultation on tablet screen, mobile health app, stethoscope, modern clinic',
  'Medical Education': 'medical reference books, healthcare education materials, clinical setting'
};

async function generateImage(title, tag, slug) {
  const hints = CATEGORY_HINTS[tag] || CATEGORY_HINTS['Telehealth'];

  const imagePrompt = `A hero image for a medical health blog article titled "${title}". 
Visual elements: ${hints}. 
${BRAND_STYLE}`;

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: imagePrompt,
      n: 1,
      size: IMAGE_SIZE,
      quality: IMAGE_QUALITY
    })
  });

  const data = await response.json();

  if (!data.data || !data.data[0]) {
    throw new Error(JSON.stringify(data.error || 'Unknown GPT Image error'));
  }

  const b64 = data.data[0].b64_json || data.data[0].b64;
  const imageBuffer = Buffer.from(b64, 'base64');
  const filename = `${slug}.jpg`;
  const filepath = path.join(IMAGES_DIR, filename);

  fs.writeFileSync(filepath, imageBuffer);

  const sizeMB = (imageBuffer.length / (1024 * 1024)).toFixed(2);
  return { path: `assets/blog/${filename}`, sizeMB };
}

async function run() {
  // Ensure output directory exists
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
  console.log(`\n🖼️  Regenerating GPT Image 1 images for ${files.length} blog posts\n`);
  console.log(`   Model: gpt-image-1 (best photorealism)`);
  console.log(`   Cost estimate: ~$${(files.length * 0.08).toFixed(2)} (high quality)\n`);
  console.log('─'.repeat(60));

  let success = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(BLOG_DIR, file);
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(rawContent);

    const title = data.title || file.replace('.md', '');
    const tag = data.tag || 'Medical Education';
    const slug = file.replace('.md', '');

    console.log(`\n[${i + 1}/${files.length}] "${title}"`);
    console.log(`   Tag: ${tag} | Slug: ${slug}`);

    try {
      // Add a small delay between requests to avoid rate limiting
      if (i > 0) {
        console.log('   ⏳ Waiting 3s to avoid rate limits...');
        await new Promise(r => setTimeout(r, 3000));
      }

      console.log('   🎨 Generating image via GPT Image 1...');
      const result = await generateImage(title, tag, slug);
      console.log(`   ✅ Saved: ${result.path} (${result.sizeMB} MB)`);

      // Update the frontmatter image path
      data.image = result.path;
      const updatedContent = matter.stringify(content, data);
      fs.writeFileSync(filePath, updatedContent);
      console.log(`   📝 Updated frontmatter in ${file}`);

      success++;

    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`\n🎉 Done! ${success} images generated, ${failed} failed.`);
  console.log(`\nNext steps:`);
  console.log(`  1. Run: node build_blog.js`);
  console.log(`  2. Run: git add -A && git commit -m "regen blog images" && git push`);
}

run();
