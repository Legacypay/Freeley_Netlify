// Unit tests for netlify/functions/patientCases.js — mocks mdi-client,
// verify-supabase-token, and @netlify/blobs.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const fnDir = path.join(__dirname, '..', '..', 'netlify', 'functions');
const libDir = path.join(fnDir, 'lib');

let calls = [];
let vouchersByEmail = {};
let orderStoreData = {};
let validToken = 'good-token';

const mockClient = {
  CORS_HEADERS: { 'Access-Control-Allow-Origin': 'https://freeley.com' },
  mdiRequest: async (method, url) => {
    calls.push({ method, url });
    const m = /\/v1\/partner\/vouchers\?email=([^&]+)/.exec(url);
    if (m) {
      const email = decodeURIComponent(m[1]);
      return { data: vouchersByEmail[email] || [] };
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

delete require.cache[require.resolve(path.join(fnDir, 'patientCases'))];
const { handler } = require(path.join(fnDir, 'patientCases'));

beforeEach(() => {
  calls = []; vouchersByEmail = {}; orderStoreData = {};
});

function post(body, token = validToken) {
  return handler({
    httpMethod: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body)
  });
}

test('resolves an owned case by voucher_id from the blob', async () => {
  orderStoreData['voucher-1'] = { patient_id: 'pat-1', case_id: 'case-1', email: 'patient@example.com' };

  const res = await post({ voucher_id: 'voucher-1' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.cases.length, 1);
  assert.equal(body.cases[0].patient_id, 'pat-1');
  assert.equal(calls.length, 0); // resolved from blob, never hit MDI
});

test('refuses a voucher_id/patient_id owned by a different email (IDOR guard)', async () => {
  orderStoreData['their-voucher'] = { patient_id: 'their-patient', case_id: 'their-case', email: 'someone-else@example.com' };

  const byVoucher = await post({ voucher_id: 'their-voucher' });
  const byPatientId = await post({ patient_id: 'their-patient' });

  for (const res of [byVoucher, byPatientId]) {
    const body = JSON.parse(res.body);
    assert.deepEqual(body.cases, []);
  }
});

test('a client-supplied email is ignored — MDI is always searched under the authenticated session email', async () => {
  vouchersByEmail['someone-else@example.com'] = [{ id: 'v-x', case_id: 'case-x', patient: { id: 'pat-x' } }];
  vouchersByEmail['patient@example.com'] = [{ id: 'v-1', case_id: 'case-1', patient: { id: 'pat-1', email: 'patient@example.com' } }];

  // Attacker tries to search someone else's cases by passing their email directly.
  const res = await post({ email: 'someone-else@example.com' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.cases.length, 1);
  assert.equal(body.cases[0].patient_id, 'pat-1'); // the AUTHENTICATED user's own case, not the requested email's
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes(encodeURIComponent('patient@example.com')));
  assert.ok(!calls[0].url.includes('someone-else'));
});

test('rejects requests with an invalid or missing Supabase token', async () => {
  const bad = await post({ patient_id: 'pat-1' }, 'nope');
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
