// Unit tests for netlify/functions/processEmailQueue.js — mocks
// @netlify/blobs (in-memory store) and global.fetch (Resend's HTTP API),
// same pattern as email-engine.test.js / mdi-webhook-order-events.test.js.
const test = require('node:test');
const { beforeEach, afterEach } = test;
const assert = require('node:assert/strict');
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

delete require.cache[require.resolve(path.join(fnDir, 'processEmailQueue'))];
const { handler } = require(path.join(fnDir, 'processEmailQueue'));
const { emailHash } = require(path.join(fnDir, 'lib', 'email', 'engine'));

let fetchCalls;
let origFetch;
let origEnv;

function queueKey(dueDate) {
  return `queue/${dueDate.toISOString()}__${Math.random().toString(36).slice(2)}`;
}

function seedJourney(email, journeyName, status, enrollmentId) {
  store._data[`journeys/${emailHash(email)}/${journeyName}`] = { status, enrollment_id: enrollmentId, enrolled_at: new Date().toISOString() };
}

beforeEach(() => {
  store = makeStore();
  fetchCalls = [];
  origEnv = { ...process.env };
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.RESEND_FROM_EMAIL = 'Freeley <no-reply@freeley.com>';
  process.env.CONTEXT = 'production';
  process.env.URL = 'https://freeley.com';
  delete process.env.EMAIL_DRY_RUN;

  origFetch = global.fetch;
  global.fetch = async (url, opts) => {
    fetchCalls.push({ url, body: JSON.parse(opts.body) });
    return { ok: true, text: async () => JSON.stringify({ id: 'resend-id-' + fetchCalls.length }) };
  };
});

afterEach(() => {
  global.fetch = origFetch;
  process.env = origEnv;
});

function invoke(query) {
  return handler({ httpMethod: 'GET', queryStringParameters: query || null });
}

test('sends a due, active journey step and removes it from the queue', async () => {
  seedJourney('lead@example.com', 'winback', 'active', 'enr-1');
  const dueKey = queueKey(new Date(Date.now() - 60000));
  store._data[dueKey] = {
    to: 'lead@example.com', template: 'winback-1', data: { firstName: 'Jane' },
    journey: 'winback', enrollment_id: 'enr-1', step: 0, kind: 'marketing',
    dedupe_key: 'winback:enr-1:0'
  };

  const res = await invoke();
  const body = JSON.parse(res.body);
  assert.equal(body.sent, 1);
  assert.equal(fetchCalls.length, 1);
  assert.equal(store._data[dueKey], undefined, 'processed item must be removed from the queue');
});

test('leaves a not-yet-due item in the queue untouched', async () => {
  seedJourney('lead@example.com', 'winback', 'active', 'enr-1');
  const futureKey = queueKey(new Date(Date.now() + 60 * 60 * 1000));
  store._data[futureKey] = {
    to: 'lead@example.com', template: 'winback-1', data: {},
    journey: 'winback', enrollment_id: 'enr-1', step: 0, kind: 'marketing',
    dedupe_key: 'winback:enr-1:0'
  };

  const res = await invoke();
  const body = JSON.parse(res.body);
  assert.equal(body.processed, 0);
  assert.equal(fetchCalls.length, 0);
  assert.ok(store._data[futureKey], 'a not-due item must not be removed');
});

test('skips and deletes a step whose journey was cancelled after being queued', async () => {
  seedJourney('lead@example.com', 'winback', 'cancelled', 'enr-1');
  const dueKey = queueKey(new Date(Date.now() - 60000));
  store._data[dueKey] = {
    to: 'lead@example.com', template: 'winback-1', data: {},
    journey: 'winback', enrollment_id: 'enr-1', step: 0, kind: 'marketing',
    dedupe_key: 'winback:enr-1:0'
  };

  const res = await invoke();
  const body = JSON.parse(res.body);
  assert.equal(body.skipped, 1);
  assert.equal(fetchCalls.length, 0);
  assert.equal(store._data[dueKey], undefined);
});

test('skips and deletes a step from a superseded (re-enrolled) journey', async () => {
  // Journey is active again, but under a DIFFERENT enrollment — the queued
  // step belongs to a stale, earlier enrollment and must not fire.
  seedJourney('lead@example.com', 'winback', 'active', 'enr-2');
  const dueKey = queueKey(new Date(Date.now() - 60000));
  store._data[dueKey] = {
    to: 'lead@example.com', template: 'winback-1', data: {},
    journey: 'winback', enrollment_id: 'enr-1', step: 0, kind: 'marketing',
    dedupe_key: 'winback:enr-1:0'
  };

  const res = await invoke();
  const body = JSON.parse(res.body);
  assert.equal(body.skipped, 1);
  assert.equal(fetchCalls.length, 0);
});

test('dry run sends nothing and leaves the queue intact', async () => {
  seedJourney('lead@example.com', 'winback', 'active', 'enr-1');
  const dueKey = queueKey(new Date(Date.now() - 60000));
  store._data[dueKey] = {
    to: 'lead@example.com', template: 'winback-1', data: {},
    journey: 'winback', enrollment_id: 'enr-1', step: 0, kind: 'marketing',
    dedupe_key: 'winback:enr-1:0'
  };

  const res = await invoke({ dry: '1' });
  const body = JSON.parse(res.body);
  assert.equal(body.dry_run, true);
  assert.equal(fetchCalls.length, 0);
  assert.ok(store._data[dueKey], 'dry run must not remove queue items');
});

test('an empty queue is a fast no-op', async () => {
  const res = await invoke();
  const body = JSON.parse(res.body);
  assert.equal(body.processed, 0);
  assert.equal(body.message, 'Queue empty');
});
