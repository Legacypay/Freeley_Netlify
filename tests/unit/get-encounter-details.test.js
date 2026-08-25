// Unit tests for netlify/functions/getEncounterDetails.js — mocks mdi-client,
// verify-supabase-token, and @netlify/blobs.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const fnDir = path.join(__dirname, '..', '..', 'netlify', 'functions');
const libDir = path.join(fnDir, 'lib');

let calls = [];
let caseDataByKey = {};
let orderStoreData = {};
let validToken = 'good-token';

const mockClient = {
  CORS_HEADERS: { 'Access-Control-Allow-Origin': 'https://freeley.com' },
  mdiRequest: async (method, url) => {
    calls.push({ method, url });
    const m = /\/v1\/patient\/patients\/([^/]+)\/cases\/([^/]+)/.exec(url);
    if (m) {
      const key = `${m[1]}::${m[2]}`;
      return caseDataByKey[key] || {};
    }
    throw new Error('unexpected ' + method + ' ' + url);
  }
};
const mockAuth = {
  verifySupabaseToken: async (token) =>
    token === validToken ? { uid: 'u1', email: 'patient@example.com' } : null
};
const mockBlobs = {
  getStore: () => ({
    get: async (k) => orderStoreData[k] ?? null,
    list: async () => ({ blobs: Object.keys(orderStoreData).map(key => ({ key })) })
  })
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@netlify/blobs') return mockBlobs;
  const fromFunctionDir = parent && parent.filename && parent.filename.startsWith(fnDir) && !parent.filename.startsWith(libDir);
  if (request === './lib/mdi-client' && fromFunctionDir) return mockClient;
  if (request === './lib/verify-supabase-token' && fromFunctionDir) return mockAuth;
  return origLoad.apply(this, arguments);
};

delete require.cache[require.resolve(path.join(fnDir, 'getEncounterDetails'))];
const { handler } = require(path.join(fnDir, 'getEncounterDetails'));

beforeEach(() => {
  calls = []; caseDataByKey = {}; orderStoreData = {};
});

function post(body, token = validToken) {
  return handler({
    httpMethod: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body)
  });
}

test('returns records for a case owned by the authenticated user', async () => {
  orderStoreData['voucher-1'] = { patient_id: 'pat-1', case_id: 'case-1', email: 'patient@example.com' };
  caseDataByKey['pat-1::case-1'] = {
    case_assignment: { clinician: { full_name: 'Dr. Smith' }, created_at: '2026-08-01T00:00:00Z' },
    case_offerings: [{ name: 'Semaglutide', status: 'pending' }]
  };

  const res = await post({ patient_id: 'pat-1', case_id: 'case-1' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok(body.records.length >= 2);
  assert.equal(calls.length, 1);
});

test('refuses a case_id owned by a different email (IDOR guard) without calling MDI', async () => {
  orderStoreData['their-voucher'] = { patient_id: 'their-patient', case_id: 'their-case', email: 'someone-else@example.com' };
  caseDataByKey['their-patient::their-case'] = {
    case_assignment: { clinician: { full_name: 'Dr. Other' } }
  };

  const res = await post({ patient_id: 'their-patient', case_id: 'their-case' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.deepEqual(body.records, []);
  assert.equal(calls.length, 0);
});

test('finds the owned record even when a same-case_id record owned by someone else is scanned first', async () => {
  // Regression test: the ownership scan must `continue` past a same-id match
  // owned by a different email, not stop at the first id match it sees.
  orderStoreData['a-their-voucher'] = { patient_id: 'their-patient', case_id: 'case-shared', email: 'someone-else@example.com' };
  orderStoreData['z-my-voucher'] = { patient_id: 'pat-1', case_id: 'case-shared', email: 'patient@example.com' };
  caseDataByKey['pat-1::case-shared'] = { case_offerings: [{ name: 'Semaglutide', status: 'pending' }] };

  const res = await post({ patient_id: 'pat-1', case_id: 'case-shared' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok(body.records.length >= 1);
  assert.equal(calls.length, 1);
});

test('refuses a case_id with no matching blob record at all', async () => {
  const res = await post({ case_id: 'never-seen' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body).records, []);
  assert.equal(calls.length, 0);
});

test('requires case_id', async () => {
  const res = await post({ patient_id: 'pat-1' });
  assert.equal(res.statusCode, 400);
});

test('rejects requests with an invalid or missing Supabase token', async () => {
  const bad = await post({ patient_id: 'pat-1', case_id: 'case-1' }, 'nope');
  assert.equal(bad.statusCode, 401);
  assert.equal(calls.length, 0);
});

test('OPTIONS preflight returns 204 and non-POST returns 405', async () => {
  const preflight = await handler({ httpMethod: 'OPTIONS', headers: {}, body: null });
  assert.equal(preflight.statusCode, 204);

  const get = await handler({ httpMethod: 'GET', headers: {}, body: null });
  assert.equal(get.statusCode, 405);
});

process.on('exit', () => { Module._load = origLoad; });
