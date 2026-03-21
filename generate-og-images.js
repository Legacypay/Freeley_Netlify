/**
 * Generate premium OpenGraph share images via GPT Image 1 (gpt-image-1)
 * 
 * Creates 1200x1024 share card images for social media previews.
 * These get cropped/displayed at OG dimensions by each platform.
 * 
 * Usage: OPENAI_API_KEY=sk-xxx node generate-og-images.js
 */

const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing OPENAI_API_KEY. Run with: OPENAI_API_KEY=sk-xxx node generate-og-images.js');
  process.exit(1);
}

const IMAGES_DIR = path.join(__dirname, 'assets', 'og');
const IMAGE_QUALITY = 'high';

const BRAND_STYLE = `The overall aesthetic must feel EXTREMELY premium and polished — like a Hims.com or Ro.co social media ad. 
Clean composition, editorial-grade photography, rich color depth. 
Dark forest green (#1a2b22) as dominant background color.
The text "Freeley." should appear prominently in white elegant serif typography (like Didot or Cormorant Garamond).
No watermarks, no artifacts. Hyper-crisp and photorealistic.`;

const IMAGES = [
  {
    filename: 'freeley-og.jpg',
    size: '1536x1024',
    prompt: `Premium social media share card for a modern telehealth brand called "Freeley." 
Dark forest green (#1a2b22) background filling the entire canvas. 
Left half: Large white serif text "Freeley." as the brand name at top, below it smaller text "Medical Wellness, Delivered" in sage green italic serif font.
Below that, three small pill-shaped badges in semi-transparent white: "Board-Certified Physicians" • "Free Consultation" • "Cancel Anytime".
Right half: Beautiful lifestyle photograph section showing a confident, healthy woman in her 30s in a modern, bright kitchen, holding a glass of water, wearing a cream cashmere sweater. Warm natural window light, soft bokeh. 
The photo blends seamlessly into the dark green background via a soft gradient fade on the left edge.
${BRAND_STYLE}`
  },
  {
    filename: 'og-weight-loss.jpg',
    size: '1536x1024',
    prompt: `Premium social media share card for weight loss treatment from telehealth brand "Freeley."
Dark forest green (#1a2b22) background. 
Left side: White serif text "Medical Weight Loss" large, below it "GLP-1 Treatments from $199/mo" in sage green. 
Small "Freeley." logo text at top left corner. 
At bottom left, subtle text: "Semaglutide & Tirzepatide • Board-Certified • Free Shipping"
Right side: Editorial lifestyle photo of a fit, radiant woman in her 30s doing a morning stretch on a balcony overlooking a city, wearing minimal athletic wear, golden hour sunrise light hitting her face, shot on 85mm lens with creamy bokeh. 
Photo fades into the dark green via soft gradient on left edge.
${BRAND_STYLE}`
  },
  {
    filename: 'og-hair-loss.jpg',
    size: '1536x1024',
    prompt: `Premium social media share card for hair loss treatment from telehealth brand "Freeley."
Dark forest green (#1a2b22) background. 
Left side: White serif text "Hair Regrowth" large, below it "Clinically Proven. Physician Prescribed." in sage green.
Small "Freeley." logo text at top left.
Bottom left: "Finasteride & Minoxidil • Results in 3-6 Months"
Right side: Striking portrait photo of a confident, well-groomed man in his early 30s with thick, healthy dark hair, wearing a textured charcoal blazer, shot in soft warm studio light. He has a natural half-smile. 
Photo fades into green background via gradient.
${BRAND_STYLE}`
  },
  {
    filename: 'og-ed.jpg',
    size: '1536x1024',
    prompt: `Premium social media share card for men's sexual wellness from telehealth brand "Freeley."
Dark forest green (#1a2b22) background. 
Left side: White serif text "Sexual Wellness" large, below it "Discreet. Effective. Delivered." in sage green.
Small "Freeley." logo text at top left.
Bottom left: "Prescription Treatments • 100% Discreet • Free Consultation"
Right side: Tasteful lifestyle photo of a happy, attractive couple in their 30s laughing together in a modern sunlit apartment, wearing casual upscale clothing. Warm, intimate but completely appropriate for all audiences. Shot with natural window light, shallow depth of field.
Photo fades into green background via gradient.
${BRAND_STYLE}`
  },
  {
    filename: 'og-longevity.jpg',
    size: '1536x1024',
    prompt: `Premium social media share card for longevity and peptide therapy from telehealth brand "Freeley."
Dark forest green (#1a2b22) background.
Left side: White serif text "Longevity & Peptides" large, below it "Optimize Your Healthspan" in sage green.
Small "Freeley." logo text at top left.
Bottom left: "BPC-157 • NAD+ • Physician-Prescribed Protocols"
Right side: Dynamic lifestyle photo of a vibrant, athletic person in their 40s trail running through a Pacific Northwest forest at golden hour, wearing sleek athletic gear. Movement captured mid-stride with sun rays filtering through tall trees. Shot on telephoto with motion blur on background.
Photo fades into green background via gradient.
${BRAND_STYLE}`
  }
];

async function generateImage(img) {
  console.log(`\n🎨 Generating: ${img.filename}...`);
  
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: img.prompt,
      n: 1,
      size: img.size,
      quality: IMAGE_QUALITY
    })
  });

  const data = await response.json();

  if (!data.data || !data.data[0]) {
    throw new Error(JSON.stringify(data.error || 'Unknown error'));
  }

  const b64 = data.data[0].b64_json || data.data[0].b64;
  const imageBuffer = Buffer.from(b64, 'base64');
  const filepath = path.join(IMAGES_DIR, img.filename);
  fs.writeFileSync(filepath, imageBuffer);

  const sizeMB = (imageBuffer.length / (1024 * 1024)).toFixed(2);
  console.log(`   ✅ Saved: assets/og/${img.filename} (${sizeMB} MB)`);
}

async function run() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  console.log(`\n🖼️  Generating ${IMAGES.length} premium OG share images via GPT Image 1`);
  console.log(`   Model: gpt-image-1 (best photorealism)`);
  console.log(`   Size: 1536×1024 (landscape, OG-optimized)`);
  console.log(`   Estimated cost: ~$${(IMAGES.length * 0.08).toFixed(2)}`);
  console.log('─'.repeat(60));

  let success = 0;
  for (let i = 0; i < IMAGES.length; i++) {
    if (i > 0) {
      console.log('   ⏳ Waiting 5s...');
      await new Promise(r => setTimeout(r, 5000));
    }
    try {
      await generateImage(IMAGES[i]);
      success++;
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`\n🎉 Done! ${success}/${IMAGES.length} OG images generated.`);
  console.log(`   Images saved to: assets/og/`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Update seo.js to point to /assets/og/ images`);
  console.log(`   2. git add -A && git commit -m "add OG share images" && git push`);
}

run();
