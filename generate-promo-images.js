/**
 * Generate hyperrealistic DALL-E 3 images for promo landing pages.
 * 
 * Usage: OPENAI_API_KEY=sk-xxx node generate-promo-images.js
 * 
 * Generates hero + lifestyle images for:
 *   - Weight Loss promo
 *   - ED/Sexual Wellness promo
 *   - Hair Loss promo
 *   - Longevity promo
 */

const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing OPENAI_API_KEY.');
  process.exit(1);
}

const IMAGES_DIR = path.join(__dirname, 'assets', 'promo');
const IMAGE_QUALITY = 'hd';

// ────────────────────────────────────────────────────────
// HYPERREALISTIC STYLE DIRECTIVE
// All prompts must produce images that are completely 
// indistinguishable from real photographs.
// ────────────────────────────────────────────────────────

const HYPERREAL = `Shot on Canon EOS R5 with RF 85mm f/1.2L USM lens. 
Natural available light, no flash. ISO 400, f/1.4 aperture for creamy bokeh. 
True-to-life skin with visible pores, fine lines, freckles, and natural micro-imperfections. 
Zero airbrushing. Zero smoothing. Zero uncanny valley.
Color graded subtly in Capture One — warm skin tones, neutral whites, organic shadows. 
Imperceptible film grain. This must be completely indistinguishable from a real photograph 
taken by a professional photographer. No AI artifacts, no painterly effects, no HDR look.`;

const IMAGES = [
  // ── WEIGHT LOSS PROMO ──
  {
    filename: 'weight-loss-hero.jpg',
    size: '1792x1024',
    prompt: `Full-body editorial photograph of a real woman in her mid-30s with a healthy, fit physique, 
standing in a bright modern kitchen. She wears a fitted sage green ribbed tank top and high-waisted black leggings. 
She holds a glass of water and looks directly at camera with a calm, confident half-smile. 
Morning sunlight streams through large windows behind her, creating a warm rim light on her hair. 
Clean countertops with a single green apple and a white ceramic bowl visible. 
Shallow depth of field — she is tack sharp, background softly blurred. ${HYPERREAL}`
  },
  {
    filename: 'weight-loss-lifestyle.jpg',
    size: '1024x1024',
    prompt: `Close-up still life photograph of a medical-grade glass injection pen laying on a white marble countertop 
next to a glass of water with lemon slices and a fresh sprig of mint. 
Soft natural daylight from a window to the left. Clean, minimal composition. 
The injection pen is sleek, modern, with a clear barrel showing medication inside. 
Every surface texture is hyperreal — marble veining, water condensation droplets on the glass, 
light refracting through the liquid. Product photography quality for a luxury wellness brand. ${HYPERREAL}`
  },

  // ── ED PROMO ──
  {
    filename: 'ed-hero.jpg',
    size: '1792x1024',
    prompt: `Lifestyle photograph of a real couple in their late 30s, shot from the waist up. 
They stand close together on a rooftop terrace at golden hour. The man has his arm around her waist, 
and she leans into him with her hand on his chest. Both are laughing naturally — a genuine candid moment. 
He wears a fitted navy henley, she wears a white linen blouse. City skyline softly blurred behind them. 
Warm golden hour light with lens flare. His skin shows natural stubble and crow's feet. 
Her hair catches the wind slightly. Intimate, authentic, editorial quality. ${HYPERREAL}`
  },
  {
    filename: 'ed-product.jpg',
    size: '1024x1024',
    prompt: `Minimalist product photograph of a small amber pharmacy bottle with a white cap, 
sitting on a matte charcoal surface. A single white troche tablet sits beside it. 
Soft studio lighting from the right creates a subtle gradient on the background. 
Everything is tack sharp — you can see the texture of the tablet surface, 
the tiny bubbles in the amber glass, the subtle matte finish on the cap. 
Premium pharmaceutical product photography. No labels, no branding visible. ${HYPERREAL}`
  },

  // ── HAIR LOSS PROMO ──
  {
    filename: 'hair-loss-hero.jpg',
    size: '1792x1024',
    prompt: `Upper body portrait of a real man in his late 20s with a full head of thick, dark hair. 
He runs his fingers through his hair while looking confidently into the camera. 
Modern bathroom setting — clean white subway tile, warm brass fixtures, natural window light. 
He wears a crisp white t-shirt. Individual hair strands are visible and catch the light. 
Natural skin texture with slight five o'clock shadow. His expression is relaxed and self-assured. 
The composition is slightly off-center, editorial style. ${HYPERREAL}`
  },
  {
    filename: 'hair-loss-product.jpg',
    size: '1024x1024',
    prompt: `Overhead flat-lay product photograph of hair treatment essentials on a clean white marble surface. 
A frosted glass dropper bottle with golden serum, a wooden wide-tooth comb, 
a small ceramic dish with two white tablets, and a sprig of fresh rosemary. 
Arranged with intentional negative space. Soft shadow from a single directional light source. 
Every texture hyperreal — wood grain on the comb, liquid meniscus in the dropper, 
marble veining, rosemary needle detail. Premium men's grooming editorial. ${HYPERREAL}`
  },

  // ── LONGEVITY PROMO ──
  {
    filename: 'longevity-hero.jpg',
    size: '1792x1024',
    prompt: `Environmental portrait of a fit, athletic man in his early 50s doing yoga on a wooden deck 
overlooking a misty mountain landscape at sunrise. He is in a warrior pose, wearing a fitted dark grey 
performance top and black joggers. Morning fog drifts through the pine trees behind him. 
Warm golden sunrise light illuminates his face in profile. Visible muscle definition in his forearms. 
Slight sweat on his brow. A glass water bottle sits on the deck beside him. 
The mountains are soft and atmospheric in the background. ${HYPERREAL}`
  },
  {
    filename: 'longevity-product.jpg',
    size: '1024x1024',
    prompt: `Clinical product photograph of three medical-grade glass vials with different colored liquid 
(clear, pale gold, and light pink) arranged in a triangular composition on a white lab surface. 
A stainless steel syringe with a fine needle rests beside them. 
Soft, clean laboratory lighting — bright but not harsh. 
Each vial has a crimp-sealed aluminum cap. Every detail hyperreal — 
the liquid level lines, air bubbles, aluminum crimping patterns, needle bevel reflection.
Scientific, premium, trustworthy pharmaceutical aesthetic. ${HYPERREAL}`
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
      model: 'dall-e-3',
      prompt: img.prompt,
      n: 1,
      size: img.size,
      quality: IMAGE_QUALITY,
      response_format: 'b64_json'
    })
  });

  const data = await response.json();

  if (!data.data || !data.data[0] || !data.data[0].b64_json) {
    throw new Error(JSON.stringify(data.error || 'Unknown error'));
  }

  const imageBuffer = Buffer.from(data.data[0].b64_json, 'base64');
  const filepath = path.join(IMAGES_DIR, img.filename);
  fs.writeFileSync(filepath, imageBuffer);

  const sizeMB = (imageBuffer.length / (1024 * 1024)).toFixed(2);
  console.log(`   ✅ Saved: assets/promo/${img.filename} (${sizeMB} MB)`);
}

async function run() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  console.log(`\n📸 Generating ${IMAGES.length} hyperrealistic promo images via DALL-E 3`);
  console.log(`   Estimated cost: ~$${(IMAGES.length * 0.08).toFixed(2)} (HD quality)`);
  console.log('─'.repeat(60));

  let success = 0;
  for (let i = 0; i < IMAGES.length; i++) {
    if (i > 0) {
      console.log('   ⏳ Waiting 3s...');
      await new Promise(r => setTimeout(r, 3000));
    }
    try {
      await generateImage(IMAGES[i]);
      success++;
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`\n🎉 Done! ${success}/${IMAGES.length} images generated.`);
  console.log(`   Images saved to: assets/promo/`);
  console.log(`\nRun: git add -A && git commit -m "add promo images" && git push`);
}

run();
