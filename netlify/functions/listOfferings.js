/**
 * TEMPORARY Netlify Function: listOfferings
 *
 * Queries MDI API to list all partner offerings with their
 * compound/medication/supply IDs. Used to find the correct
 * partner_compound_id values for our products.js config.
 *
 * GET /.netlify/functions/listOfferings
 *
 * DELETE THIS FUNCTION AFTER GETTING THE DATA.
 */

const { mdiRequest, CORS_HEADERS } = require('./lib/mdi-client');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    console.log('[LIST OFFERINGS] Fetching partner offerings from MDI...');

    const results = {};

    // Try multiple endpoints to find offerings data
    const endpoints = [
      { name: 'partner_offerings', path: '/v1/partner/offerings' },
      { name: 'partner_compounds', path: '/v1/partner/compounds' },
      { name: 'partner_medications', path: '/v1/partner/medications' },
      { name: 'partner_supplies', path: '/v1/partner/supplies' },
      { name: 'partner_services', path: '/v1/partner/services' },
    ];

    for (const ep of endpoints) {
      try {
        const data = await mdiRequest('GET', ep.path);
        const items = Array.isArray(data) ? data : (data && data.data ? data.data : []);
        results[ep.name] = {
          count: items.length,
          items: items.map(item => ({
            id: item.id,
            name: item.name || item.title || item.description || 'N/A',
            partner_compound_id: item.partner_compound_id || item.compound_id || null,
            partner_medication_id: item.partner_medication_id || item.medication_id || null,
            partner_supply_id: item.partner_supply_id || item.supply_id || null,
            partner_service_id: item.partner_service_id || item.service_id || null,
            type: item.type || item.offering_type || null,
            status: item.status || null,
            // Include ALL keys so we can see what fields exist
            _all_keys: Object.keys(item)
          }))
        };
        console.log(`[LIST OFFERINGS] ${ep.name}: found ${items.length} items`);
      } catch (e) {
        results[ep.name] = { error: e.message, statusCode: e.statusCode || 'unknown' };
        console.log(`[LIST OFFERINGS] ${ep.name}: ${e.statusCode || 'error'} - ${e.message}`);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(results, null, 2)
    };

  } catch (error) {
    console.error('[LIST OFFERINGS] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
