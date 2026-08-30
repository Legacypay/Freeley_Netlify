/**
 * Generate a genuinely straight-on Cedar bottle shot. The existing
 * product2.png (Cedar's only correctly-labeled asset) turned out to already
 * be slightly tilted, not straight — using it as the gallery's first image
 * paired with a newly-generated tilted shot left Cedar with two tilted-
 * looking bottles and no straight one. This uses product1.png (Willow's
 * bottle, which IS dead straight-on) as the angle/style reference instead,
 * with Cedar's own ingredient text.
 *
 * Usage: GEMINI_API_KEY=xxx node generate-cedar-straight.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing GEMINI_API_KEY. Run with: GEMINI_API_KEY=xxx node generate-cedar-straight.js');
  process.exit(1);
}

const MODEL = 'gemini-3.1-flash-image';
const HL_DIR = path.join(__dirname, 'public', 'assets', 'hl');
const REFERENCE_IMAGE = path.join(HL_DIR, 'product1.png'); // Willow's — genuinely straight-on
const RAW_OUTPUT = path.join(HL_DIR, 'product-cedar-straight-raw.png');
const FINAL_OUTPUT = path.join(HL_DIR, 'product-cedar-straight.png');

const PROMPT = `Recreate this exact product bottle photo — same clear glass
bottle shape, same dark forest-green screw cap, same off-white paper label,
same bold serif "F" monogram centered at the top of the label, same thin
horizontal rule beneath it, same green serif ingredient text below that,
same white round pills visible through the glass, same perfectly straight-
on, dead-center studio product-photography angle (the bottle must stand
perfectly upright and symmetrical, NOT tilted or leaning in any direction),
same lighting.

The ONLY thing that changes is the ingredient text on the label, which must
read exactly:

Finasteride,
Minoxidil,
Biotin

Do not add any other text, logos, or graphics. Do not change the bottle
shape, cap color, label color, or typography.

Background: pure flat white (#FFFFFF), no shadow, no gradient, no vignette —
solid white all the way to the image edges, so it can be chroma-keyed to
transparency afterward.`;

async function run() {
  const refB64 = fs.readFileSync(REFERENCE_IMAGE).toString('base64');
  console.log('🎨 Generating Cedar straight-on bottle...');

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      input: [
        { type: 'text', text: PROMPT },
        { type: 'image', mime_type: 'image/png', data: refB64 },
      ],
    }),
  });

  const data = await response.json();

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
    console.error('❌ No image in response:', JSON.stringify(data, null, 2).slice(0, 2000));
    process.exit(1);
  }

  fs.writeFileSync(RAW_OUTPUT, Buffer.from(imageB64, 'base64'));
  await whiteToTransparent(RAW_OUTPUT, FINAL_OUTPUT);
  fs.unlinkSync(RAW_OUTPUT);

  const sizeMB = (fs.statSync(FINAL_OUTPUT).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Saved: public/assets/hl/product-cedar-straight.png (${sizeMB} MB)`);
}

async function whiteToTransparent(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const THRESHOLD = 245;
  for (let i = 0; i < data.length; i += channels) {
    if (data[i] >= THRESHOLD && data[i + 1] >= THRESHOLD && data[i + 2] >= THRESHOLD) data[i + 3] = 0;
  }
  await sharp(data, { raw: { width, height, channels } }).png().toFile(outputPath);
}

run().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
