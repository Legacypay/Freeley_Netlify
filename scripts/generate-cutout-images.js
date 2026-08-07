/**
 * Generate TRANSPARENT full-body cutout photos via Gemini 2.5 Flash Image,
 * matching the site's existing hero convention (e.g. public/assets/wl/hero.png,
 * public/assets/l/hero.png — tall portrait, real alpha channel, no background).
 *
 * Unlike scripts/generate-images.js (flat edits/overwrites), this always
 * generates fresh: it shoots the subject against a solid green backdrop
 * (forced into every prompt), then keys it out itself.
 *
 * Gemini does NOT reproduce an exact hex color from a text prompt — asking
 * for "#00FF00" in practice yields a muted, vignetted, slightly noisy sage
 * green, not a flat saturated screen. So the key is COLOR-ADAPTIVE, not a
 * hardcoded green-dominance test: it samples the actual backdrop color from
 * the four corners of the generated image (reliably background on a
 * centered portrait), then keys every pixel by Euclidean distance to that
 * sampled color, per-pixel — NOT a flood-fill from one seed, which
 * previously failed on this project because it only clears connected
 * regions and is fooled by JPEG/antialiasing noise near edges.
 * Includes edge de-spill (pulls residual backdrop tint out of
 * semi-transparent fringe pixels) so subjects don't get a color halo.
 *
 * Usage:
 *   GEMINI_API_KEY=xxx node scripts/generate-cutout-images.js <manifest.json>
 *
 * manifest.json: [{ "output": "public/assets/hl/hero.png", "width": 900,
 *                    "height": 1300, "prompt": "..." }, ...]
 * "prompt" should describe ONLY the subject/pose/wardrobe — the chroma-key
 * backdrop instruction is appended automatically, do not duplicate it.
 * Paths in "output" are relative to the repo root.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { generateImage } = require('./lib/openai-image');

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error('❌ Missing manifest path. Usage: node scripts/generate-cutout-images.js <manifest.json>');
  process.exit(1);
}

const REPO_ROOT = path.join(__dirname, '..');

const PORTRAIT_BACKDROP = `
Full-body studio portrait, person standing, camera straight-on, shot from
just above the head down to at least mid-thigh (ideally including feet).
The ENTIRE background, with zero exceptions, must be a single flat, evenly
and brightly lit solid neon chroma-key green (like a film-production green
screen, pure saturated RGB 0,255,0) — no shadows, no vignette, no
darkening toward the edges or corners, no film grain or noise, no gradient,
no floor line, no props, nothing but perfectly flat uniform green fills
every pixel behind and around the subject, corner to corner. Studio
lighting falls only on the subject, not the backdrop. The subject's
clothing, hair, skin, and any accessories must contain NO green whatsoever
(it will be keyed out). Photorealistic, sharp focus, clean edges around
the subject.`.trim();

// For icon/badge art (not people) — same green-screen keying trick, framed
// for a small centered graphic instead of a full-body photo.
const ICON_BACKDROP = `
A single clean icon/badge illustration or 3D render, centered, filling
most of the frame with minimal empty margin. The ENTIRE background, with
zero exceptions, must be a single flat, evenly lit solid neon chroma-key
green (pure saturated RGB 0,255,0) — no shadows, no vignette, no gradient,
no texture. The icon/badge itself must contain NO green whatsoever (it
will be keyed out). Clean, sharp, modern flat-design or soft-3D style.`.trim();

// Back-compat name used by the rest of this file.
const BACKDROP_INSTRUCTION = PORTRAIT_BACKDROP;

// Sample the actual backdrop color Gemini produced (it does not reproduce
// an exact hex from text — expect a saturated-but-vignetted green with a
// visible lighting gradient across the frame, not a flat 0,255,0) from the
// four corners, just to measure how green-dominant THIS run's backdrop is.
function sampleBackdropColor(raw, width, height, channels) {
  const corners = [
    0,
    (width - 1) * channels,
    (height - 1) * width * channels,
    ((height - 1) * width + width - 1) * channels,
  ];
  let r = 0, g = 0, b = 0;
  for (const o of corners) { r += raw[o]; g += raw[o + 1]; b += raw[o + 2]; }
  return { r: r / 4, g: g / 4, b: b / 4 };
}

// Key on green DOMINANCE (g minus max(r,b)), not absolute color distance —
// a vignette/gradient changes a pixel's brightness but not its hue, so this
// test stays reliable across the whole backdrop's lighting falloff, unlike
// distance-to-one-sampled-color which only matched where the gradient
// happened to match the sample. Thresholds are calibrated per-run off the
// sampled corner's own dominance strength, since how saturated Gemini's
// green comes out varies run to run.
function keyOutBackdrop(raw, width, height, channels, key) {
  const keyDominance = key.g - Math.max(key.r, key.b);
  const LOW = keyDominance * 0.16;  // dominance below this -> not green -> opaque
  const HIGH = keyDominance * 0.4;  // dominance above this -> green -> transparent (tighter band, less fringe left to despill — fine hair needs this narrower)

  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const r = raw[o], g = raw[o + 1], b = raw[o + 2];
    const dominance = g - Math.max(r, b);

    let alpha;
    if (dominance <= LOW) alpha = 255;
    else if (dominance >= HIGH) alpha = 0;
    else alpha = Math.round(255 * (1 - (dominance - LOW) / (HIGH - LOW)));

    // Spill suppression: applied to EVERY pixel, not just the semi-
    // transparent band — real green-screen photos bounce green light onto
    // hair/skin near the backdrop even where alpha ends up fully opaque
    // (thin hair strands especially), so gating this on alpha missed most
    // of the fringe. Standard green-spill fix: clamp G down to roughly
    // max(R,B) wherever G is the dominant channel.
    if (dominance > 0) {
      raw[o + 1] = Math.round(g - dominance * 0.9);
    }

    raw[o + 3] = alpha;
  }
  return raw;
}

// Gemini's "full-body, head to mid-thigh" framing leaves real headroom/
// footroom around the subject — fine for a normal photo, but this site's
// existing hero cutouts (public/assets/wl/hero.png etc.) fill their canvas
// almost edge to edge. Left un-trimmed, the CSS box renders at the right
// pixel height but the PEOPLE inside it only occupy ~70% of that height —
// visibly smaller than the reference heroes even though the box matches.
// So: find the actual alpha content bounding box and crop to it (plus a
// small margin) before the final resize, matching the site's convention.
function findContentBBox(raw, width, height, channels, alphaThreshold) {
  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = raw[(y * width + x) * channels + 3];
      if (a > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // nothing above threshold — key failed entirely
  return { minX, maxX, minY, maxY };
}

async function processEntry(entry) {
  const outputPath = path.join(REPO_ROOT, entry.output);
  if (!entry.width || !entry.height) {
    throw new Error(`"width"/"height" are required (target canvas for the transparent cutout): ${entry.output}`);
  }

  console.log(`\n🎨 Generating cutout: ${entry.output}...`);

  const backdrop = entry.subject === 'icon' ? ICON_BACKDROP : PORTRAIT_BACKDROP;
  const fullPrompt = `${entry.prompt}\n\n${backdrop}`;
  const rawImage = await generateImage(fullPrompt);

  const { data, info } = await sharp(rawImage)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const key = sampleBackdropColor(data, info.width, info.height, info.channels);
  console.log(`   🎯 Sampled backdrop color: rgb(${Math.round(key.r)}, ${Math.round(key.g)}, ${Math.round(key.b)})`);
  const keyed = keyOutBackdrop(data, info.width, info.height, info.channels, key);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  let pipeline = sharp(keyed, { raw: { width: info.width, height: info.height, channels: info.channels } });

  const bbox = findContentBBox(keyed, info.width, info.height, info.channels, 40);
  if (bbox) {
    const margin = Math.round(Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) * 0.02);
    const left = Math.max(0, bbox.minX - margin);
    const top = Math.max(0, bbox.minY - margin);
    const right = Math.min(info.width, bbox.maxX + margin + 1);
    const bottom = Math.min(info.height, bbox.maxY + margin + 1);
    const cropW = right - left, cropH = bottom - top;
    console.log(`   ✂️  Trimmed transparent padding: ${info.width}x${info.height} -> ${cropW}x${cropH}`);
    pipeline = pipeline.extract({ left, top, width: cropW, height: cropH });
  } else {
    console.warn('   ⚠️  No content found above the alpha threshold — key may have failed, skipping trim');
  }

  await pipeline
    .resize(entry.width, entry.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outputPath);

  console.log(`   ✅ Created transparent cutout: ${entry.output} (${entry.width}x${entry.height})`);
}

async function run() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  console.log(`\n🖼️  Generating ${manifest.length} transparent cutout(s) via chroma-key`);
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
  console.log(`\n🎉 Done! ${success}/${manifest.length} cutouts generated.`);
}

run();
