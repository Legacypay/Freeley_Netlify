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
// In-memory cache for the access token. Netlify Functions are
// short-lived, so this only helps within a single warm instance.
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Get a valid Bearer token from MD Integrations.
 * Caches the token and refreshes when expired.
 */
async function getAccessToken() {
  const now = Date.now();

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  const clientId = process.env.MDI_CLIENT_ID;
  const clientSecret = process.env.MDI_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing MDI_CLIENT_ID or MDI_CLIENT_SECRET. ' +
      'Set these in Netlify Dashboard > Site Settings > Environment Variables.'
    );
  }

  const response = await fetch(`${BASE_URL}/v1/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`MDI auth failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;

  // Default to 1 hour if no expiry provided
  const expiresIn = data.expires_in || 3600;
  tokenExpiresAt = now + (expiresIn * 1000);

  return cachedToken;
}

/**
 * Make an authenticated request to the MDI API.
 * 
 * @param {string} method - HTTP method (GET, POST, PATCH, DELETE)
 * @param {string} path   - API path (e.g. '/v1/patient/patients')
 * @param {object} [body] - Request body (will be JSON-stringified)
 * @returns {object}      - Parsed JSON response
 */
async function mdiRequest(method, path, body = null) {
  const token = await getAccessToken();

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);

  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error(`MDI API error (${response.status}): ${errorBody}`);
    error.statusCode = response.status;
    throw error;
  }

  // Some endpoints return empty responses (204)
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Verify an incoming webhook signature from MDI.
 * 
 * @param {string} payload   - Raw request body string
 * @param {string} signature - Value from the 'Signature' header
 * @returns {boolean}        - Whether the signature is valid
 */
function verifyWebhookSignature(payload, signature) {
  const crypto = require('crypto');
  const secret = process.env.MDI_WEBHOOK_SECRET;

  if (!secret) {
    console.warn('[MDI] MDI_WEBHOOK_SECRET not set — skipping signature verification');
    return true; // Allow in dev, but log a warning
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature || '', 'utf8'),
    Buffer.from(expected, 'utf8')
  );
}

// ── CORS helper ──────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

module.exports = {
  getAccessToken,
  mdiRequest,
  verifyWebhookSignature,
  CORS_HEADERS,
  BASE_URL
};
