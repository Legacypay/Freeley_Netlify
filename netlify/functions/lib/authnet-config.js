/**
 * Authorize.Net credentials, resolved per environment.
 *
 * `AUTHNET_ENV` ("sandbox" | "production", default production) selects which
 * credential set is used, so switching between the free sandbox account and
 * the real merchant account is a one-variable flip — no re-pasting of keys:
 *
 *   AUTHNET_ENV=sandbox     → AUTHNET_SANDBOX_API_LOGIN_ID, AUTHNET_SANDBOX_TRANSACTION_KEY,
 *                             AUTHNET_SANDBOX_CLIENT_KEY, AUTHNET_SANDBOX_SIGNATURE_KEY
 *                             endpoint apitest.authorize.net, Accept.js from jstest.authorize.net
 *   AUTHNET_ENV=production  → AUTHNET_LIVE_API_LOGIN_ID, AUTHNET_LIVE_TRANSACTION_KEY,
 *                             AUTHNET_LIVE_CLIENT_KEY, AUTHNET_LIVE_SIGNATURE_KEY
 *                             endpoint api.authorize.net, Accept.js from js.authorize.net
 *
 * Each prefixed variable falls back to the historical un-prefixed name
 * (AUTHNET_API_LOGIN_ID, AUTHNET_TRANSACTION_KEY, AUTHNET_CLIENT_KEY,
 * AUTHNET_SIGNATURE_KEY) so an environment that only defines one set keeps
 * working. Sandbox and production credentials are NOT interchangeable —
 * Authorize.Net answers E00007 "User authentication failed" when a sandbox
 * key is sent to the production host or vice versa (verified 2026-09-01).
 *
 * `src/pages/checkout.astro` mirrors this resolution in its frontmatter for the
 * browser-side Accept.js pair (API Login ID + Public Client Key). Keep both in sync.
 */

const ENDPOINTS = {
  production: 'https://api.authorize.net/xml/v1/request.api',
  sandbox: 'https://apitest.authorize.net/xml/v1/request.api'
};
const ACCEPT_JS = {
  production: 'https://js.authorize.net/v1/Accept.js',
  sandbox: 'https://jstest.authorize.net/v1/Accept.js'
};

function resolveAuthnetConfig(env = process.env) {
  const mode = String(env.AUTHNET_ENV || 'production').trim().toLowerCase() === 'sandbox' ? 'sandbox' : 'production';
  const prefix = mode === 'sandbox' ? 'AUTHNET_SANDBOX_' : 'AUTHNET_LIVE_';
  const pick = (name) => String(env[prefix + name] || env['AUTHNET_' + name] || '').trim();
  return {
    mode,
    endpoint: ENDPOINTS[mode],
    acceptJsSrc: ACCEPT_JS[mode],
    apiLoginId: pick('API_LOGIN_ID'),
    transactionKey: pick('TRANSACTION_KEY'),
    clientKey: pick('CLIENT_KEY'),
    signatureKey: pick('SIGNATURE_KEY'),
    simulate: String(env.AUTHNET_SIMULATE || '').trim().toLowerCase() === 'true'
  };
}

module.exports = { resolveAuthnetConfig, ENDPOINTS, ACCEPT_JS };
