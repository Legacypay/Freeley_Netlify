// Unit tests for netlify/functions/getOrders.js — mocks mdi-client,
// verify-supabase-token, and @netlify/blobs.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const fnDir = path.join(__dirname, '..', '..', 'netlify', 'functions');
const libDir = path.join(fnDir, 'lib');

let calls = [];
let ordersByPatient = {};
let failPatients = new Set();
let orderStoreData = {};
let validToken = 'good-token';

const mockClient = {
  CORS_HEADERS: { 'Access-Control-Allow-Origin': 'https://freeley.com' },
  mdiRequest: async (method, url, body) => {
    calls.push({ method, url, body });
    const m = /\/v1\/partner\/patients\/([^/]+)\/orders/.exec(url);
    if (m) {
      const patientId = m[1];
      if (failPatients.has(patientId)) throw new Error('MDI is down');
      return { data: ordersByPatient[patientId] || [] };
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

delete require.cache[require.resolve(path.join(fnDir, 'getOrders'))];
const { handler } = require(path.join(fnDir, 'getOrders'));

beforeEach(() => {
  calls = []; ordersByPatient = {}; failPatients = new Set(); orderStoreData = {};
});

function post(body, token = validToken) {
  return handler({
    httpMethod: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body)
  });
}

const SHIPPED_ORDER = {
  id: 'order-1',
  order_number: 'ON-1',
  status: 'fulfilled',
  payment_status: 'paid',
  total_amount: 49.99,
  case_id: 'case-1',
  tracking: { number: '431984', company: 'USPS', link: 'https://usps.example/431984', shipping_price: 1.99 },
  products: [{ name: 'Semaglutide', image_url: 'https://img.example/s.png', amount: 1, unit_price: 40 }],
  order_created_at: '2026-08-20T10:00:00Z',
  updated_at: '2026-08-21T10:00:00Z'
};

test('resolves patient_id from the blob by voucher_id and fetches live orders', async () => {
  orderStoreData['voucher-1'] = { patient_id: 'pat-1', case_id: 'case-1', email: 'patient@example.com' };
  ordersByPatient['pat-1'] = [SHIPPED_ORDER];

  const res = await post({ voucher_id: 'voucher-1' });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.startsWith('/v1/partner/patients/pat-1/orders'));

  const body = JSON.parse(res.body);
  assert.equal(body.has_orders, true);
  assert.equal(body.orders.length, 1);
  assert.equal(body.orders[0].order_id, 'order-1');
  assert.ok(body.last_updated);
});

test('falls back to the cached blob orders when the live MDI call throws', async () => {
  orderStoreData['voucher-1'] = {
    patient_id: 'pat-1',
    email: 'patient@example.com',
    orders: [{ ...SHIPPED_ORDER, id: 'cached-order', status: 'ready' }]
  };
  failPatients.add('pat-1');

  const res = await post({ voucher_id: 'voucher-1' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.has_orders, true);
  assert.equal(body.orders[0].order_id, 'cached-order');
  assert.equal(body.orders[0].status, 'ready');
  assert.equal(body.orders[0].title, 'Ready to Ship');
});

test('maps a known status, tracking and products into the patient-facing shape', async () => {
  orderStoreData['voucher-1'] = { patient_id: 'pat-1', email: 'patient@example.com' };
  ordersByPatient['pat-1'] = [SHIPPED_ORDER];

  const res = await post({ patient_id: 'pat-1' });
  const order = JSON.parse(res.body).orders[0];

  assert.equal(order.status, 'shipped');
  assert.equal(order.title, 'On Its Way');
  assert.equal(order.icon, '🚚');
  assert.equal(order.raw_status, 'fulfilled');
  assert.deepEqual(order.tracking, {
    number: '431984',
    company: 'USPS',
    link: 'https://usps.example/431984'
  });
  assert.equal('shipping_price' in order.tracking, false);
  assert.deepEqual(order.products, [
    { name: 'Semaglutide', image_url: 'https://img.example/s.png', amount: 1 }
  ]);
  assert.equal(order.payment_status, 'paid');
  assert.equal(order.total_amount, 49.99);
  assert.equal(order.case_id, 'case-1');
  assert.equal(order.ordered_at, '2026-08-20T10:00:00Z');
});

test('tracking is null (not an empty object) before MDI sets it', async () => {
  orderStoreData['voucher-1'] = { patient_id: 'pat-1', email: 'patient@example.com' };
  ordersByPatient['pat-1'] = [{ ...SHIPPED_ORDER, tracking: null }];

  const res = await post({ patient_id: 'pat-1' });
  assert.equal(JSON.parse(res.body).orders[0].tracking, null);
});

test('an unrecognised status falls back to Processing without mislabelling it', async () => {
  orderStoreData['voucher-1'] = { patient_id: 'pat-1', email: 'patient@example.com' };
  ordersByPatient['pat-1'] = [{ ...SHIPPED_ORDER, status: 'awaiting_pharmacy_review' }];

  const res = await post({ patient_id: 'pat-1' });
  const order = JSON.parse(res.body).orders[0];

  assert.equal(order.status, 'processing');
  assert.equal(order.title, 'Processing');
  assert.equal(order.raw_status, 'awaiting_pharmacy_review');
  // The raw status must be echoed so we never silently claim a specific step.
  assert.ok(order.message.includes('awaiting_pharmacy_review'));
  assert.equal(order.title.includes('On Its Way'), false);
  assert.equal(order.title.includes('Delivered'), false);
});

test('returns has_orders:false gracefully when no patient_id can be resolved', async () => {
  const res = await post({ voucher_id: 'never-seen' });
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.deepEqual(body.orders, []);
  assert.equal(body.has_orders, false);
  assert.ok(body.last_updated);
  assert.equal(calls.length, 0);
});

test('returns has_orders:false when the patient exists but has no orders yet', async () => {
  orderStoreData['voucher-1'] = { patient_id: 'pat-1', email: 'patient@example.com' };

  const res = await post({ voucher_id: 'voucher-1' });
  const body = JSON.parse(res.body);
  assert.equal(body.has_orders, false);
  assert.deepEqual(body.orders, []);
  // Confirms this genuinely reached MDI for pat-1 (empty orders), rather than
  // being refused by the ownership check for an unrelated reason.
  assert.equal(calls.length, 1);
});

test('refuses a patient_id/case_id/voucher_id that belongs to a different email (IDOR guard)', async () => {
  // Someone else's order record — owned by a different authenticated identity.
  orderStoreData['their-voucher'] = {
    patient_id: 'their-patient',
    case_id: 'their-case',
    email: 'someone-else@example.com',
    orders: [{ ...SHIPPED_ORDER, id: 'their-order' }]
  };
  ordersByPatient['their-patient'] = [SHIPPED_ORDER];

  // The authenticated caller (patient@example.com, per mockAuth) tries all three
  // identifier shapes that could be used to pivot into someone else's data.
  const byVoucher = await post({ voucher_id: 'their-voucher' });
  const byPatientId = await post({ patient_id: 'their-patient' });
  const byCaseId = await post({ case_id: 'their-case' });

  for (const res of [byVoucher, byPatientId, byCaseId]) {
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.has_orders, false);
    assert.deepEqual(body.orders, []);
  }
  // Never reached MDI on the other patient's behalf, and never returned their cached orders.
  assert.equal(calls.length, 0);
});

test('rejects requests with an invalid or missing Supabase token', async () => {
  const bad = await post({ patient_id: 'pat-1' }, 'nope');
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
