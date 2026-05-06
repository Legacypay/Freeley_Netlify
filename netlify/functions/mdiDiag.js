/**
 * Netlify Function: mdiDiag (TEMPORARY — DELETE AFTER TESTING)
 *
 * Phase 2: Get full partner object, discover available /v1/ paths,
 * test minimal flat voucher payload at /v1/partner/vouchers.
 *
 * GET /.netlify/functions/mdiDiag
 * GET /.netlify/functions/mdiDiag?test=voucher
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

    // 1) Full partner object — get ALL fields
    const partner = await apiCall(token, 'GET', '/v1/partner');
    results.partner = partner;

    // 2) Probe /v1/partner/* sub-routes to discover which exist
    const probePaths = [
      '/v1/partner/environments',
      '/v1/partner/patients',
      '/v1/partner/vouchers',
      '/v1/partner/questionnaires',
      '/v1/partner/addresses'
    ];
    for (const p of probePaths) {
      const r = await apiCall(token, 'GET', p);
      results['probe_' + p.replace('/v1/partner/', '')] = { status: r.status, keys: r.data && typeof r.data === 'object' ? Object.keys(r.data).slice(0, 10) : null, preview: typeof r.data === 'string' ? r.data.substring(0, 200) : (r.data?.error || r.data?.message || JSON.stringify(r.data).substring(0, 300)) };
    }

    // 3) If test=voucher — try different endpoint paths and payload combos
    if (test === 'voucher') {
      const questionnaire_id = 'c77365a4-2945-41cc-bb4e-aa2f4db3fd2d';
      const offering_id = '69a90f36-2f33-4c25-a07b-7093a85474ab';

      // Test A: /v1/partner/tests/vouchers/{partner} (old path that might bypass status check)
      const payloadA = {
        questionnaire_id: questionnaire_id,
        completion_time: '12:00:00',
        patient: {
          first_name: 'Test', last_name: 'Patient',
          email: 'test@freeley-test.com', date_of_birth: '1990-01-15',
          gender: 1, phone_number: '5551234567', phone_type: '2',
          address: { address: '123 Test St', city_name: 'Miami', state_name: 'FL', zip_code: '33101' }
        },
        case: {
          metadata: 'test', case_prescriptions: [], case_questions: [], case_files: [],
          diseases: [{ icd10_code: 'E66.9' }]
        },
        offerings: [{ id: offering_id }],
        demo: true
      };
      const resA = await apiCall(token, 'POST', '/v1/partner/tests/vouchers/' + MDI_PARTNER_ID, payloadA);
      results.test_voucher_old_path = { response: resA };

      // Test B: /v1/partner/vouchers with demo: true (flat payload)
      const payloadB = {
        questionnaire_id: questionnaire_id,
        offerings: [{ id: offering_id }],
        demo: true
      };
      const resB = await apiCall(token, 'POST', '/v1/partner/vouchers', payloadB);
      results.voucher_flat_demo_true = { payload: payloadB, response: resB };

      // Test C: /v1/partner/vouchers with demo: false (to compare error)
      const payloadC = { ...payloadB, demo: false };
      const resC = await apiCall(token, 'POST', '/v1/partner/vouchers', payloadC);
      results.voucher_flat_demo_false = { payload: payloadC, response: resC };

      // Test D: /v1/partner/vouchers WITHOUT demo field at all
      const payloadD = {
        questionnaire_id: questionnaire_id,
        offerings: [{ id: offering_id }]
      };
      const resD = await apiCall(token, 'POST', '/v1/partner/vouchers', payloadD);
      results.voucher_flat_no_demo = { payload: payloadD, response: resD };

      // Test E: Try /v1/partner/tests/vouchers (without partner ID in path)
      const resE = await apiCall(token, 'POST', '/v1/partner/tests/vouchers', payloadA);
      results.test_voucher_no_id = { response: resE };

      // Test F: Try /v1/partner/demo/vouchers
      const resF = await apiCall(token, 'POST', '/v1/partner/demo/vouchers', payloadB);
      results.demo_voucher_path = { response: resF };
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
