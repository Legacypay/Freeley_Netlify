// Unit tests for netlify/functions/authnetWebhook.js — signature verification
// only (the part that's easy to get subtly wrong and hard to notice: wrong
// key encoding, wrong case, wrong prefix stripping all fail closed silently).
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const SIGNATURE_KEY = '56E529FE6C63D60E545F84686096E6AA01D5E18A119F18A130F7CFB3983104216979E95D84C91BDD382AA0875264A63940A2D0AA5548F6023B4C78A9D52C18DA';

let handler;
let originalEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
  process.env.AUTHNET_SIGNATURE_KEY = SIGNATURE_KEY;
  delete require.cache[require.resolve('../../netlify/functions/authnetWebhook.js')];
  handler = require('../../netlify/functions/authnetWebhook.js').handler;
});

afterEach(() => {
  process.env = originalEnv;
});

function signBody(body, key = SIGNATURE_KEY) {
  return crypto.createHmac('sha512', Buffer.from(key, 'hex')).update(body, 'utf8').digest('hex').toUpperCase();
}

test('accepts a correctly signed request', async () => {
  const body = JSON.stringify({ notificationId: 'n1', eventType: 'net.authorize.payment.refund.created', payload: { id: 'txn1', authAmount: '89.00' } });
  const res = await handler({
    httpMethod: 'POST',
    headers: { 'x-anet-signature': `sha512=${signBody(body)}` },
    body
  });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).received, true);
});

test('rejects a tampered body', async () => {
  const body = JSON.stringify({ notificationId: 'n1', eventType: 'net.authorize.payment.refund.created', payload: { id: 'txn1', authAmount: '89.00' } });
  const sig = signBody(body);
  const tamperedBody = body.replace('89.00', '9000.00'); // amount changed after signing
  const res = await handler({
    httpMethod: 'POST',
    headers: { 'x-anet-signature': `sha512=${sig}` },
    body: tamperedBody
  });
  assert.equal(res.statusCode, 401);
});

test('rejects a signature computed with the wrong key', async () => {
  const body = JSON.stringify({ notificationId: 'n1', eventType: 'net.authorize.payment.void.created', payload: { id: 'txn2' } });
  const wrongKeySig = signBody(body, 'AA'.repeat(64));
  const res = await handler({
    httpMethod: 'POST',
    headers: { 'x-anet-signature': `sha512=${wrongKeySig}` },
    body
  });
  assert.equal(res.statusCode, 401);
});

test('500s when AUTHNET_SIGNATURE_KEY is not configured', async () => {
  delete process.env.AUTHNET_SIGNATURE_KEY;
  delete require.cache[require.resolve('../../netlify/functions/authnetWebhook.js')];
  const unconfiguredHandler = require('../../netlify/functions/authnetWebhook.js').handler;
  const res = await unconfiguredHandler({ httpMethod: 'POST', headers: {}, body: '{}' });
  assert.equal(res.statusCode, 500);
});

test('rejects non-POST methods', async () => {
  const res = await handler({ httpMethod: 'GET', headers: {}, body: '' });
  assert.equal(res.statusCode, 405);
});
