/**
 * Netlify Function: mdiDiag (TEMPORARY — DELETE AFTER TESTING)
 * Phase 4: Test sandbox voucher creation now that sandbox webhook is configured.
 *
 * GET /.netlify/functions/mdiDiag              — basic probe
 * GET /.netlify/functions/mdiDiag?test=sandbox — test sandbox voucher creation
 */

const { getAccessToken, CORS_HEADERS, BASE_URL } = require('./lib/mdi-client');

const MDI_PARTNER_ID = process.env.MDI_PARTNER_ID || 'f81508d1-3c53-4849-a636-1e9050a68e00';

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
      // Semaglutide S1 offering/questionnaire for test
      const questionnaire_id = 'c77365a4-2945-41cc-bb4e-aa2f4db3fd2d';
      const offering_id = '69a90f36-2f33-4c25-a07b-7093a85474ab';

      // Test 1: /v1/partner/tests/vouchers/{partner} — sandbox test endpoint
      const testPayload = {
        questionnaire_id: questionnaire_id,
        completion_time: '12:00:00',
        patient: {
          first_name: 'Test', last_name: 'Patient',
          email: 'sandbox-test@freeley-test.com',
          date_of_birth: '1990-01-15',
          gender: 1, phone_number: '5551234567', phone_type: '2',
          address: {
            address: '123 Test Street',
            city_name: 'Miami', state_name: 'FL', zip_code: '33101'
          }
        },
        case: {
          metadata: 'freeley|semaglutide-s1|sandbox-test|' + Date.now(),
          is_additional_approval_needed: null,
          case_prescriptions: [],
          case_questions: [
            { question: 'Current weight?', answer: '200 lbs', type: 'string', important: true, display_in_pdf: true, label: 'Q1', metadata: 'freeley-quiz-semaglutide-s1' }
          ],
          case_files: [],
          diseases: [{ icd10_code: 'E66.9' }]
        },
        offerings: [{ id: offering_id }],
        demo: true
      };

      const res1 = await apiCall(token, 'POST', '/v1/partner/tests/vouchers/' + MDI_PARTNER_ID, testPayload);
      results.sandbox_test_voucher = { response: res1 };

      // Test 2: /v1/partner/vouchers — main endpoint with demo:true
      const res2 = await apiCall(token, 'POST', '/v1/partner/vouchers', {
        questionnaire_id: questionnaire_id,
        offerings: [{ id: offering_id }],
        demo: true
      });
      results.main_voucher_demo = { response: res2 };

      // Test 3: /v1/partner/vouchers — main endpoint with full nested payload
      const res3 = await apiCall(token, 'POST', '/v1/partner/vouchers', testPayload);
      results.main_voucher_full = { response: res3 };
    } else {
      // Basic probe — confirm sandbox is now recognized
      const partner = await apiCall(token, 'GET', '/v1/partner');
      results.partner = partner;

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
