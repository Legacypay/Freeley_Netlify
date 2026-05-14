/**
 * Firebase ID Token verification using Google's public keys.
 *
 * Replaces the legacy identitytoolkit/v3 REST lookup (which does NOT
 * verify the JWT signature). This module validates:
 *   - JWT signature against Google's rotating public keys
 *   - alg = RS256
 *   - iss = https://securetoken.google.com/<project_id>
 *   - aud = <project_id>
 *   - exp / iat / sub
 *
 * Required env var: FIREBASE_PROJECT_ID
 *   (No service account needed — verifies against Google's public keys.)
 */

const { createPublicKey, createVerify } = require('crypto');

const GOOGLE_CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let _certCache = { keys: null, fetchedAt: 0, maxAgeMs: 0 };

async function getGooglePublicKeys() {
  const now = Date.now();
  if (_certCache.keys && (now - _certCache.fetchedAt) < _certCache.maxAgeMs) {
    return _certCache.keys;
  }
  const res = await fetch(GOOGLE_CERT_URL);
  if (!res.ok) throw new Error('Failed to fetch Google public keys');
  const certs = await res.json();
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = /max-age=(\d+)/.exec(cacheControl);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 3600 * 1000;
  _certCache = { keys: certs, fetchedAt: now, maxAgeMs: maxAge };
  return certs;
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

/**
 * Verify a Firebase ID token. Returns { uid, email, ...claims } on success,
 * or null on any failure. Never throws.
 */
async function verifyFirebaseToken(idToken) {
  if (!idToken || typeof idToken !== 'string') return null;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error('[FIREBASE AUTH] FIREBASE_PROJECT_ID not set — refusing to verify token');
    return null;
  }

  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
    const signature = base64UrlDecode(sigB64);

    if (header.alg !== 'RS256') return null;
    if (!header.kid) return null;

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return null;
    if (payload.iat && payload.iat > now + 60) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (!payload.sub) return null;

    const keys = await getGooglePublicKeys();
    const cert = keys[header.kid];
    if (!cert) return null;

    const publicKey = createPublicKey(cert);
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const valid = verifier.verify(publicKey, signature);
    if (!valid) return null;

    return {
      uid: payload.sub,
      email: payload.email || null,
      email_verified: payload.email_verified || false,
      auth_time: payload.auth_time || null,
      firebase: payload.firebase || null
    };
  } catch (e) {
    console.error('[FIREBASE AUTH] Token verification error:', e.message);
    return null;
  }
}

module.exports = { verifyFirebaseToken };
