// Unit tests for netlify/functions/lib/mdi-tags.js — mocks mdi-client and @netlify/blobs.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const libDir = path.join(__dirname, '..', '..', 'netlify', 'functions', 'lib');

// ── Mocks ─────────────────────────────────────────────────────
const calls = [];
let tagsList = [];
let blobData = {};      // store 'mdi-config'
let orders = {};        // store 'mdi-orders'
let vouchers = {};      // GET /v1/partner/vouchers/:id responses
let createTagError = null;
const mockClient = {
  mdiRequest: async (method, url, body) => {
    calls.push({ method, url, body });
    if (method === 'GET' && url.startsWith('/v1/partner/tags')) {
      const page = Number(/page=(\d+)/.exec(url)[1]);
      const per = Number(/per_page=(\d+)/.exec(url)[1]);
      return { data: tagsList.slice((page - 1) * per, page * per) };
    }
    if (method === 'POST' && url === '/v1/partner/tags') {
      if (createTagError) throw createTagError;
      return { tag_id: 'tag-new', key: body.key };
    }
    if (method === 'POST' && /\/v1\/partner\/cases\/.+\/tags\/.+/.test(url)) return { ok: true };
    if (method === 'GET' && url.startsWith('/v1/partner/vouchers/')) return vouchers[decodeURIComponent(url.split('/').pop())] || {};
    throw new Error('unexpected ' + method + ' ' + url);
  }
};
const mockBlobs = {
  getStore: (name) => {
    const data = name === 'mdi-orders' ? orders : blobData;
    return {
      get: async (k) => data[k] ?? null,
      setJSON: async (k, v) => { data[k] = v; },
      list: async () => ({ blobs: Object.keys(data).map(key => ({ key })) })
    };
  }
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@netlify/blobs') return mockBlobs;
  if (request === './mdi-client' && parent && parent.filename && parent.filename.startsWith(libDir)) return mockClient;
  return origLoad.apply(this, arguments);
};

const tags = require(path.join(libDir, 'mdi-tags'));

beforeEach(() => { calls.length = 0; tagsList = []; blobData = {}; orders = {}; vouchers = {}; createTagError = null; tags._resetCache(); });

test('creates the tag when missing, caches it, and attaches it to the case', async () => {
  await tags.tagTestCase('case-1', 'note');
  const methods = calls.map(c => c.method + ' ' + c.url);
  assert.deepEqual(methods, [
    'GET /v1/partner/tags?type=global&page=1&per_page=100',
    'POST /v1/partner/tags',
    'POST /v1/partner/cases/case-1/tags/tag-new'
  ]);
  assert.equal(calls[1].body.key, 'test-case');
  assert.equal(calls[2].body.notes, 'note');
  assert.equal(blobData['test-case-tag-id'].tag_id, 'tag-new');

  // second call: no GET/POST tag lookups at all (memory cache)
  await tags.tagTestCase('case-2');
  assert.equal(calls.filter(c => c.url === '/v1/partner/tags').length, 1);
  assert.equal(calls.filter(c => c.url.startsWith('/v1/partner/tags?')).length, 1);
});

test('reuses an existing global tag instead of creating a duplicate', async () => {
  tagsList = [{ tag_id: 'tag-existing', key: 'test-case', name: 'Test Case' }];
  const id = await tags.ensureTestCaseTag();
  assert.equal(id, 'tag-existing');
  assert.equal(calls.some(c => c.method === 'POST' && c.url === '/v1/partner/tags'), false);
});

test('uses the blob-cached tag id without calling MDI', async () => {
  blobData['test-case-tag-id'] = { tag_id: 'tag-cached' };
  const id = await tags.ensureTestCaseTag();
  assert.equal(id, 'tag-cached');
  assert.equal(calls.length, 0);
});

test('tagTestCase requires a case id', async () => {
  await assert.rejects(() => tags.tagTestCase(null), /caseId/);
});

test('paginates past 100 global tags to find the existing one', async () => {
  tagsList = Array.from({ length: 150 }, (_, i) => ({ tag_id: 't' + i, key: 'k' + i }));
  tagsList.push({ tag_id: 'tag-far', key: 'test-case' });
  const id = await tags.ensureTestCaseTag();
  assert.equal(id, 'tag-far');
  assert.equal(calls.filter(c => c.method === 'GET').length, 2);
  assert.equal(calls.some(c => c.method === 'POST'), false);
});

test('a 4xx on create (concurrent creation) falls back to re-reading the tag', async () => {
  createTagError = Object.assign(new Error('MDI API error (422): key exists'), { statusCode: 422 });
  let reads = 0;
  const origList = tagsList;
  // First GET sees nothing, after the failed POST the tag "appears".
  tagsList = new Proxy(origList, { get(t, p) { if (p === 'slice') { reads++; if (reads >= 2) return () => [{ tag_id: 'tag-raced', key: 'test-case' }]; } return t[p]; } });
  const id = await tags.ensureTestCaseTag();
  assert.equal(id, 'tag-raced');
});

test('sweepUntaggedTestOrders tags full-flow test orders once their case exists, skips demo/live/tagged', async () => {
  orders = {
    'v-full-ready':   { is_test: true, demo: false, test_reason: 'x' },           // case exists at MDI
    'v-full-pending': { is_test: true, demo: false },                             // no case yet
    'v-demo':         { is_test: true, demo: true },                              // demo never creates a case
    'v-live':         { is_test: false },                                         // real order
    'v-done':         { is_test: true, demo: false, test_tagged_at: '2026-01-01' } // already tagged
  };
  vouchers['v-full-ready'] = { partner_voucher_id: 'v-full-ready', case_id: 'case-9' };
  vouchers['v-full-pending'] = { partner_voucher_id: 'v-full-pending', case_id: null };
  const out = await tags.sweepUntaggedTestOrders();
  assert.equal(out.scanned, 2);
  assert.deepEqual(out.tagged, ['case-9']);
  assert.equal(out.pending, 1);
  assert.deepEqual(out.errors, []);
  assert.ok(orders['v-full-ready'].test_tagged_at);
  assert.equal(orders['v-full-ready'].case_id, 'case-9');
  assert.equal(orders['v-full-pending'].test_tagged_at, undefined);
  assert.ok(calls.some(c => c.url === '/v1/partner/cases/case-9/tags/tag-new'));

  // Second sweep: nothing new to tag
  calls.length = 0;
  const again = await tags.sweepUntaggedTestOrders();
  assert.deepEqual(again.tagged, []);
  assert.equal(calls.some(c => c.url.includes('/tags/')), false);
});

process.on('exit', () => { Module._load = origLoad; });
