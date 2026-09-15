const test = require('node:test');
const assert = require('node:assert/strict');

const realSecret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
process.env.EMAIL_UNSUBSCRIBE_SECRET = 'test-secret-do-not-use';
process.env.URL = 'https://freeley.com';

const { buildUnsubscribeUrl, verifyToken } = require('../../netlify/functions/lib/email/unsubscribe');

test('buildUnsubscribeUrl embeds the (normalized) email and a verifiable token', () => {
  const url = buildUnsubscribeUrl('Patient@Example.com');
  assert.match(url, /^https:\/\/freeley\.com\/\.netlify\/functions\/emailPreferences\?e=/);
  const params = new URL(url).searchParams;
  // Email is lowercased/trimmed at build time — verifyToken must accept the
  // original mixed-case address too (it normalizes on its own side).
  assert.equal(params.get('e'), 'patient@example.com');
  assert.equal(verifyToken('Patient@Example.com', params.get('t')), true);
});

test('verifyToken is case/whitespace-insensitive on the email, matching normalization at build time', () => {
  const url = buildUnsubscribeUrl('  Patient@Example.com  ');
  const token = new URL(url).searchParams.get('t');
  assert.equal(verifyToken('patient@example.com', token), true);
});

test('verifyToken rejects a tampered token', () => {
  const url = buildUnsubscribeUrl('a@b.com');
  const token = new URL(url).searchParams.get('t');
  assert.equal(verifyToken('a@b.com', token.slice(0, -1) + (token.slice(-1) === '0' ? '1' : '0')), false);
});

test('verifyToken rejects a token issued for a different email', () => {
  const tokenForA = new URL(buildUnsubscribeUrl('a@b.com')).searchParams.get('t');
  assert.equal(verifyToken('c@d.com', tokenForA), false);
});

test('verifyToken rejects missing email/token', () => {
  assert.equal(verifyToken('', 'sometoken'), false);
  assert.equal(verifyToken('a@b.com', ''), false);
});

test.after(() => {
  if (realSecret === undefined) delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
  else process.env.EMAIL_UNSUBSCRIBE_SECRET = realSecret;
});
