/**
 * Lightweight per-IP rate limiter backed by Netlify Blobs.
 *
 * Use sparingly — Blobs reads/writes have latency. Suitable for
 * money-touching endpoints (payment intent) where the cost of being
 * spammed dwarfs the cost of an extra Blob roundtrip.
 *
 *   const { allow } = require('./lib/rate-limit');
 *   const ok = await allow(event, { key: 'payment', limit: 8, windowSec: 60 });
 *   if (!ok) return 429;
 */

const { getStore } = require('@netlify/blobs');

function clientIp(event) {
  const fwd = event.headers['x-nf-client-connection-ip']
    || event.headers['x-forwarded-for']
    || '';
  if (fwd) return String(fwd).split(',')[0].trim();
  return 'unknown';
}

/**
 * Returns true if the request is allowed; false if over the limit.
 * Best-effort — if Blobs is unavailable, allows the request through
 * (fail-open) so we never break checkout on infra hiccups.
 */
async function allow(event, { key, limit = 10, windowSec = 60 } = {}) {
  try {
    const ip = clientIp(event);
    const store = getStore('rate-limits');
    const bucket = `${key}:${ip}`;
    const now = Date.now();
    const windowStart = now - windowSec * 1000;

    let entry;
    try {
      entry = await store.get(bucket, { type: 'json' });
    } catch {
      entry = null;
    }
    const timestamps = (entry?.t || []).filter(t => t > windowStart);
    if (timestamps.length >= limit) return false;
    timestamps.push(now);
    await store.setJSON(bucket, { t: timestamps });
    return true;
  } catch (e) {
    console.warn('[RATE LIMIT] Bypassed due to error:', e.message);
    return true;
  }
}

module.exports = { allow, clientIp };
