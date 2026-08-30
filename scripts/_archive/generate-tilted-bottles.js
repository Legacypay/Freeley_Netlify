/**
 * Generate the missing "tilted bottle" shot for each hair-loss product
 * (Gemini 3.1 Flash Image / "Nano Banana 2", Interactions API), matching
 * each product's own straight-on bottle exactly — same label, same
 * ingredient text — just photographed at a 3/4 tilted angle instead of
 * straight-on, completing the intended gallery sequence: straight bottle ->
 * pills -> tilted bottle.
 *
 * Usage: GEMINI_API_KEY=xxx node generate-tilted-bottles.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing GEMINI_API_KEY. Run with: GEMINI_API_KEY=xxx node generate-tilted-bottles.js');
  process.exit(1);
}

const MODEL = 'gemini-3.1-flash-image';
const HL_DIR = path.join(__dirname, 'public', 'assets', 'hl');

const PRODUCTS = [
  {
    name: 'Cedar',
    reference: path.join(HL_DIR, 'product2.png'),
    output: path.join(HL_DIR, 'product-cedar-tilted.png'),
    ingredients: 'Finasteride,\nMinoxidil,\nBiotin',
  },
  {
    name: 'Willow',
    reference: path.join(HL_DIR, 'product1.png'),
    output: path.join(HL_DIR, 'product-willow-tilted.png'),
    ingredients: 'Spironolactone,\nMinoxidil,\nBiotin',
  },
  {
    name: 'Ivy',
    reference: path.join(HL_DIR, 'product-ivy.png'),
    output: path.join(HL_DIR, 'product-ivy-tilted.png'),
    ingredients: 'Dutasteride,\nMinoxidil,\nBiotin',
  },
];

function buildPrompt(ingredients) {
  return `Recreate this exact product bottle — same clear glass bottle
shape, same dark forest-green screw cap, same off-white paper label, same
bold serif "F" monogram, same thin horizontal rule, same green serif
ingredient text, same white round pills visible through the glass — but
photographed from a 3/4 tilted angle instead of straight-on: rotate the
bottle about 25-30 degrees so the side of the bottle and part of the cap
top are visible, tilted slightly back, same studio lighting.

The ingredient text on the label must read exactly:

${ingredients}

Do not add any other text, logos, or graphics. Do not change the bottle
shape, cap color, label color, or typography — only the camera angle
changes. Background: pure flat white (#FFFFFF), no shadow, no gradient, no
vignette — solid white all the way to the image edges, so it can be
chroma-keyed to transparency afterward.`;
}

async function generateOne(product) {
  console.log(`\n🎨 Generating ${product.name}'s tilted bottle...`);
  const refB64 = fs.readFileSync(product.reference).toString('base64');

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      input: [
        { type: 'text', text: buildPrompt(product.ingredients) },
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
    console.error(`❌ ${product.name}: no image in response:`, JSON.stringify(data, null, 2).slice(0, 2000));
    return false;
  }

  const rawPath = product.output.replace('.png', '-raw.png');
  fs.writeFileSync(rawPath, Buffer.from(imageB64, 'base64'));
  await whiteToTransparent(rawPath, product.output);
  fs.unlinkSync(rawPath);

  const sizeMB = (fs.statSync(product.output).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Saved: ${path.relative(__dirname, product.output)} (${sizeMB} MB)`);
  return true;
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

async function run() {
  let success = 0;
  for (const product of PRODUCTS) {
    if (await generateOne(product)) success++;
  }
  console.log(`\n🎉 ${success}/${PRODUCTS.length} tilted bottles generated.`);
}

run().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
