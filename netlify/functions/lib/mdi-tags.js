/**
 * MDI tag helpers — attach the "test-case" tag to encounters created by test orders.
 *
 * Docs (Partners > Tags / Partners > Cases > Tags):
 *   GET  /v1/partner/tags?type=global&page=1&per_page=100
 *   POST /v1/partner/tags        { name, key, type, color, description, removable_role?, auto_detach_status? }
 *   POST /v1/partner/cases/:case_id/tags/:tag_id   { notes }
 *
 * The tag can only be attached once a case exists (voucher.case_id != null), which is
 * why mdiWebhook.js calls tagTestCase() on case_* events rather than submitQuiz.js.
 *
 * Env vars (all optional — sensible defaults below):
 *   MDI_TEST_TAG_KEY    tag `key` in MDI, must be unique per partner (default: "test-case")
 *   MDI_TEST_TAG_NAME   tag display name (default: "Test Case")
 *   MDI_TEST_TAG_COLOR  hex color for the tag (default: "#f59e0b")
 */

const { getStore } = require('@netlify/blobs');
const { mdiRequest } = require('./mdi-client');

const TEST_TAG_KEY = process.env.MDI_TEST_TAG_KEY || 'test-case';
function testTagDef() {
  return {
    name: process.env.MDI_TEST_TAG_NAME || 'Test Case',
    key: TEST_TAG_KEY,
    type: 'global',
    color: process.env.MDI_TEST_TAG_COLOR || '#f59e0b',
    description: 'Internal Freeley test order — not a real patient encounter, do not bill.'
  };
}
const CONFIG_STORE = 'mdi-config';
const CONFIG_KEY = 'test-case-tag-id';

let cachedTagId = null;

function extractTags(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.tags)) return res.tags;
  return [];
}

function tagIdOf(tag) {
  return tag && (tag.tag_id || tag.id || tag.partner_tag_id) || null;
}

/** Page through GET /v1/partner/tags?type=global until the test tag is found. */
async function findExistingTag() {
  const PER_PAGE = 100;
  for (let page = 1; page <= 20; page++) {
    const res = await mdiRequest('GET', '/v1/partner/tags?type=global&page=' + page + '&per_page=' + PER_PAGE);
    const list = extractTags(res);
    const hit = list.find(t => t && t.key === TEST_TAG_KEY);
    if (hit) return hit;
    if (list.length < PER_PAGE) return null;
  }
  return null;
}

/**
 * Find (or create) the global "test-case" tag and return its id. Cached in memory and in
 * the `mdi-config` blob store so we only hit MDI once.
 */
async function ensureTestCaseTag() {
  if (cachedTagId) return cachedTagId;

  let store = null;
  try {
    store = getStore(CONFIG_STORE);
    const saved = await store.get(CONFIG_KEY, { type: 'json' });
    if (saved && saved.tag_id) {
      cachedTagId = saved.tag_id;
      return cachedTagId;
    }
  } catch (e) {
    console.warn('[MDI TAGS] Config store unavailable (non-critical):', e.message);
  }

  let tag = await findExistingTag();
  if (!tag) {
    console.log('[MDI TAGS] Creating global tag "' + TEST_TAG_KEY + '"');
    try {
      tag = await mdiRequest('POST', '/v1/partner/tags', testTagDef());
    } catch (e) {
      // Concurrent invocation may have created it first (or MDI rejects duplicate keys):
      // re-read instead of failing.
      if (e.statusCode && e.statusCode >= 400 && e.statusCode < 500) {
        console.warn('[MDI TAGS] Create returned ' + e.statusCode + ' — re-reading existing tags');
        tag = await findExistingTag();
      }
      if (!tag) throw e;
    }
  }
  const id = tagIdOf(tag) || tagIdOf(tag && tag.data);
  if (!id) throw new Error('MDI tag response did not include an id: ' + JSON.stringify(tag).slice(0, 200));

  cachedTagId = id;
  if (store) {
    try { await store.setJSON(CONFIG_KEY, { tag_id: id, key: TEST_TAG_KEY, saved_at: new Date().toISOString() }); }
    catch (e) { console.warn('[MDI TAGS] Failed to cache tag id (non-critical):', e.message); }
  }
  return id;
}

/**
 * Attach the test-case tag to a case. Idempotent from our side: callers should persist
 * `test_tagged_at` on the order record and skip when already set.
 */
async function tagTestCase(caseId, notes) {
  if (!caseId) throw new Error('tagTestCase: caseId is required');
  const tagId = await ensureTestCaseTag();
  await mdiRequest('POST', '/v1/partner/cases/' + encodeURIComponent(caseId) + '/tags/' + encodeURIComponent(tagId), {
    notes: notes || 'Test order created by Freeley automation — not a real patient.'
  });
  console.log('[MDI TAGS] Tag "' + TEST_TAG_KEY + '" attached to case ' + caseId);
  return tagId;
}

/**
 * Sweep `mdi-orders` for full-flow test orders (is_test && !demo) that have not been
 * tagged yet. Resolves case_id via GET /v1/partner/vouchers/:id (docs: response carries
 * `case_id`, null until the patient redeems the voucher) and tags it. Safety net for the
 * webhook path — run from the 15-minute retryPendingCases cron.
 *
 * @returns {{ scanned: number, tagged: string[], pending: number, errors: string[] }}
 */
async function sweepUntaggedTestOrders({ limit = 50 } = {}) {
  const out = { scanned: 0, tagged: [], pending: 0, errors: [] };
  const store = getStore('mdi-orders');
  const { blobs } = await store.list();
  for (const blob of blobs || []) {
    if (out.scanned >= limit) break;
    let order;
    try { order = await store.get(blob.key, { type: 'json' }); } catch { continue; }
    if (!order || order.is_test !== true || order.demo === true || order.test_tagged_at) continue;
    out.scanned++;
    try {
      let caseId = order.case_id;
      if (!caseId) {
        const v = await mdiRequest('GET', '/v1/partner/vouchers/' + encodeURIComponent(blob.key));
        caseId = (v && v.case_id) || null;
      }
      if (!caseId) { out.pending++; continue; }
      await tagTestCase(caseId, 'Freeley test order (' + (order.test_reason || 'test') + ') — voucher ' + blob.key + ' [sweep]');
      await store.setJSON(blob.key, { ...order, case_id: caseId, test_tagged_at: new Date().toISOString(), test_tagged_by: 'sweep' });
      out.tagged.push(caseId);
    } catch (e) {
      out.errors.push(blob.key + ': ' + e.message);
    }
  }
  if (out.scanned) console.log('[MDI TAGS] Sweep: scanned ' + out.scanned + ', tagged ' + out.tagged.length + ', pending ' + out.pending + ', errors ' + out.errors.length);
  return out;
}

/** Test hook: reset in-memory cache. */
function _resetCache() { cachedTagId = null; }

module.exports = { ensureTestCaseTag, tagTestCase, sweepUntaggedTestOrders, TEST_TAG_KEY, testTagDef, _resetCache };
