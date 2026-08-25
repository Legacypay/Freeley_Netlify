// Unit tests for the order/shipment event handling added to
// netlify/functions/mdiWebhook.js — mocks mdi-client, mdi-tags, @netlify/blobs
// and global.fetch (used for the N8N email/notification dispatch).
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const fnDir = path.join(__dirname, '..', '..', 'netlify', 'functions');
const libDir = path.join(fnDir, 'lib');

let store;
let mdiCalls = [];
let ordersByPatient = {};
let fetchCalls = [];
let origFetch;

// Minimal in-memory blob store with real etag semantics, so
// updateOrderStatus's optimistic-concurrency (onlyIfMatch) path is exercised
// the same way the real @netlify/blobs client behaves.
function makeStore() {
  const data = {};
  const etags = {};
  let counter = 0;
  return {
    _data: data,
    async get(key) { return key in data ? data[key] : null; },
    async getWithMetadata(key) {
      if (!(key in data)) return null;
      return { data: data[key], etag: etags[key] };
    },
    async setJSON(key, value, opts) {
      const expected = opts && opts.onlyIfMatch;
      if (expected !== undefined && etags[key] !== expected) {
        return { modified: false };
      }
      data[key] = value;
      counter += 1;
      etags[key] = 'etag-' + counter;
      return { modified: true };
    },
    async list() { return { blobs: Object.keys(data).map(key => ({ key })) }; }
  };
}

const mockClient = {
  verifyWebhookSignature: () => true,
  mdiRequest: async (method, url) => {
    mdiCalls.push({ method, url });
    const m = /\/v1\/partner\/patients\/([^/]+)\/orders/.exec(url);
    if (m) return { data: ordersByPatient[m[1]] || [] };
    throw new Error('unexpected ' + method + ' ' + url);
  }
};
const mockTags = { tagTestCase: async () => {} };
const mockBlobs = { getStore: () => store };

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@netlify/blobs') return mockBlobs;
  const fromFunctionDir = parent && parent.filename && parent.filename.startsWith(fnDir) && !parent.filename.startsWith(libDir);
  if (request === './lib/mdi-client' && fromFunctionDir) return mockClient;
  if (request === './lib/mdi-tags' && fromFunctionDir) return mockTags;
  return origLoad.apply(this, arguments);
};

delete require.cache[require.resolve(path.join(fnDir, 'mdiWebhook'))];
const { handler } = require(path.join(fnDir, 'mdiWebhook'));

beforeEach(() => {
  store = makeStore();
  mdiCalls = [];
  ordersByPatient = {};
  fetchCalls = [];
  origFetch = global.fetch;
  global.fetch = async (url, opts) => {
    fetchCalls.push({ url, body: opts && opts.body ? JSON.parse(opts.body) : null });
    return { ok: true };
  };
  process.env.N8N_WEBHOOK_URL = 'https://n8n.example/webhook';
});

function fireWebhook(payload) {
  return handler({
    httpMethod: 'POST',
    headers: { signature: 'ok' },
    body: JSON.stringify(payload)
  });
}

async function seedOrder(voucherId, record) {
  await store.setJSON(voucherId, record);
}

test('order_status_changed updates status/history and refreshes the cached order list', async () => {
  await seedOrder('voucher-1', { voucher_id: 'voucher-1', patient_id: 'pat-1', case_id: 'case-1', email: 'p@example.com' });
  ordersByPatient['pat-1'] = [{ id: 'order-1', status: 'ready' }];

  const res = await fireWebhook({ event_type: 'order_status_changed', case_id: 'case-1', order_status: 'ready' });
  assert.equal(res.statusCode, 200);

  const final = store._data['voucher-1'];
  assert.equal(final.status, 'ready');
  assert.equal(final.status_history.length, 1);
  assert.equal(final.orders.length, 1);
  assert.equal(final._voucher_id, undefined); // internal lookup key must never be persisted
});

test('a write conflict on the first attempt is retried and no status_history entry is lost', async () => {
  await seedOrder('voucher-1', { voucher_id: 'voucher-1', patient_id: 'pat-1', case_id: 'case-1', email: 'p@example.com' });

  let setJSONCalls = 0;
  const realSetJSON = store.setJSON.bind(store);
  store.setJSON = async (key, value, opts) => {
    setJSONCalls += 1;
    // Simulate a concurrent webhook winning the race on the first attempt.
    if (setJSONCalls === 1) return { modified: false };
    return realSetJSON(key, value, opts);
  };

  const res = await fireWebhook({ event_type: 'order_status_changed', case_id: 'case-1', order_status: 'processing' });
  assert.equal(res.statusCode, 200);
  assert.equal(setJSONCalls, 2); // one conflict, one successful retry — not silently dropped

  const final = store._data['voucher-1'];
  assert.equal(final.status, 'processing');
  assert.equal(final.status_history.length, 1);
});

test('order_tracking_number_changed emails the patient once, then skips duplicate redeliveries', async () => {
  await seedOrder('voucher-1', { voucher_id: 'voucher-1', patient_id: 'pat-1', case_id: 'case-1', email: 'p@example.com', first_name: 'Ana' });

  const first = await fireWebhook({ event_type: 'order_tracking_number_changed', case_id: 'case-1', order_status: 'fulfilled' });
  assert.equal(first.statusCode, 200);

  const emailCallsAfterFirst = fetchCalls.filter(c => c.body && c.body.email_action === 'order_shipped');
  assert.equal(emailCallsAfterFirst.length, 1);
  assert.ok(store._data['voucher-1'].order_shipped_email_sent_at);

  // MDI redelivers the same webhook (happens in practice).
  const second = await fireWebhook({ event_type: 'order_tracking_number_changed', case_id: 'case-1', order_status: 'fulfilled' });
  assert.equal(second.statusCode, 200);

  const emailCallsAfterSecond = fetchCalls.filter(c => c.body && c.body.email_action === 'order_shipped');
  assert.equal(emailCallsAfterSecond.length, 1); // still just one — no duplicate
});

test('order events for an unknown voucher/case do not crash the webhook', async () => {
  const res = await fireWebhook({ event_type: 'case_order_created', case_id: 'never-seen', order_status: 'received' });
  assert.equal(res.statusCode, 200);
});

process.on('exit', () => {
  Module._load = origLoad;
  global.fetch = origFetch;
});
