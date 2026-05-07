/**
 * Netlify Function: mdiDiag (TEMPORARY — DELETE AFTER TESTING)
 * Phase 7: Deep-dive on /v1/partner/tests/vouchers/{partner} which now
 * returns ErrorException (sandbox IS provisioned) instead of "no sandbox".
 */

const { getAccessToken, CORS_HEADERS, BASE_URL } = require('./lib/mdi-client');

const MDI_PARTNER_ID = process.env.MDI_PARTNER_ID || 'f81508d1-3c53-4849-a636-1e9050a68e00';
const SANDBOX_ENVIRONMENT_ID = '6ab0181e-d52a-488f-a161-d64d576b2eba';
const SEMA_QUESTIONNAIRE_ID = 'c77365a4-2945-41cc-bb4e-aa2f4db3fd2d';
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
      const testEndpoint = '/v1/partner/tests/vouchers/' + MDI_PARTNER_ID;

      // ── Test 1: Minimal with just questionnaire_id + environment_id ──
      const res1 = await apiCall(token, 'POST', testEndpoint, {
        questionnaire_id: SEMA_QUESTIONNAIRE_ID,
        environment_id: SANDBOX_ENVIRONMENT_ID
      });
      results.test1_minimal = res1;

      // ── Test 2: With offerings ──
      const res2 = await apiCall(token, 'POST', testEndpoint, {
        questionnaire_id: SEMA_QUESTIONNAIRE_ID,
        environment_id: SANDBOX_ENVIRONMENT_ID,
        offerings: [{ id: SEMA_S1_OFFERING_ID }]
      });
      results.test2_with_offerings = res2;

      // ── Test 3: Full payload (patient + case + offerings) ──
      const ts = Date.now();
      const res3 = await apiCall(token, 'POST', testEndpoint, {
        questionnaire_id: SEMA_QUESTIONNAIRE_ID,
        environment_id: SANDBOX_ENVIRONMENT_ID,
        completion_time: '12:00:00',
        patient: {
          first_name: 'Test', last_name: 'Patient',
          email: 'sandbox-' + ts + '@freeley-test.com',
          date_of_birth: '1990-01-15',
          gender: 1, phone_number: '5551234567', phone_type: '2',
          address: {
            address: '123 Test Street',
            city_name: 'Miami', state_name: 'FL', zip_code: '33101'
          }
        },
        case: {
          metadata: 'freeley|semaglutide-s1|test|' + ts,
          case_questions: [
            { question: 'Weight?', answer: '200 lbs', type: 'string', important: true, display_in_pdf: true, label: 'Q1', metadata: 'test' }
          ],
          case_files: [],
          diseases: [{ icd10_code: 'E66.9' }]
        },
        offerings: [{ id: SEMA_S1_OFFERING_ID }],
        demo: true
      });
      results.test3_full = res3;

      // ── Test 4: With hold_status false ──
      const res4 = await apiCall(token, 'POST', testEndpoint, {
        questionnaire_id: SEMA_QUESTIONNAIRE_ID,
        environment_id: SANDBOX_ENVIRONMENT_ID,
        offerings: [{ id: SEMA_S1_OFFERING_ID }],
        hold_status: false
      });
      results.test4_hold_status = res4;

      // ── Test 5: GET the vouchers we created via portal to see their structure ──
      const vouchers = await apiCall(token, 'GET', '/v1/partner/vouchers?environment_id=' + SANDBOX_ENVIRONMENT_ID);
      results.test5_list_sandbox_vouchers = {
        status: vouchers.status,
        count: vouchers.data?.data?.length || 0,
        first_voucher: vouchers.data?.data?.[0] || null
      };

      // ── Test 6: Also try listing all vouchers and see if sandbox ones appear ──
      const allVouchers = await apiCall(token, 'GET', '/v1/partner/vouchers');
      if (allVouchers.data?.data) {
        results.test6_all_vouchers = allVouchers.data.data.slice(0, 3).map(v => ({
          id: v.id, status: v.status, environment_id: v.environment_id,
          environment: v.environment, questionnaire_id: v.questionnaire_id,
          created_at: v.created_at
        }));
      }

    } else {
      // Basic probe
      const partner = await apiCall(token, 'GET', '/v1/partner');
      results.partner = { status: partner.status, partner_status: partner.data?.data?.status, partner_name: partner.data?.data?.name };

      const vouchers = await apiCall(token, 'GET', '/v1/partner/vouchers');
      results.vouchers = { status: vouchers.status, count: vouchers.data?.data?.length || 0 };
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
