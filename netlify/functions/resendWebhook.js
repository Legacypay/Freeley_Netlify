/**
 * Netlify Function: resendWebhook
 *
 * Receives delivery-event webhooks from Resend (bounces, spam complaints)
 * and adds the address to lib/email/engine.js's suppression list — the
 * single check every future send (transactional or marketing) goes through.
 * Protects sender reputation: repeatedly emailing a hard-bounced or
 * complained-about address is what gets a sending domain blocklisted.
 *
 * Register in the Resend dashboard: Webhooks → Add Endpoint
 *   URL: https://freeley.com/.netlify/functions/resendWebhook
 *   Events: email.bounced, email.complained, email.suppressed
 *
 * Registered 2026-09-10 via the Resend MCP (webhook id
 * 2eff0154-4bd7-4fb9-85b6-24a28f9df40a) — already live in production.
 *
 * Resend signs webhooks using Svix (https://docs.resend.com/webhooks) —
 * verified here with plain crypto, matching this repo's convention of not
 * adding an SDK dependency for one HTTP integration (see authnetWebhook.js,
 * stripeWebhook.js for the same pattern with their own gateways' schemes).
 *
 * Required env var: RESEND_WEBHOOK_SECRET (Resend dashboard → the endpoint's
 * "Signing Secret", starts with "whsec_").
 *
 * POST /.netlify/functions/resendWebhook
 */

const crypto = require('crypto');
const { connectBlobs } = require('./lib/blobs');
const { suppress } = require('./lib/email/engine');

/**
 * Svix signature scheme: HMAC-SHA256("<svix-id>.<svix-timestamp>.<body>"),
 * keyed by the base64-decoded secret (after stripping its "whsec_" prefix),
 * base64-encoded. svix-signature carries one or more space-separated
 * "v1,<base64sig>" tokens (multiple only during secret rotation) — any match
 * is accepted.
 */
function verifyResendSignature(rawBody, headers, secret) {
  const id = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const sigHeader = headers['svix-signature'];
  if (!id || !timestamp || !sigHeader) return false;

  let secretBytes;
  try {
    secretBytes = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  } catch {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(`${id}.${timestamp}.${rawBody}`, 'utf8')
    .digest('base64');

  return sigHeader.split(' ').some(token => {
    const sig = token.split(',')[1];
    if (!sig) return false;
    try {
      const a = Buffer.from(sig, 'base64');
      const b = Buffer.from(expected, 'base64');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

exports.handler = async (event) => {
  connectBlobs(event);
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[RESEND WEBHOOK] CRITICAL: RESEND_WEBHOOK_SECRET not set — rejecting all webhooks');
    return { statusCode: 500, body: JSON.stringify({ error: 'Webhook secret not configured' }) };
  }

  const rawBody = event.body || '';
  const headers = {};
  for (const [k, v] of Object.entries(event.headers || {})) headers[k.toLowerCase()] = v;

  if (!verifyResendSignature(rawBody, headers, secret)) {
    console.error('[RESEND WEBHOOK] Invalid signature — rejecting request');
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid webhook signature' }) };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const type = payload.type;
  const email = payload.data && Array.isArray(payload.data.to) ? payload.data.to[0] : undefined;
  console.log(`[RESEND WEBHOOK] Event: ${type}`);

  try {
    switch (type) {
      case 'email.bounced':
        if (email) await suppress(email, 'bounced');
        break;
      case 'email.complained':
        if (email) await suppress(email, 'complained');
        break;
      case 'email.suppressed':
        // Resend already suppresses on its own side (won't attempt delivery
        // to this address again regardless) — mirrored into our own
        // suppression list too so isSuppressed()'s kind-aware check
        // (marketing-only vs. everything) still applies to anything we
        // schedule for this address going forward.
        if (email) await suppress(email, 'bounced');
        break;
      default:
        console.log(`[RESEND WEBHOOK] Unhandled event: ${type}`);
    }
    return { statusCode: 200, body: JSON.stringify({ received: true, type }) };
  } catch (error) {
    console.error(`[RESEND WEBHOOK] Error processing ${type}:`, error.message);
    // 500 so Resend retries delivery.
    return { statusCode: 500, body: JSON.stringify({ error: 'Processing failed, will retry' }) };
  }
};
