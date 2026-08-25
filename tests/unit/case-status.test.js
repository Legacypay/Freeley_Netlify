// Unit tests for netlify/functions/caseStatus.js — mocks mdi-client,
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
      if (caseDataByKey[key]) return caseDataByKey[key];
      const err = new Error('not found');
      err.statusCode = 404;
      throw err;
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

delete require.cache[require.resolve(path.join(fnDir, 'caseStatus'))];
const { handler } = require(path.join(fnDir, 'caseStatus'));

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

test('resolves an owned case by voucher_id and returns friendly status', async () => {
  orderStoreData['voucher-1'] = { patient_id: 'pat-1', case_id: 'case-1', email: 'patient@example.com' };
  caseDataByKey['pat-1::case-1'] = {
    case_status: { name: 'assigned', updated_at: '2026-08-20T00:00:00Z' },
    case_assignment: { clinician: { full_name: 'Dr. Smith', specialty: 'Family Medicine' } },
    case_offerings: [{ name: 'Semaglutide', status: 'pending' }]
  };

  const res = await post({ voucher_id: 'voucher-1' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.status, 'in_review');
  assert.equal(body.case_id, 'case-1');
  assert.equal(body.patient_id, 'pat-1');
  assert.equal(body.clinician.name, 'Dr. Smith');
  assert.equal(calls.length, 1);
});

test('refuses a case_id/patient_id/voucher_id owned by a different email (IDOR guard)', async () => {
  orderStoreData['their-voucher'] = {
    patient_id: 'their-patient',
    case_id: 'their-case',
    email: 'someone-else@example.com'
  };
  caseDataByKey['their-patient::their-case'] = {
    case_status: { name: 'completed' },
    case_assignment: { clinician: { full_name: 'Dr. Other' } }
  };

  const byVoucher = await post({ voucher_id: 'their-voucher' });
  const byPatientCase = await post({ patient_id: 'their-patient', case_id: 'their-case' });
  const byCaseIdOnly = await post({ case_id: 'their-case' });

  for (const res of [byVoucher, byPatientCase, byCaseIdOnly]) {
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'submitted');
    assert.equal(body.case_id, null);
    assert.equal(body.clinician, null);
  }
  // Never called MDI with the other patient's ids.
  assert.equal(calls.length, 0);
});

test('returns a pending status when the owned record has no case_id yet', async () => {
  orderStoreData['voucher-1'] = { patient_id: 'pat-1', email: 'patient@example.com', status: 'submitted' };

  const res = await post({ voucher_id: 'voucher-1' });
  const body = JSON.parse(res.body);
  assert.equal(body.status, 'submitted');
  assert.equal(body.case_id, null);
  assert.equal(body.patient_id, 'pat-1');
  assert.equal(calls.length, 0);
});

test('rejects requests with an invalid or missing Supabase token', async () => {
  const bad = await post({ patient_id: 'pat-1', case_id: 'case-1' }, 'nope');
  assert.equal(bad.statusCode, 401);

  const none = await handler({ httpMethod: 'POST', headers: {}, body: '{}' });
  assert.equal(none.statusCode, 401);

  assert.equal(calls.length, 0);
});

test('OPTIONS preflight returns 204 and non-POST returns 405', async () => {
  const preflight = await handler({ httpMethod: 'OPTIONS', headers: {}, body: null });
  assert.equal(preflight.statusCode, 204);

  const get = await handler({ httpMethod: 'GET', headers: {}, body: null });
  assert.equal(get.statusCode, 405);
});

process.on('exit', () => { Module._load = origLoad; });
