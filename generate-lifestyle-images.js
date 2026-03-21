/**
 * Generate hyperrealistic GPT Image 1 lifestyle images for Freeley product pages.
 * Adds large lifestyle photography to weight-loss, sexual wellness, longevity, and hair pages.
 * 
 * Usage: OPENAI_API_KEY=sk-xxx node generate-lifestyle-images.js
 * 
 * Generates 6 lifestyle images:
 *   - 2x Weight Loss  (outdoor active + kitchen healthy)
 *   - 1x Sexual Wellness (couple/confidence)
 *   - 1x Hair Loss (grooming/confidence)
 *   - 2x Longevity (yoga/vitality + biohacking)
 */

const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing OPENAI_API_KEY.');
  console.error('   Run with: OPENAI_API_KEY=sk-xxx node generate-lifestyle-images.js');
  process.exit(1);
}

const IMAGES_DIR = path.join(__dirname, 'assets', 'lifestyle');
const IMAGE_QUALITY = 'high';

// ────────────────────────────────────────────────────────
// HYPERREALISTIC STYLE DIRECTIVE
// ────────────────────────────────────────────────────────

const HYPERREAL = `Shot on Canon EOS R5 with RF 85mm f/1.2L USM lens. 
Natural available light, no flash. ISO 400, f/1.4 aperture for creamy bokeh. 
True-to-life skin with visible pores, fine lines, freckles, and natural micro-imperfections. 
Zero airbrushing. Zero smoothing. Zero uncanny valley.
Color graded subtly in Capture One — warm skin tones, neutral whites, organic shadows. 
Imperceptible film grain. This must be completely indistinguishable from a real photograph 
taken by a professional photographer. No AI artifacts, no painterly effects, no HDR look.`;

const IMAGES = [
  // ── WEIGHT LOSS LIFESTYLE ──
  {
    filename: 'wl-lifestyle-active.jpg',
    size: '1536x1024',
    prompt: `Editorial lifestyle photograph of a fit, healthy man in his mid-30s jogging through a lush green urban park 
at golden hour. He wears premium dark charcoal athletic wear with subtle sage green accents. 
His stride is natural and effortless, body slightly turned toward camera. 
Warm golden sunlight creates a beautiful rim light on his frame and hair. 
Shallow depth of field — he is razor sharp, the tree-lined path behind him melts into creamy bokeh. 
Sweat glistens naturally on his skin. He looks energized, healthy, and genuinely happy. 
This is aspirational wellness brand photography for a premium telehealth company. ${HYPERREAL}`
  },
  {
    filename: 'wl-lifestyle-kitchen.jpg',
    size: '1536x1024',
    prompt: `Real lifestyle photograph of a healthy woman in her late 30s in a bright, modern kitchen, 
preparing a colorful meal with fresh vegetables. She wears a soft cream linen shirt, sleeves rolled up. 
Sunlight streams through floor-to-ceiling windows behind her. On the white marble countertop: 
a wooden cutting board with vibrant vegetables, a glass of water with cucumber slices, and a small 
white Freeley medication box in the background (subtle, not the focus). 
She's mid-action, slicing an avocado, looking down with a serene, content expression. 
This feels warm, real, aspirational — not staged or stock. ${HYPERREAL}`
  },

  // ── SEXUAL WELLNESS LIFESTYLE ──
  {
    filename: 'sw-lifestyle-confidence.jpg',
    size: '1536x1024',
    prompt: `Intimate, editorial photograph of a confident man in his early 40s on a modern apartment balcony 
at dusk. He leans casually against the railing in a perfectly fitted dark navy henley, sleeves pushed up. 
City skyline softly blurred in the background with warm amber and blue tones of twilight. 
His expression is calm, self-assured, with a hint of a knowing smile. 
Strong jawline, natural five o'clock shadow. The feeling is confidence and vitality. 
Warm color palette — golden skin tones, amber light. 
This is luxury men's wellness brand photography, not stock. ${HYPERREAL}`
  },

  // ── HAIR LOSS LIFESTYLE ──
  {
    filename: 'hl-lifestyle-grooming.jpg',
    size: '1536x1024',
    prompt: `Editorial close-up photograph of a well-groomed man in his early 30s looking into a modern bathroom mirror 
with natural confidence. He has a full, healthy head of hair styled casually with natural texture. 
He's in a clean white t-shirt, running his hand through his hair naturally. 
The bathroom is modern, minimal — white marble countertop, soft indirect lighting, a single green plant in the corner. 
The mirror reflects warm, natural daylight from a window. 
Focus is on his hands and hair with the face slightly soft. 
Aspirational grooming photography for a premium hair treatment brand. ${HYPERREAL}`
  },

  // ── LONGEVITY LIFESTYLE ──
  {
    filename: 'lg-lifestyle-vitality.jpg',
    size: '1536x1024',
    prompt: `Full editorial photograph of a vital, fit man in his late 40s doing a deep yoga stretch on a luxury 
apartment rooftop at sunrise. He's on a sage green yoga mat, in minimal black performance wear. 
Behind him: an expansive city view with golden morning light spilling across the skyline. 
His body shows lean, natural fitness — visible muscle definition but not bodybuilder. 
Expression is peaceful, focused. Every pore, every line on his face is real and visible. 
This evokes peak vitality, longevity, and premium wellness. 
Shot like a Lululemon or Equinox campaign. ${HYPERREAL}`
  },
  {
    filename: 'lg-lifestyle-science.jpg',
    size: '1024x1024',
    prompt: `Still life product photograph of longevity supplements on a clean white marble surface. 
A sleek glass NAD+ supplement vial with a minimalist white label, a modern stainless steel peptide injection pen, 
and a small amber glass dropper bottle arranged in clean diagonal composition. 
A fresh green leaf sits at the edge of frame. 
Soft, diffused natural light from the left creates subtle shadows. 
Every surface texture is hyperreal — marble veining, glass reflections, metallic sheen on the pen. 
Premium wellness product photography for a luxury longevity brand. ${HYPERREAL}`
  }
];

async function generateImage(img) {
  console.log(`\n📸 Generating: ${img.filename}`);
  console.log(`   Size: ${img.size}`);

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

  // GPT Image 1 returns b64_json by default
  const b64 = data.data[0].b64_json || data.data[0].b64;

  const imageBuffer = Buffer.from(b64, 'base64');
  const filepath = path.join(IMAGES_DIR, img.filename);
  fs.writeFileSync(filepath, imageBuffer);

  const sizeMB = (imageBuffer.length / (1024 * 1024)).toFixed(2);
  console.log(`   ✅ Saved: assets/lifestyle/${img.filename} (${sizeMB} MB)`);
}

async function run() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  console.log(`\n📸 Generating ${IMAGES.length} lifestyle images via GPT Image 1`);
  console.log(`   Model: gpt-image-1`);
  console.log(`   Estimated cost: ~$${(IMAGES.length * 0.06).toFixed(2)} (high quality)`);
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
  console.log(`\n🎉 Done! ${success}/${IMAGES.length} lifestyle images generated.`);
  console.log(`   Images saved to: assets/lifestyle/`);
  console.log(`\n   Add to product pages with:`);
  console.log(`   <img src="assets/lifestyle/wl-lifestyle-active.jpg" alt="...">`);
  console.log(`\nRun: git add -A && git commit -m "add lifestyle images" && git push`);
}

run();
