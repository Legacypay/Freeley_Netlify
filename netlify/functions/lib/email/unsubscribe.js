/**
 * Stateless unsubscribe links for marketing/journey emails (CAN-SPAM
 * requires a working opt-out on every commercial email). No session, no
 * database lookup — the link itself is the credential: an HMAC-SHA256 of
 * the recipient's email, keyed by EMAIL_UNSUBSCRIBE_SECRET. Anyone holding
 * a valid link can unsubscribe that one address and nothing else.
 *
 * Never used for transactional emails (order/case-status/receipt) — those
 * don't carry this link at all (see engine.js's `kind` param).
 */
const crypto = require('crypto');

function secret() {
  const s = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  if (!s) {
    console.warn('[EMAIL UNSUBSCRIBE] EMAIL_UNSUBSCRIBE_SECRET not set — unsubscribe links will not verify correctly');
  }
  return s || 'insecure-dev-only-secret-set-EMAIL_UNSUBSCRIBE_SECRET';
}

function normalize(email) {
  return String(email || '').toLowerCase().trim();
}

function tokenFor(email) {
  return crypto.createHmac('sha256', secret()).update(normalize(email)).digest('hex').slice(0, 32);
}

/** @returns {string} absolute URL to the emailPreferences function for this address */
function buildUnsubscribeUrl(email) {
  const base = (process.env.URL || 'https://freeley.com').replace(/\/$/, '');
  const e = encodeURIComponent(normalize(email));
  const t = tokenFor(email);
  return `${base}/.netlify/functions/emailPreferences?e=${e}&t=${t}`;
}

/** Constant-time compare — never leak timing info about a valid token. */
function verifyToken(email, token) {
  if (!email || !token) return false;
  const expected = Buffer.from(tokenFor(email));
  const provided = Buffer.from(String(token));
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}

module.exports = { buildUnsubscribeUrl, verifyToken };
