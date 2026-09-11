const fs = require('fs');
const path = require('path');
const { LOGO_URL } = require('../../netlify/functions/lib/email-templates/shared');

let cached;
function logoDataUri() {
  if (cached) return cached;
  const filePath = path.join(__dirname, '..', '..', 'public', 'assets', 'brand', 'freeley_logo_primary.png');
  cached = `data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}`;
  return cached;
}

/**
 * Artifact pages can't load an external image — the CSP blocks anything
 * from a plain https:// src except a script from the allowed CDNs, so
 * `<img src="https://freeley.com/...">` renders as a broken-image icon
 * inside an Artifact iframe. Only affects PREVIEWING emails this way; a
 * real inbox fetches LOGO_URL over HTTPS with no such restriction, so
 * shared.js itself stays untouched — this is a preview-only workaround.
 */
function inlineLogo(html) {
  return html.split(LOGO_URL).join(logoDataUri());
}

module.exports = { inlineLogo };
