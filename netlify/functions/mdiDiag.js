/**
 * Netlify Function: mdiDiag (TEMPORARY — DELETE AFTER TESTING)
 *
 * Diagnostic function to discover MDI environment_id, test API paths,
 * and validate the correct voucher payload structure.
 *
 * GET /.netlify/functions/mdiDiag
 * GET /.netlify/functions/mdiDiag?test=voucher  (test minimal voucher creation)
 */

const { getAccessToken, mdiRequest, CORS_HEADERS, BASE_URL } = require('./lib/mdi-client');

const MDI_PARTNER_ID = process.env.MDI_PARTNER_ID || 'f81508d1-3c53-4849-a636-1e9050a68e00';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const results = {};
  const test = event.queryStringParameters?.test;

  try {
    // Step 1: Get auth token (confirms auth is working)
    const token = await getAccessToken();
    results.auth = { status: 'ok', token_preview: token.substring(0, 20) + '...' };

    // Step 2: Try multiple paths to find environments
    const envPaths = [
      '/v1/partner/environments',
      '/api/partners/' + MDI_PARTNER_ID + '/environments',
      '/v1/partner/environments?partner_id=' + MDI_PARTNER_ID
    ];

    for (const path of envPaths) {
      try {
        const resp = await fetch(BASE_URL + path, {
          headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
        });
        const text = await resp.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = text.substring(0, 500); }
        results['env_' + path] = { status: resp.status, data: data };
      } catch (e) {
        results['env_' + path] = { error: e.message };
      }
    }

    // Step 3: Try to get partner details (may contain environment_id)
    const partnerPaths = [
      '/v1/partner',
      '/api/partners/' + MDI_PARTNER_ID
    ];

    for (const path of partnerPaths) {
      try {
        const resp = await fetch(BASE_URL + path, {
          headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
        });
        const text = await resp.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = text.substring(0, 500); }
        // If it's a large response, just extract key fields
        if (typeof data === 'object' && data !== null) {
          const slim = {
            id: data.id || data.data?.id,
            name: data.name || data.data?.name,
            environment_id: data.environment_id || data.data?.environment_id,
            environment: data.environment || data.data?.environment,
            environments: data.environments || data.data?.environments,
            status: data.status || data.data?.status,
            _keys: Object.keys(data.data || data).slice(0, 30)
          };
          results['partner_' + path] = { status: resp.status, data: slim };
        } else {
          results['partner_' + path] = { status: resp.status, data: data };
        }
      } catch (e) {
        results['partner_' + path] = { error: e.message };
      }
    }

    // Step 4: If test=voucher, try minimal voucher creation
    if (test === 'voucher') {
      // Use semaglutide-s1 questionnaire and offering for test
      const questionnaire_id = 'c77365a4-2945-41cc-bb4e-aa2f4db3fd2d';
      const offering_id = '69a90f36-2f33-4c25-a07b-7093a85474ab';

      // We'll try to extract environment_id from the results above
      let environment_id = null;
      for (const key of Object.keys(results)) {
        if (key.startsWith('env_') && results[key].data) {
          const d = results[key].data;
          if (Array.isArray(d)) {
            environment_id = d[0]?.id;
          } else if (d.data && Array.isArray(d.data)) {
            environment_id = d.data[0]?.id;
          } else if (d.id) {
            environment_id = d.id;
          }
        }
      }

      // Try voucher with BOTH paths
      const voucherPaths = [
        { path: '/v1/partner/vouchers', method: 'POST' },
        { path: '/api/partners/' + MDI_PARTNER_ID + '/vouchers', method: 'POST' }
      ];

      for (const vp of voucherPaths) {
        const payload = {
          questionnaire_id: questionnaire_id,
          environment_id: environment_id,
          offerings: [{ id: offering_id }],
          demo: true
        };

        try {
          const resp = await fetch(BASE_URL + vp.path, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          const text = await resp.text();
          let data;
          try { data = JSON.parse(text); } catch (e) { data = text.substring(0, 1000); }
          results['voucher_' + vp.path] = {
            status: resp.status,
            payload_sent: payload,
            response: data
          };
        } catch (e) {
          results['voucher_' + vp.path] = { error: e.message, payload_sent: payload };
        }
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
