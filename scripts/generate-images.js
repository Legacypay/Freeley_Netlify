/**
 * Generate replacement images via Gemini 2.5 Flash Image ("nano banana").
 *
 * If "output" already exists: backs it up as "<name>.original.<ext>" (skipped
 * if that backup already exists), sends the CURRENT image alongside the
 * prompt so Gemini actually edits it (true image-conditioned edit, not a
 * blind text-only reimagining — required for "keep everything identical,
 * only change X" prompts), then overwrites it, resized to match the
 * original's own dimensions.
 * If "output" does not exist: pure text-to-image, creates it fresh, resized
 * to the manifest entry's "width"/"height" (required in that case) — unless
 * "editFrom" names another (already-generated) manifest entry's output path,
 * in which case THAT image is sent as the conditioning source instead (e.g.
 * generating an "after" photo from an already-generated "before" photo, so
 * they read as the same person). Process the manifest in an order where any
 * "editFrom" target comes before the entry that references it.
 *
 * Usage:
 *   GEMINI_API_KEY=xxx node scripts/generate-images.js <manifest.json>
 *
 * manifest.json: [{ "output": "public/assets/wl/hero.png", "prompt": "...",
 *                    "width": 900, "height": 900 /* only for new files *\/,
 *                    "editFrom": "public/assets/wl/other.png" /* optional *\/,
 *                    "transparent": true /* optional, see below *\/ }, ...]
 * Paths in "output"/"editFrom" are relative to the repo root.
 *
 * "transparent": true asks the model for a real alpha-transparent
 * background instead of its default opaque fill (see scripts/lib's
 * opts.transparent) — set this on cutout-style product/object shots meant
 * to sit on a page's own background color. Leave it unset for full-bleed
 * photos/illustrations that are supposed to have a background baked in.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { generateImage, MIME_TYPES, MODEL } = require('./lib/openai-image');

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error('❌ Missing manifest path. Usage: node scripts/generate-images.js <manifest.json>');
  process.exit(1);
}

const REPO_ROOT = path.join(__dirname, '..');

async function processEntry(entry) {
  const outputPath = path.join(REPO_ROOT, entry.output);
  const ext = path.extname(outputPath).slice(1).toLowerCase();
  const format = ext === 'jpg' ? 'jpeg' : ext;

  console.log(`\n🎨 Generating: ${entry.output}...`);

  const exists = fs.existsSync(outputPath);
  let targetWidth, targetHeight, sourceImage;

  if (exists) {
    const backupPath = outputPath.replace(new RegExp(`\\.${ext}$`, 'i'), `.original.${ext}`);
    const originalBuffer = fs.readFileSync(outputPath);
    const meta = await sharp(originalBuffer).metadata();
    targetWidth = meta.width;
    targetHeight = meta.height;
    sourceImage = { buffer: originalBuffer, mimeType: MIME_TYPES[ext] || 'image/png' };

    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(outputPath, backupPath);
      console.log(`   💾 Backed up original to ${path.relative(REPO_ROOT, backupPath)}`);
    } else {
      console.log(`   ↪ Backup already exists, skipping backup step`);
    }
  } else {
    if (!entry.width || !entry.height) {
      throw new Error(`New file (no existing original) needs "width"/"height" in the manifest: ${entry.output}`);
    }
    targetWidth = entry.width;
    targetHeight = entry.height;
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    if (entry.editFrom) {
      const editFromPath = path.join(REPO_ROOT, entry.editFrom);
      if (!fs.existsSync(editFromPath)) {
        throw new Error(`"editFrom" target not found (check manifest order): ${entry.editFrom}`);
      }
      const editFromExt = path.extname(editFromPath).slice(1).toLowerCase();
      sourceImage = { buffer: fs.readFileSync(editFromPath), mimeType: MIME_TYPES[editFromExt] || 'image/png' };
    }
  }

  const rawImage = await generateImage(entry.prompt, sourceImage, { transparent: !!entry.transparent });

  await sharp(rawImage)
    .resize(targetWidth, targetHeight, { fit: 'cover' })
    .toFormat(format)
    .toFile(outputPath);

  console.log(`   ✅ ${exists ? 'Replaced' : 'Created'}: ${entry.output} (${targetWidth}x${targetHeight})`);
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
