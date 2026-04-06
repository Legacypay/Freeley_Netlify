/**
 * MD Integrations API Client
 * 
 * Shared helper for all MDI-related Netlify Functions.
 * Handles authentication, token caching, and common API calls.
 * 
 * Required environment variables (set in Netlify Dashboard > Site Settings > Environment Variables):
 *   MDI_CLIENT_ID       - Your MD Integrations Partner Client ID
 *   MDI_CLIENT_SECRET    - Your MD Integrations Partner Client Secret
 *   MDI_BASE_URL         - API base URL (default: https://api.mdintegrations.com)
 *   MDI_WEBHOOK_SECRET   - Secret key for verifying incoming webhook signatures
 */

const BASE_URL = process.env.MDI_BASE_URL || 'https://api.mdintegrations.com';

// ── Token Cache ──────────────────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }
  const clientId = process.env.MDI_CLIENT_ID;
  const clientSecret = process.env.MDI_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing MDI_CLIENT_ID or MDI_CLIENT_SECRET. Set these in Netlify Dashboard > Site Settings > Environment Variables.');
  }
  // MDI uses OAuth2 client_credentials grant at /oauth/token
  const response = await fetch(BASE_URL + '/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret })
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error('MDI auth failed (' + response.status + '): ' + err);
  }
  const data = await response.json();
  cachedToken = data.access_token;
  const expiresIn = data.expires_in || 3600;
  tokenExpiresAt = now + (expiresIn * 1000);
  return cachedToken;
}

async function mdiRequest(method, path, body = null) {
  const token = await getAccessToken();
  const options = {
    method,
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/json' }
  };
  if (body && method !== 'GET') { options.body = JSON.stringify(body); }
  const response = await fetch(BASE_URL + path, options);
  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error('MDI API error (' + response.status + '): ' + errorBody);
    error.statusCode = response.status;
    throw error;
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function verifyWebhookSignature(payload, signature) {
  const crypto = require('crypto');
  const secret = process.env.MDI_WEBHOOK_SECRET;
  // SECURITY: Fail closed — if no secret is configured, reject all webhooks
  if (!secret) { console.error('[MDI] CRITICAL: MDI_WEBHOOK_SECRET not set — rejecting all webhooks for safety'); return false; }
  if (!signature) { console.error('[MDI] Missing webhook signature header'); return false; }
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'));
}

// SECURITY: Restrict CORS to production domains only (was wildcard '*')
const ALLOWED_ORIGINS = ['https://freeley.com', 'https://www.freeley.com'];

function getCorsHeaders(event) {
  const origin = (event && event.headers && event.headers.origin) || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin'
  };
}

// Legacy compat: static CORS_HEADERS for functions that don't pass event
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://freeley.com',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

module.exports = { getAccessToken, mdiRequest, verifyWebhookSignature, getCorsHeaders, CORS_HEADERS, BASE_URL };
