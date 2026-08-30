const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { ensureHubAccount } = require('../../netlify/functions/lib/hub-account');

const realFetch = global.fetch;
const realEnv = {};

beforeEach(() => {
  ['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_ANON_KEY', 'URL'].forEach((k) => {
    realEnv[k] = process.env[k];
  });
  process.env.PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
  process.env.PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  process.env.URL = 'https://freeley.com';
});

afterEach(() => {
  global.fetch = realFetch;
  Object.entries(realEnv).forEach(([k, v]) => {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  });
});

test('returns sent:false without config or email', async () => {
  delete process.env.PUBLIC_SUPABASE_URL;
  const r1 = await ensureHubAccount('a@b.com');
  assert.equal(r1.sent, false);

  process.env.PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
  const r2 = await ensureHubAccount('');
  assert.equal(r2.sent, false);
});

test('posts the OTP request with create_user and hub redirect', async () => {
  let captured;
  global.fetch = async (url, opts) => {
    captured = { url, opts };
    return { ok: true };
  };

  const r = await ensureHubAccount('patient@example.com');
  assert.equal(r.sent, true);
  assert.equal(
    captured.url,
    'https://proj.supabase.co/auth/v1/otp?redirect_to=' + encodeURIComponent('https://freeley.com/hub')
  );
  assert.equal(captured.opts.headers.apikey, 'anon-key');
  assert.deepEqual(JSON.parse(captured.opts.body), { email: 'patient@example.com', create_user: true });
});

test('surfaces the status and body on a non-ok response', async () => {
  global.fetch = async () => ({
    ok: false,
    status: 429,
    text: async () => 'rate limited'
  });

  const r = await ensureHubAccount('patient@example.com');
  assert.equal(r.sent, false);
  assert.match(r.reason, /^429 rate limited/);
});
