const fs = require('fs');
const path = require('path');
const { LOGO_URL } = require('../../netlify/functions/lib/email-templates/shared');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const WHITE_LOGO_URL = LOGO_URL.replace('freeley_logo_email.png', 'freeley_logo_email_white.png');
const HIPAA_BADGE_URL = 'https://freeley.com/hipaa-badge-png@2x.png';
const USA_BADGE_URL = 'https://freeley.com/usa-badge-png@2x.png';

// Maps each external URL these preview tools embed to its local file, so
// both sides of the swap live in exactly one place.
const ASSET_MAP = {
  [LOGO_URL]: 'assets/brand/freeley_logo_email.png',
  [WHITE_LOGO_URL]: 'assets/brand/freeley_logo_email_white.png',
  [HIPAA_BADGE_URL]: 'hipaa-badge-png@2x.png',
  [USA_BADGE_URL]: 'usa-badge-png@2x.png'
};

const cache = {};
function dataUri(relPath) {
  if (!cache[relPath]) {
    const ext = path.extname(relPath).slice(1);
    cache[relPath] = `data:image/${ext};base64,${fs.readFileSync(path.join(PUBLIC_DIR, relPath)).toString('base64')}`;
  }
  return cache[relPath];
}

/**
 * Artifact pages can't load an external image — the CSP blocks anything
 * from a plain https:// src except a script from the allowed CDNs, so
 * `<img src="https://freeley.com/...">` renders as a broken-image icon
 * inside an Artifact iframe. Only affects PREVIEWING emails this way; a
 * real inbox fetches these URLs over HTTPS with no such restriction, so
 * the production templates stay untouched — this is a preview-only
 * workaround for every brand asset these scripts embed (logo, trust badges).
 */
function inlineLogo(html) {
  let out = html;
  for (const [url, relPath] of Object.entries(ASSET_MAP)) {
    out = out.split(url).join(dataUri(relPath));
  }
  return out;
}

module.exports = { inlineLogo, WHITE_LOGO_URL, HIPAA_BADGE_URL, USA_BADGE_URL };
