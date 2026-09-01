const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveAuthnetConfig } = require('../../netlify/functions/lib/authnet-config');

test('sandbox picks AUTHNET_SANDBOX_* and the apitest host', () => {
  const c = resolveAuthnetConfig({ AUTHNET_ENV: 'sandbox', AUTHNET_SANDBOX_API_LOGIN_ID: 'sb-login', AUTHNET_SANDBOX_TRANSACTION_KEY: 'sb-key', AUTHNET_LIVE_API_LOGIN_ID: 'live-login', AUTHNET_LIVE_TRANSACTION_KEY: 'live-key', AUTHNET_CLIENT_KEY: 'generic-client' });
  assert.equal(c.mode, 'sandbox');
  assert.equal(c.apiLoginId, 'sb-login');
  assert.equal(c.transactionKey, 'sb-key');
  assert.equal(c.clientKey, 'generic-client'); // falls back to the un-prefixed name
  assert.match(c.endpoint, /apitest\.authorize\.net/);
  assert.match(c.acceptJsSrc, /jstest\.authorize\.net/);
});

test('production picks AUTHNET_LIVE_* and the live host; default when AUTHNET_ENV unset', () => {
  const c = resolveAuthnetConfig({ AUTHNET_LIVE_API_LOGIN_ID: 'live-login', AUTHNET_LIVE_TRANSACTION_KEY: ' live-key ', AUTHNET_SANDBOX_TRANSACTION_KEY: 'sb-key', AUTHNET_SIGNATURE_KEY: 'sig' });
  assert.equal(c.mode, 'production');
  assert.equal(c.apiLoginId, 'live-login');
  assert.equal(c.transactionKey, 'live-key');
  assert.equal(c.signatureKey, 'sig');
  assert.match(c.endpoint, /^https:\/\/api\.authorize\.net/);
  assert.equal(c.simulate, false);
});

test('legacy un-prefixed variables still work and AUTHNET_SIMULATE is parsed', () => {
  const c = resolveAuthnetConfig({ AUTHNET_ENV: 'Production', AUTHNET_API_LOGIN_ID: 'x', AUTHNET_TRANSACTION_KEY: 'y', AUTHNET_SIMULATE: 'true' });
  assert.equal(c.apiLoginId, 'x');
  assert.equal(c.transactionKey, 'y');
  assert.equal(c.simulate, true);
});
