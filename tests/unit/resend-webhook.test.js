// Unit tests for netlify/functions/resendWebhook.js — Svix signature
// verification and bounced/complained/suppressed → suppression list wiring.
// Mocks @netlify/blobs the same way email-engine.test.js does.
const test = require('node:test');
const { beforeEach, afterEach } = test;
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('path');
const Module = require('module');

const fnDir = path.join(__dirname, '..', '..', 'netlify', 'functions');

function makeStore() {
  const data = {};
  return {
    _data: data,
    async get(key) { return key in data ? data[key] : null; },
    async setJSON(key, value) { data[key] = value; },
    async delete(key) { delete data[key]; },
    async list() { return { blobs: Object.keys(data).map(key => ({ key })) }; }
  };
}

let store;
const mockBlobs = { getStore: () => store, getDeployStore: () => store };

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@netlify/blobs') return mockBlobs;
  return origLoad.apply(this, arguments);
};

delete require.cache[require.resolve(path.join(fnDir, 'resendWebhook'))];
const { handler } = require(path.join(fnDir, 'resendWebhook'));
const { emailHash } = require(path.join(fnDir, 'lib', 'email', 'engine'));

const SECRET = 'whsec_' + Buffer.from('test-signing-secret-bytes-000001').toString('base64');
let origEnv;

beforeEach(() => {
  store = makeStore();
  origEnv = { ...process.env };
  process.env.RESEND_WEBHOOK_SECRET = SECRET;
});

afterEach(() => {
  process.env = origEnv;
});

function sign(body, { id = 'msg_1', timestamp = String(Math.floor(Date.now() / 1000)), secret = SECRET } = {}) {
  const secretBytes = Buffer.from(secret.slice(6), 'base64');
  const sig = crypto.createHmac('sha256', secretBytes).update(`${id}.${timestamp}.${body}`, 'utf8').digest('base64');
  return { id, timestamp, signature: `v1,${sig}` };
}

function fire(payload, opts) {
  const body = JSON.stringify(payload);
  const { id, timestamp, signature } = sign(body, opts);
  return handler({
    httpMethod: 'POST',
    headers: { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': signature },
    body
  });
}

test('rejects a request with no signature headers', async () => {
  const res = await handler({ httpMethod: 'POST', headers: {}, body: '{}' });
  assert.equal(res.statusCode, 401);
});

test('rejects a tampered body (signature computed for different content)', async () => {
  const body = JSON.stringify({ type: 'email.bounced', data: { to: ['a@b.com'] } });
  const { id, timestamp, signature } = sign(body);
  const res = await handler({
    httpMethod: 'POST',
    headers: { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': signature },
    body: body.replace('a@b.com', 'evil@b.com')
  });
  assert.equal(res.statusCode, 401);
});

test('rejects a signature made with the wrong secret', async () => {
  const res = await fire({ type: 'email.bounced', data: { to: ['a@b.com'] } }, { secret: 'whsec_' + Buffer.from('wrong-secret-bytes-0000000000000').toString('base64') });
  assert.equal(res.statusCode, 401);
});

test('500s when RESEND_WEBHOOK_SECRET is not configured', async () => {
  delete process.env.RESEND_WEBHOOK_SECRET;
  const res = await handler({ httpMethod: 'POST', headers: {}, body: '{}' });
  assert.equal(res.statusCode, 500);
});

test('rejects non-POST methods', async () => {
  const res = await handler({ httpMethod: 'GET', headers: {}, body: '' });
  assert.equal(res.statusCode, 405);
});

test('email.bounced suppresses the recipient', async () => {
  const res = await fire({ type: 'email.bounced', data: { to: ['patient@example.com'] } });
  assert.equal(res.statusCode, 200);
  const rec = store._data['suppression/' + emailHash('patient@example.com')];
  assert.equal(rec.reason, 'bounced');
});

test('email.complained suppresses the recipient with reason "complained"', async () => {
  await fire({ type: 'email.complained', data: { to: ['patient@example.com'] } });
  const rec = store._data['suppression/' + emailHash('patient@example.com')];
  assert.equal(rec.reason, 'complained');
});

test('email.suppressed mirrors Resend\'s own suppression locally', async () => {
  await fire({ type: 'email.suppressed', data: { to: ['ghost@example.com'] } });
  const rec = store._data['suppression/' + emailHash('ghost@example.com')];
  assert.equal(rec.reason, 'bounced');
});

test('an unhandled event type is acknowledged without error', async () => {
  const res = await fire({ type: 'email.delivered', data: { to: ['patient@example.com'] } });
  assert.equal(res.statusCode, 200);
  assert.equal(store._data['suppression/' + emailHash('patient@example.com')], undefined);
});
