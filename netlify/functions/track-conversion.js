/**
 * HTTP-callable wrapper around lib/conversion-tracker.
 *
 * Most conversions are now fired from inside stripeWebhook.js the
 * moment Stripe confirms a payment (more reliable than a browser
 * fetch because the browser can close after redirect). This endpoint
 * is kept as a manual / external trigger — for cases like:
 *   - Front-end firing immediately on success for redundancy
 *   - External tools (n8n, Zapier) reporting a conversion after the fact
 *   - Manual test fires from cURL
 *
 * POST body shape:
 *   {
 *     totalValue: 99.29,
 *     email, phone, firstName, lastName,   // optional, will be hashed
 *     eventId,                              // for dedup with browser pixel
 *     attribution: { attr_utm_source, attr_fbp, ... }
 *   }
 */

const { fireConversion } = require('./lib/conversion-tracker');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const payload = JSON.parse(event.body || '{}');
    const result = await fireConversion({
      totalValue: payload.totalValue,
      email: payload.email,
      phone: payload.phone,
      firstName: payload.firstName,
      lastName: payload.lastName,
      ipAddress: payload.ipAddress || event.headers['client-ip'] || event.headers['x-nf-client-connection-ip'],
      userAgent: payload.userAgent || event.headers['user-agent'],
      eventId: payload.eventId,
      attribution: payload.attribution || {}
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, ...result })
    };
  } catch (e) {
    console.error('[TRACK CONVERSION] error:', e);
    // Never block the patient flow — return 200 even on internal error.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'internal' })
    };
  }
};
