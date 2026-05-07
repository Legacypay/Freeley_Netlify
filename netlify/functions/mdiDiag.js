/**
 * Netlify Function: mdiDiag (TEMPORARY — DELETE AFTER TESTING)
 * Phase 5: Test sandbox voucher creation with correct environment_id.
 *
 * GET /.netlify/functions/mdiDiag              — basic probe + list environments
 * GET /.netlify/functions/mdiDiag?test=sandbox — test sandbox voucher creation with environment_id
 */

const { getAccessToken, CORS_HEADERS, BASE_URL } = require('./lib/mdi-client');

const MDI_PARTNER_ID = process.env.MDI_PARTNER_ID || 'f81508d1-3c53-4849-a636-1e9050a68e00';

// Discovered from portal Test Bench → Create Voucher → Sandbox
const SANDBOX_ENVIRONMENT_ID = '6ab0181e-d52a-488f-a161-d64d576b2eba';
const SEMA_QUESTIONNAIRE_ID = 'c77365a4-2945-41cc-bb4e-aa2f4db3fd2d';
// Semaglutide S1 offering
const SEMA_S1_OFFERING_ID = '69a90f36-2f33-4c25-a07b-7093a85474ab';

async function apiCall(token, method, path, body) {
  const opts = {
    method,
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Accept': 'application/json' }
  };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const resp = await fetch(BASE_URL + path, opts);
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = text.substring(0, 2000); }
  return { status: resp.status, data };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const results = {};
  const test = event.queryStringParameters?.test;

  try {
    const token = await getAccessToken();
    results.auth = 'ok';

    if (test === 'sandbox') {
      const minimalPayload = {
        questionnaire_id: SEMA_QUESTIONNAIRE_ID,
        environment_id: SANDBOX_ENVIRONMENT_ID
      };

      // ── Test 1: /v1/partner/tests/vouchers (no partner ID) ──
      const res1 = await apiCall(token, 'POST', '/v1/partner/tests/vouchers', minimalPayload);
      results.test1_tests_vouchers = { response: res1 };

      // ── Test 2: /v1/partner/tests/vouchers/{partner_id} ──
      const res2 = await apiCall(token, 'POST', '/v1/partner/tests/vouchers/' + MDI_PARTNER_ID, minimalPayload);
      results.test2_tests_vouchers_with_id = { response: res2 };

      // ── Test 3: Original /v1/partner/vouchers with environment_id (control) ──
      const res3 = await apiCall(token, 'POST', '/v1/partner/vouchers', minimalPayload);
      results.test3_partner_vouchers = { response: res3 };

      // ── Test 4: Try demo:true flag with environment_id ──
      const res4 = await apiCall(token, 'POST', '/v1/partner/vouchers', { ...minimalPayload, demo: true });
      results.test4_demo_true = { response: res4 };

      // ── Test 5: Try /api/ prefix path (portal may use this) ──
      const res5 = await apiCall(token, 'POST', '/api/partners/' + MDI_PARTNER_ID + '/vouchers', minimalPayload);
      results.test5_api_prefix = { response: res5 };

      // ── Test 6: /v1/partner/vouchers with hold_status (matches portal payload exactly) ──
      const portalPayload = {
        questionnaire_id: SEMA_QUESTIONNAIRE_ID,
        environment_id: SANDBOX_ENVIRONMENT_ID,
        hold_status: false
      };
      const res6 = await apiCall(token, 'POST', '/v1/partner/vouchers', portalPayload);
      results.test6_portal_match = { response: res6 };

    } else {
      // Basic probe — list partner info and vouchers
      const partner = await apiCall(token, 'GET', '/v1/partner');
      results.partner = partner;

      const vouchers = await apiCall(token, 'GET', '/v1/partner/vouchers');
      results.vouchers = { status: vouchers.status, count: vouchers.data?.data?.length || 0 };

      // Try to list first few voucher IDs to see sandbox ones
      if (vouchers.data?.data?.length > 0) {
        results.recent_vouchers = vouchers.data.data.slice(0, 5).map(v => ({
          id: v.id, environment: v.environment, status: v.status, created_at: v.created_at
        }));
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(results, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message, results })
    };
  }
};
