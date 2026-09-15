#!/usr/bin/env node
/**
 * Rasterizes public/assets/brand/freeley_logo_email.svg to a crisp,
 * transparent-background PNG for use in emails (lib/email-templates/shared.js's
 * LOGO_URL) — SVG itself isn't safe in email (Outlook desktop doesn't render
 * it), so this is the one manual regeneration step whenever the mark changes.
 *
 * Run: node scripts/build-email-logo.js
 */
const path = require('path');
const sharp = require('sharp');

const BRAND_DIR = path.join(__dirname, '..', 'public', 'assets', 'brand');
const WIDTH = 1200; // ~8x the 150px display width emails use — generous retina headroom

async function build(name) {
  const src = path.join(BRAND_DIR, `${name}.svg`);
  const out = path.join(BRAND_DIR, `${name}.png`);
  const info = await sharp(src, { density: 900 }).resize({ width: WIDTH }).png().toFile(out);
  console.log(`Wrote ${out} (${info.width}x${info.height})`);
}

Promise.all(['freeley_logo_email', 'freeley_logo_email_white'].map(build)).catch(err => {
  console.error('Failed to build email logo:', err.message);
  process.exit(1);
});
