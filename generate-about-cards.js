/**
 * Generate icon-only GPT Image 1 illustrations for the About page's
 * "Built to be different" cards (src/pages/about.astro).
 *
 * These replace the old card1/2/3.png, which had the title + description
 * baked into the PNG as AI-rendered text (blurry, off-center, not
 * accessible). The new images are icon-only — title/desc now render as
 * real HTML (see .wl-mech__body in about.astro) — so no text should appear
 * in the generated image at all.
 *
 * Usage: OPENAI_API_KEY=sk-xxx node generate-about-cards.js
 */

const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing OPENAI_API_KEY.');
  console.error('   Run with: OPENAI_API_KEY=sk-xxx node generate-about-cards.js');
  process.exit(1);
}

const IMAGES_DIR = path.join(__dirname, 'public', 'assets', 'about');
const IMAGE_QUALITY = 'high';

// Rendered at .wl-mech__img (aspect-ratio 4/3, object-fit: cover, center top)
// so a 1536x1024 (3:2) landscape generation crops cleanly.
const STYLE = `Minimal flat icon illustration, centered composition with generous
padding on all sides so nothing touches the edges. Soft muted sage-green and
cream color palette, gentle drop shadow, subtle rounded shapes, premium
healthcare brand aesthetic. Clean matte background in a soft neutral tone.
Absolutely no text, no letters, no numbers, no words anywhere in the image.`;

const IMAGES = [
  {
    filename: 'pharmacy-badge.png',
    prompt: `A certificate document with a teal seal/badge featuring a white
checkmark, ribbon tails hanging below the seal, symbolizing an accredited
license or certification. ${STYLE}`,
  },
  {
    filename: 'flat-rate-dosing.png',
    prompt: `A single sleek medication vial cap or dosing cube icon, dark
teal and mint green gradient, floating above its own soft reflection,
symbolizing a fixed, unchanging dose. ${STYLE}`,
  },
  {
    filename: 'lab-monitoring.png',
    prompt: `A friendly doctor's circular profile photo above a clean lab
report card UI element with a small icon and horizontal placeholder bars,
symbolizing quarterly lab monitoring. ${STYLE}`,
  },
];

async function generateImage(img) {
  console.log(`\n📸 Generating: ${img.filename}`);

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: img.prompt,
      n: 1,
      size: '1536x1024',
      quality: IMAGE_QUALITY,
    }),
  });

  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;

  if (!b64) {
    throw new Error(JSON.stringify(data.error || data || 'No image returned'));
  }

  const imageBuffer = Buffer.from(b64, 'base64');
  fs.writeFileSync(path.join(IMAGES_DIR, img.filename), imageBuffer);
  console.log(`   ✅ Saved: public/assets/about/${img.filename} (${(imageBuffer.length / 1024).toFixed(0)} KB)`);
}

async function run() {
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

  console.log(`📸 Generating ${IMAGES.length} "Built to be different" icons via GPT Image 1`);
  for (let i = 0; i < IMAGES.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 3000));
    await generateImage(IMAGES[i]);
  }
  console.log('\n🎉 Done.');
}

run().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
