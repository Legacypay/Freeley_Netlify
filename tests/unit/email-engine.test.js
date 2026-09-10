// Unit tests for lib/email/engine.js — mocks @netlify/blobs (in-memory store,
// same Module._load interception pattern as mdi-webhook-order-events.test.js)
// and global.fetch (Resend's HTTP API).
const test = require('node:test');
const { beforeEach, afterEach } = test;
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

function makeStore() {
  const data = {};
  return {
    _data: data,
    async get(key) { return key in data ? data[key] : null; },
    async setJSON(key, value) { data[key] = value; },
    async delete(key) { delete data[key]; },
    async list(opts) {
      const prefix = (opts && opts.prefix) || '';
      return { blobs: Object.keys(data).filter(k => k.startsWith(prefix)).map(key => ({ key })) };
    }
  };
}

let store;
const mockBlobs = { getStore: () => store, getDeployStore: () => store };

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@netlify/blobs') return mockBlobs;
  return origLoad.apply(this, arguments);
};

delete require.cache[require.resolve('../../netlify/functions/lib/email/engine')];
const engine = require('../../netlify/functions/lib/email/engine');

let fetchCalls;
let origFetch;
let origEnv;

beforeEach(() => {
  store = makeStore();
  fetchCalls = [];
  origEnv = { ...process.env };
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.RESEND_FROM_EMAIL = 'Freeley <no-reply@freeley.com>';
  process.env.CONTEXT = 'production';
  process.env.URL = 'https://freeley.com';
  delete process.env.EMAIL_DRY_RUN;
  delete process.env.MDI_TEST_EMAIL_PATTERNS;

  origFetch = global.fetch;
  global.fetch = async (url, opts) => {
    fetchCalls.push({ url, opts, body: JSON.parse(opts.body) });
    return { ok: true, text: async () => JSON.stringify({ id: 'resend-id-' + fetchCalls.length }) };
  };
});

afterEach(() => {
  global.fetch = origFetch;
  process.env = origEnv;
});

test('sendTransactional sends once and dedupes a repeated call with the same dedupeKey', async () => {
  const r1 = await engine.sendTransactional({ template: 'case-completed', to: 'patient@example.com', data: { firstName: 'Jane' }, dedupeKey: 'completed:case-1' });
  assert.equal(r1.sent, true);
  assert.equal(fetchCalls.length, 1);

  const r2 = await engine.sendTransactional({ template: 'case-completed', to: 'patient@example.com', data: { firstName: 'Jane' }, dedupeKey: 'completed:case-1' });
  assert.equal(r2.sent, false);
  assert.equal(r2.reason, 'duplicate');
  assert.equal(fetchCalls.length, 1, 'a second call with the same dedupeKey must not hit Resend again');
});

test('missing to/template/dedupeKey refuses without touching the network', async () => {
  const r = await engine.sendTransactional({ template: 'case-completed', to: '', data: {}, dedupeKey: 'x' });
  assert.equal(r.sent, false);
  assert.equal(r.reason, 'missing-args');
  assert.equal(fetchCalls.length, 0);
});

test('unknown template is refused', async () => {
  const r = await engine.sendTransactional({ template: 'does-not-exist', to: 'a@b.com', dedupeKey: 'x' });
  assert.equal(r.sent, false);
  assert.equal(r.reason, 'unknown-template');
});

test('outside production, an address matching MDI_TEST_EMAIL_PATTERNS actually sends', async () => {
  process.env.CONTEXT = 'deploy-preview';
  process.env.MDI_TEST_EMAIL_PATTERNS = '@freeley.com,+test@';
  const r = await engine.sendTransactional({ template: 'case-completed', to: 'ops+test@example.com', dedupeKey: 'x' });
  assert.equal(r.sent, true);
  assert.equal(fetchCalls.length, 1);
});

test('outside production, a non-test address is a dry run — no network call, but still deduped', async () => {
  process.env.CONTEXT = 'deploy-preview';
  process.env.MDI_TEST_EMAIL_PATTERNS = '@freeley.com';
  const r1 = await engine.sendTransactional({ template: 'case-completed', to: 'realpatient@gmail.com', dedupeKey: 'x' });
  assert.equal(r1.sent, false);
  assert.equal(r1.reason, 'dry-run');
  assert.equal(fetchCalls.length, 0);

  const r2 = await engine.sendTransactional({ template: 'case-completed', to: 'realpatient@gmail.com', dedupeKey: 'x' });
  assert.equal(r2.reason, 'duplicate');
});

test('EMAIL_DRY_RUN=true suppresses sending even in production', async () => {
  process.env.EMAIL_DRY_RUN = 'true';
  const r = await engine.sendTransactional({ template: 'case-completed', to: 'patient@example.com', dedupeKey: 'x' });
  assert.equal(r.reason, 'dry-run');
  assert.equal(fetchCalls.length, 0);
});

test('a marketing unsubscribe blocks marketing sends but not transactional ones', async () => {
  await engine.suppress('unsub@example.com', 'unsubscribed');

  const marketing = await engine.sendTransactional({ template: 'onboarding-1', to: 'unsub@example.com', data: { firstName: 'Jane' }, dedupeKey: 'm1', kind: 'marketing' });
  assert.equal(marketing.sent, false);
  assert.equal(marketing.reason, 'suppressed');

  const transactional = await engine.sendTransactional({ template: 'case-completed', to: 'unsub@example.com', dedupeKey: 't1', kind: 'transactional' });
  assert.equal(transactional.sent, true);
});

test('a bounce blocks both marketing and transactional sends', async () => {
  await engine.suppress('bounced@example.com', 'bounced');

  const marketing = await engine.sendTransactional({ template: 'onboarding-1', to: 'bounced@example.com', data: {}, dedupeKey: 'm2', kind: 'marketing' });
  assert.equal(marketing.reason, 'suppressed');

  const transactional = await engine.sendTransactional({ template: 'case-completed', to: 'bounced@example.com', dedupeKey: 't2', kind: 'transactional' });
  assert.equal(transactional.reason, 'suppressed');
});

test('enrollJourney schedules one queue item per step and is a no-op on re-enroll without force', async () => {
  const r1 = await engine.enrollJourney('winback', { email: 'lead@example.com', data: { firstName: 'Jane' } });
  assert.equal(r1.enrolled, true);
  const { blobs } = await store.list({ prefix: 'queue/' });
  assert.equal(blobs.length, 2); // winback has 2 steps

  const r2 = await engine.enrollJourney('winback', { email: 'lead@example.com', data: {} });
  assert.equal(r2.enrolled, false);
  assert.equal(r2.reason, 'already-active');
  const { blobs: stillTwo } = await store.list({ prefix: 'queue/' });
  assert.equal(stillTwo.length, 2, 're-enrolling without force must not schedule duplicate steps');
});

test('cancelJourney flips status and getJourneyStatus reflects it', async () => {
  await engine.enrollJourney('quiz-abandoned', { email: 'lead2@example.com', data: {} });
  const before = await engine.getJourneyStatus('quiz-abandoned', 'lead2@example.com');
  assert.equal(before.status, 'active');

  const result = await engine.cancelJourney('quiz-abandoned', 'lead2@example.com');
  assert.equal(result.cancelled, true);

  const after = await engine.getJourneyStatus('quiz-abandoned', 'lead2@example.com');
  assert.equal(after.status, 'cancelled');
});

test('cancelJourney on a never-enrolled journey is a no-op', async () => {
  const result = await engine.cancelJourney('winback', 'never-enrolled@example.com');
  assert.equal(result.cancelled, false);
  assert.equal(result.reason, 'not-active');
});

test('enrollJourney refuses a suppressed address', async () => {
  await engine.suppress('optout@example.com', 'unsubscribed');
  const result = await engine.enrollJourney('winback', { email: 'optout@example.com', data: {} });
  assert.equal(result.enrolled, false);
  assert.equal(result.reason, 'suppressed');
});

test('recordSubscription / getSubscription round-trip', async () => {
  await engine.recordSubscription('sub-123', { email: 'jane@example.com', firstName: 'Jane', planMonths: 3 });
  const sub = await engine.getSubscription('sub-123');
  assert.equal(sub.email, 'jane@example.com');
  assert.equal(sub.first_name, 'Jane');
  assert.equal(sub.plan_months, 3);
});

test('getSubscription returns null for an unknown id', async () => {
  assert.equal(await engine.getSubscription('nope'), null);
});
