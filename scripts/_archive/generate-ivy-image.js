/**
 * Generate the missing Ivy product bottle image via Gemini 3.1 Flash Image
 * ("Nano Banana 2"), matching the existing Cedar/Willow bottle style exactly.
 * Reads public/assets/hl/product1.png (Willow's bottle) as a style reference
 * so the result shares the same glass bottle, green cap, "F" monogram, and
 * label typography — only the ingredient line changes.
 *
 * Uses the Interactions API (Google's current recommended endpoint for
 * gemini-3.1-flash-image — the older :generateContent REST shape is legacy
 * and doesn't support this model).
 *
 * Usage: GEMINI_API_KEY=xxx node generate-ivy-image.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing GEMINI_API_KEY. Run with: GEMINI_API_KEY=xxx node generate-ivy-image.js');
  process.exit(1);
}

const REFERENCE_IMAGE = path.join(__dirname, 'public', 'assets', 'hl', 'product1.png');
const RAW_OUTPUT = path.join(__dirname, 'public', 'assets', 'hl', 'product-ivy-raw.png');
const FINAL_OUTPUT = path.join(__dirname, 'public', 'assets', 'hl', 'product-ivy.png');
const MODEL = 'gemini-3.1-flash-image';

const PROMPT = `Recreate this exact product bottle photo — same clear glass
bottle shape, same dark forest-green screw cap, same off-white paper label,
same bold serif "F" monogram centered at the top of the label, same thin
horizontal rule beneath it, same green serif ingredient text below that, same
white round pills visible through the glass, same straight-on studio
product-photography angle and lighting.

The ONLY thing that changes is the ingredient text on the label, which must
read exactly:

Dutasteride,
Minoxidil,
Biotin

Do not add any other text, logos, or graphics. Do not change the bottle
shape, cap color, label color, or typography. This must look like it belongs
in the same product line as the reference image, not a redesign.

Background: pure flat white (#FFFFFF), no shadow, no gradient, no vignette —
solid white all the way to the image edges, so it can be chroma-keyed to
transparency afterward.`;

async function generate() {
  const refB64 = fs.readFileSync(REFERENCE_IMAGE).toString('base64');

  console.log(`🎨 Generating Ivy bottle image via ${MODEL} (Interactions API)...`);

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        { type: 'text', text: PROMPT },
        { type: 'image', mime_type: 'image/png', data: refB64 },
      ],
    }),
  });

  const data = await response.json();

  // Response shape isn't fully documented publicly yet — try the documented
  // paths, fall back to a raw dump so a shape mismatch is debuggable instead
  // of a silent crash.
  let imageB64 = null;
  if (data.output_image?.data) {
    imageB64 = data.output_image.data;
  } else if (Array.isArray(data.steps)) {
    for (const step of data.steps) {
      const block = (step.content || []).find((c) => c.type === 'image');
      if (block) { imageB64 = block.data; break; }
    }
  }

  if (!imageB64) {
    console.error('❌ Could not find image data in response:', JSON.stringify(data, null, 2).slice(0, 4000));
    process.exit(1);
  }

  fs.writeFileSync(RAW_OUTPUT, Buffer.from(imageB64, 'base64'));
  console.log('✅ Raw image saved, removing white background...');

  // Chroma-key pure white -> transparent, matching the site's convention
  // (every other product asset ships as a real RGBA transparent PNG).
  await whiteToTransparent(RAW_OUTPUT, FINAL_OUTPUT);
  fs.unlinkSync(RAW_OUTPUT);

  const sizeMB = (fs.statSync(FINAL_OUTPUT).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Saved: public/assets/hl/product-ivy.png (${sizeMB} MB)`);
}

async function whiteToTransparent(inputPath, outputPath) {
  const img = sharp(inputPath).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const THRESHOLD = 245; // near-white pixels become transparent

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r >= THRESHOLD && g >= THRESHOLD && b >= THRESHOLD) {
      data[i + 3] = 0;
    }
  }

  await sharp(data, { raw: { width, height, channels } }).png().toFile(outputPath);
}

generate().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
