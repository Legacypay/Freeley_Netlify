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

// ── MDI Environment IDs ──────────────────────────────────────
// Discovered from the portal Test Bench "Create Voucher" form. The portal sends
// environment_id to route vouchers to sandbox vs. live. Not in the documented
// PostPartnerVoucherRequest schema, but required in practice. Not secrets —
// overridable via Netlify env vars, same convention as lib/products.js IDs.
const MDI_SANDBOX_ENV_ID = process.env.MDI_SANDBOX_ENV_ID || '6ab0181e-d52a-488f-a161-d64d576b2eba';
const MDI_LIVE_ENV_ID = process.env.MDI_LIVE_ENV_ID || 'b374c499-638d-4e72-b844-4c68fcda2eff';

// Single decision point for sandbox vs. live voucher routing.
// Live only when MDI_LIVE_MODE=true AND the submission is not a test —
// MDI bills every live encounter, so test orders must never reach live.
function resolveMdiEnvironment({ isTest = false } = {}) {
  const live = process.env.MDI_LIVE_MODE === 'true' && !isTest;
  return { id: live ? MDI_LIVE_ENV_ID : MDI_SANDBOX_ENV_ID, name: live ? 'live' : 'sandbox' };
}

// ── Token Cache ──────────────────────────────────────────────
let cachedToken = null;
let tokenExpiresAt = 0;

// Redacted preview of a secret/ID for log diagnostics: first 4 + last 4 chars.
function preview(value) {
  if (!value) return '<unset>';
  const s = String(value);
  if (s.length <= 10) return s.slice(0, 2) + '…' + s.slice(-2);
  return s.slice(0, 4) + '…' + s.slice(-4);
}

// One-shot cold-start log so we can verify which credentials Netlify
// actually injected at function boot. Never logs the secret itself.
const _envSummary = {
  base_url: BASE_URL,
  sandbox_mode: process.env.MDI_LIVE_MODE !== 'true',
  client_id: preview(process.env.MDI_CLIENT_ID),
  client_secret: process.env.MDI_CLIENT_SECRET ? 'set' : '<missing>',
  partner_id: preview(process.env.MDI_PARTNER_ID),
  scope: process.env.MDI_AUTH_SCOPE || '*',
  webhook_secret: process.env.MDI_WEBHOOK_SECRET ? 'set' : '<missing>'
};
console.log('[MDI CLIENT] env on cold-start:', JSON.stringify(_envSummary));

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
  // MDI Partner OAuth2 — POST /v1/partner/auth/token (NOT /oauth/token)
  // Requires scope parameter per API docs (PostPartnerAuthRequest schema)
  const scope = process.env.MDI_AUTH_SCOPE || '*';
  console.log('[MDI CLIENT] requesting token | base: ' + BASE_URL + ' | client_id: ' + preview(clientId) + ' | scope: ' + scope);
  const response = await fetch(BASE_URL + '/v1/partner/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: scope })
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error('MDI auth failed (' + response.status + '): ' + err);
  }
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = null; }
  // MDI may return { access_token, expires_in, ... } or just a token string
  if (data && data.access_token) {
    cachedToken = data.access_token;
    const expiresIn = data.expires_in || 3600;
    tokenExpiresAt = now + (expiresIn * 1000);
  } else if (typeof text === 'string' && text.length > 20) {
    // Raw token string returned
    cachedToken = text.replace(/^"|"$/g, ''); // strip wrapping quotes if any
    tokenExpiresAt = now + (3600 * 1000); // default 1hr
  } else {
    throw new Error('MDI auth returned unexpected response: ' + text.slice(0, 200));
  }
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

module.exports = { getAccessToken, mdiRequest, verifyWebhookSignature, getCorsHeaders, resolveMdiEnvironment, CORS_HEADERS, BASE_URL, MDI_SANDBOX_ENV_ID, MDI_LIVE_ENV_ID };
