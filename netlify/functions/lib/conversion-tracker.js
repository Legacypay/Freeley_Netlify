/**
 * Server-side conversion tracking (HIPAA-safe).
 *
 * Fires post-payment conversion events to:
 *   - Meta Conversions API (when META_PIXEL_ID + META_ACCESS_TOKEN are set)
 *   - GA4 Measurement Protocol (when GA4_MEASUREMENT_ID + GA4_API_SECRET are set)
 *
 * Inputs accept the flat attribution map written by attribution.js
 * (utm_*, fbclid, gclid, fbp, fbc, ga_client, etc.). PII (email, name,
 * phone) is SHA-256 hashed before transmission. No medical context
 * (drug name, condition, dose) is ever sent — both calls receive a
 * generic "Telehealth Medical Consultation" content classification.
 *
 * Each call is best-effort: if a credential is missing the call is
 * skipped silently. If a network call fails the function logs and
 * continues — never blocks the Stripe webhook's 200 response.
 */

const crypto = require('crypto');

function hashPII(str) {
  if (!str) return '';
  return crypto.createHash('sha256').update(String(str).trim().toLowerCase()).digest('hex');
}

async function fireMetaCAPI(payload) {
  const PIXEL_ID = process.env.META_PIXEL_ID;
  const TOKEN = process.env.META_ACCESS_TOKEN;
  if (!PIXEL_ID || !TOKEN) {
    console.log('[CONVERSION] Meta CAPI skipped — set META_PIXEL_ID + META_ACCESS_TOKEN to enable.');
    return { skipped: true, reason: 'missing_meta_credentials' };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const txt = await res.text();
      console.warn('[CONVERSION] Meta CAPI non-OK:', res.status, txt.slice(0, 200));
      return { ok: false, status: res.status };
    }
    console.log('[CONVERSION] Meta CAPI ✓');
    return { ok: true };
  } catch (e) {
    console.warn('[CONVERSION] Meta CAPI error:', e.message);
    return { ok: false, error: e.message };
  }
}

async function fireGA4(payload) {
  const ID = process.env.GA4_MEASUREMENT_ID;
  const SECRET = process.env.GA4_API_SECRET;
  if (!ID || !SECRET) {
    console.log('[CONVERSION] GA4 MP skipped — set GA4_MEASUREMENT_ID + GA4_API_SECRET to enable.');
    return { skipped: true, reason: 'missing_ga4_credentials' };
  }
  try {
    const res = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${ID}&api_secret=${SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.warn('[CONVERSION] GA4 MP non-OK:', res.status);
      return { ok: false, status: res.status };
    }
    console.log('[CONVERSION] GA4 MP ✓');
    return { ok: true };
  } catch (e) {
    console.warn('[CONVERSION] GA4 MP error:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Fire conversion events. Returns a summary of which destinations
 * succeeded/skipped. Never throws — always resolves to an object.
 *
 * @param {object} args
 * @param {number} args.totalValue   USD amount (e.g. 99.29)
 * @param {string} [args.email]      Plaintext — will be hashed
 * @param {string} [args.phone]      Plaintext — will be hashed
 * @param {string} [args.firstName]  Plaintext — will be hashed
 * @param {string} [args.lastName]   Plaintext — will be hashed
 * @param {string} [args.ipAddress]  Client IP if available
 * @param {string} [args.userAgent]  Client UA if available
 * @param {string} [args.eventId]    Idempotency key — same value for browser pixel + CAPI dedup
 * @param {object} [args.attribution] Flat attr_* map from PaymentIntent.metadata
 */
async function fireConversion(args) {
  const a = args || {};
  const attribution = a.attribution || {};
  const eventTime = Math.floor(Date.now() / 1000);
  const eventId = a.eventId || ('pi_' + eventTime + '_' + Math.random().toString(36).slice(2, 8));

  // ── Meta Conversions API payload ──
  const userData = {
    em: a.email ? [hashPII(a.email)] : undefined,
    ph: a.phone ? [hashPII(a.phone)] : undefined,
    fn: a.firstName ? [hashPII(a.firstName)] : undefined,
    ln: a.lastName ? [hashPII(a.lastName)] : undefined,
    client_ip_address: a.ipAddress || undefined,
    client_user_agent: a.userAgent || undefined,
    fbp: attribution.attr_fbp || undefined,
    fbc: attribution.attr_fbc || undefined
  };
  // Strip undefined for cleaner payload
  Object.keys(userData).forEach(k => userData[k] === undefined && delete userData[k]);

  const metaPayload = {
    data: [{
      event_name: 'Purchase',
      event_time: eventTime,
      event_id: eventId,
      action_source: 'website',
      event_source_url: 'https://freeley.com/checkout/success',
      user_data: userData,
      custom_data: {
        value: a.totalValue || 0,
        currency: 'USD',
        // HIPAA firewall — generic only, no drug or condition names.
        content_name: 'Telehealth Medical Consultation',
        content_category: 'Health & Wellness'
      }
    }]
  };

  // ── GA4 Measurement Protocol payload ──
  const ga4Payload = {
    client_id: attribution.attr_ga_client || ('srv.' + eventId),
    timestamp_micros: eventTime * 1000000,
    events: [{
      name: 'purchase',
      params: {
        currency: 'USD',
        value: a.totalValue || 0,
        transaction_id: eventId,
        // Attribution surfaced to GA4 as campaign params (so paid channels
        // get credit even though the user crossed the HIPAA boundary).
        ...(attribution.attr_utm_source   ? { source: attribution.attr_utm_source }     : {}),
        ...(attribution.attr_utm_medium   ? { medium: attribution.attr_utm_medium }     : {}),
        ...(attribution.attr_utm_campaign ? { campaign: attribution.attr_utm_campaign } : {}),
        ...(attribution.attr_utm_term     ? { term: attribution.attr_utm_term }         : {}),
        ...(attribution.attr_utm_content  ? { content: attribution.attr_utm_content }   : {}),
        items: [{
          item_id: 'telehealth_consult',
          item_name: 'Telehealth Medical Consultation',
          price: a.totalValue || 0,
          quantity: 1
        }]
      }
    }]
  };

  const [meta, ga4] = await Promise.all([
    fireMetaCAPI(metaPayload).catch(e => ({ ok: false, error: e.message })),
    fireGA4(ga4Payload).catch(e => ({ ok: false, error: e.message }))
  ]);
  return { eventId, meta, ga4 };
}

module.exports = { fireConversion, hashPII };
