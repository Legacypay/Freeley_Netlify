const test = require('node:test');
const assert = require('node:assert/strict');

const { handler } = require('../../netlify/functions/importLeadNurture');

// Admin bulk-enrollment endpoint for the waitlist import. The only thing
// standing between it and the open internet is the x-admin-secret check, so
// these cover the refusal paths specifically — an accidentally-unset
// ADMIN_IMPORT_SECRET must never read as "no check configured, allow".
const post = (headers = {}, body = { emails: [] }) =>
  handler({ httpMethod: 'POST', headers, body: JSON.stringify(body) });

test.beforeEach(() => { delete process.env.ADMIN_IMPORT_SECRET; });
test.after(() => { delete process.env.ADMIN_IMPORT_SECRET; });

test('fails closed when ADMIN_IMPORT_SECRET is unset', async () => {
  assert.equal((await post({})).statusCode, 403);
  assert.equal((await post({ 'x-admin-secret': '' })).statusCode, 403);
  // Nothing to compare against must not become "anything matches".
  assert.equal((await post({ 'x-admin-secret': 'undefined' })).statusCode, 403);
  assert.equal((await post({ 'x-admin-secret': 'any-guess' })).statusCode, 403);
});

test('rejects a wrong secret, and a shorter/longer one, when it is set', async () => {
  process.env.ADMIN_IMPORT_SECRET = 'correct-horse-battery-staple';
  assert.equal((await post({ 'x-admin-secret': 'wrong' })).statusCode, 403);
  assert.equal((await post({ 'x-admin-secret': 'correct-horse-battery' })).statusCode, 403);
  assert.equal((await post({ 'x-admin-secret': 'correct-horse-battery-staple-extra' })).statusCode, 403);
  assert.equal((await post({})).statusCode, 403);
});

test('rejects non-POST before looking at anything else', async () => {
  process.env.ADMIN_IMPORT_SECRET = 's3cret';
  const res = await handler({ httpMethod: 'GET', headers: { 'x-admin-secret': 's3cret' } });
  assert.equal(res.statusCode, 405);
});

test('caps the batch size and rejects a non-array body', async () => {
  process.env.ADMIN_IMPORT_SECRET = 's3cret';
  const auth = { 'x-admin-secret': 's3cret' };

  const tooMany = await post(auth, { emails: Array(301).fill('a@example.com') });
  assert.equal(tooMany.statusCode, 400);
  assert.match(JSON.parse(tooMany.body).error, /batches of 300/);

  assert.equal((await post(auth, { emails: 'a@example.com' })).statusCode, 400);
  assert.equal((await post(auth, {})).statusCode, 400);
  assert.equal((await handler({ httpMethod: 'POST', headers: auth, body: 'not json' })).statusCode, 400);
});

test('counts invalid addresses without attempting to enroll them', async () => {
  process.env.ADMIN_IMPORT_SECRET = 's3cret';
  // No Blobs context in unit tests, so a real enrollment would throw and land
  // in `failed`; every address here is rejected before that, which is the
  // point — `skippedInvalid` proves the validation ran, `enrolled: 0` that
  // nothing slipped past it.
  const res = await post({ 'x-admin-secret': 's3cret' }, { emails: ['', 'nope', 'a@b', '@example.com', 'x'.repeat(300) + '@example.com'] });
  assert.equal(res.statusCode, 200);
  const counts = JSON.parse(res.body);
  assert.equal(counts.requested, 5);
  assert.equal(counts.skippedInvalid, 5);
  assert.equal(counts.enrolled, 0);
});
