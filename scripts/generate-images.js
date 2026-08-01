/**
 * Generate replacement images via Gemini 2.5 Flash Image ("nano banana").
 *
 * Backs up the current file next to itself as "<name>.original.<ext>"
 * (skipped if that backup already exists), generates a new image per
 * manifest entry, resizes/reformats it to match the original file, and
 * overwrites the original path.
 *
 * Usage:
 *   GEMINI_API_KEY=xxx node scripts/generate-images.js <manifest.json>
 *
 * manifest.json: [{ "output": "public/assets/wl/hero.png", "prompt": "..." }, ...]
 * Paths in "output" are relative to the repo root.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing GEMINI_API_KEY. Run with: GEMINI_API_KEY=xxx node scripts/generate-images.js <manifest.json>');
  process.exit(1);
}

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error('❌ Missing manifest path. Usage: node scripts/generate-images.js <manifest.json>');
  process.exit(1);
}

const REPO_ROOT = path.join(__dirname, '..');
const MODEL = 'gemini-2.5-flash-image';

async function generateImage(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] }
      })
    }
  );

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart) {
    throw new Error(JSON.stringify(data.error || data || 'No image returned'));
  }

  return Buffer.from(imagePart.inlineData.data, 'base64');
}

async function processEntry(entry) {
  const outputPath = path.join(REPO_ROOT, entry.output);
  const ext = path.extname(outputPath).slice(1).toLowerCase();
  const format = ext === 'jpg' ? 'jpeg' : ext;

  console.log(`\n🎨 Generating: ${entry.output}...`);

  if (!fs.existsSync(outputPath)) {
    throw new Error(`Original file not found: ${entry.output}`);
  }

  const backupPath = outputPath.replace(new RegExp(`\\.${ext}$`, 'i'), `.original.${ext}`);
  const original = sharp(outputPath);
  const meta = await original.metadata();

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(outputPath, backupPath);
    console.log(`   💾 Backed up original to ${path.relative(REPO_ROOT, backupPath)}`);
  } else {
    console.log(`   ↪ Backup already exists, skipping backup step`);
  }

  const rawImage = await generateImage(entry.prompt);

  await sharp(rawImage)
    .resize(meta.width, meta.height, { fit: 'cover' })
    .toFormat(format)
    .toFile(outputPath);

  console.log(`   ✅ Replaced: ${entry.output} (${meta.width}x${meta.height})`);
}

async function run() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  console.log(`\n🖼️  Generating ${manifest.length} image(s) via ${MODEL}`);
  console.log('─'.repeat(60));

  let success = 0;

  for (let i = 0; i < manifest.length; i++) {
    if (i > 0) {
      console.log('   ⏳ Waiting 3s...');
      await new Promise((r) => setTimeout(r, 3000));
    }

    try {
      await processEntry(manifest[i]);
      success++;
    } catch (error) {
      console.error(`   ❌ Failed (${manifest[i].output}): ${error.message}`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`\n🎉 Done! ${success}/${manifest.length} images generated.`);
}

run();
