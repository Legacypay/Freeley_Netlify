// Unit tests for netlify/functions/checkAdditionalApprovals.js — mocks mdi-client,
// @netlify/blobs, and global fetch.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const fnDir = path.join(__dirname, '..', '..', 'netlify', 'functions');
const libDir = path.join(fnDir, 'lib');

let calls = [];
let casesByStatus = {};
let alertStoreData = {};
let fetchCalls = [];
let failStatuses = new Set();

const mockClient = {
  mdiRequest: async (method, url, body) => {
    calls.push({ method, url, body });
    const m = /\/v1\/partner\/cases\/status\/([^/?]+)/.exec(url);
    if (m) {
      const status = decodeURIComponent(m[1]);
      if (failStatuses.has(status)) throw new Error('boom');
      return { data: casesByStatus[status] || [] };
    }
    throw new Error('unexpected ' + method + ' ' + url);
  }
};
const mockBlobs = {
  getStore: () => ({
    get: async (k) => alertStoreData[k] ?? null,
    set: async (k, v) => { alertStoreData[k] = v; }
  })
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@netlify/blobs') return mockBlobs;
  if (request === './lib/mdi-client' && parent && parent.filename && parent.filename.startsWith(fnDir) && !parent.filename.startsWith(libDir)) return mockClient;
  return origLoad.apply(this, arguments);
};

const origFetch = global.fetch;
global.fetch = async (url, opts) => {
  fetchCalls.push({ url, body: opts && opts.body ? JSON.parse(opts.body) : null });
  return { ok: true };
};

delete require.cache[require.resolve(path.join(fnDir, 'checkAdditionalApprovals'))];
const { handler } = require(path.join(fnDir, 'checkAdditionalApprovals'));

beforeEach(() => {
  calls = []; casesByStatus = {}; alertStoreData = {}; fetchCalls = []; failStatuses = new Set();
  delete process.env.MDI_APPROVAL_CHECK_STATUSES;
  delete process.env.N8N_WEBHOOK_URL;
});

test('defaults to checking Assigned and Waiting', async () => {
  await handler();
  const statuses = calls.map(c => decodeURIComponent(c.url.split('/').pop()));
  assert.deepEqual(statuses, ['Assigned', 'Waiting']);
  assert.deepEqual(calls[0].body, { is_additional_approval_needed: true, sort: 'desc' });
});

test('MDI_APPROVAL_CHECK_STATUSES overrides the default list', async () => {
  process.env.MDI_APPROVAL_CHECK_STATUSES = 'Processing, Support ,Waiting';
  await handler();
  const statuses = calls.map(c => decodeURIComponent(c.url.split('/').pop()));
  assert.deepEqual(statuses, ['Processing', 'Support', 'Waiting']);
});

test('alerts once per case_id, no patient PHI in the payload', async () => {
  process.env.N8N_WEBHOOK_URL = 'https://n8n.example.com/hook';
  casesByStatus.Assigned = [{ case_id: 'case-1' }, { case_id: 'case-2' }];
  const res = await handler();
  const body = JSON.parse(res.body);
  assert.equal(body.found, 2);
  assert.deepEqual(body.newly_alerted.sort(), ['case-1', 'case-2']);
  assert.equal(fetchCalls.length, 2);
  for (const call of fetchCalls) {
    assert.equal(call.body.event_type, 'mdi_case_needs_approval');
    assert.ok(call.body.case_id);
    assert.equal('patient_email' in call.body, false);
    assert.equal('email' in call.body, false);
  }

  // Second run: already alerted, no new fetch calls.
  fetchCalls = [];
  const res2 = await handler();
  assert.equal(JSON.parse(res2.body).newly_alerted.length, 0);
  assert.equal(fetchCalls.length, 0);
});

test('a status query failure is reported but does not stop the others', async () => {
  casesByStatus.Waiting = [{ case_id: 'case-9' }];
  process.env.MDI_APPROVAL_CHECK_STATUSES = 'Cancelled,Waiting';
  failStatuses.add('Cancelled');

  const res = await handler();
  const body = JSON.parse(res.body);
  assert.equal(body.errors.length, 1);
  assert.ok(body.errors[0].startsWith('Cancelled:'));
  assert.equal(body.found, 1);
});

process.on('exit', () => { Module._load = origLoad; global.fetch = origFetch; });
