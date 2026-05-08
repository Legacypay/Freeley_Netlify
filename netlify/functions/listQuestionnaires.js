/**
 * TEMPORARY diagnostic function — lists all MDI questionnaires with their UUIDs.
 * DELETE THIS FILE after retrieving the questionnaire IDs.
 */
const { mdiRequest, CORS_HEADERS } = require('./lib/mdi-client');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  try {
    const questionnaires = await mdiRequest('GET', '/v1/partner/questionnaires');
    // Extract just id + name for each questionnaire
    const summary = (Array.isArray(questionnaires) ? questionnaires : []).map(q => ({
      id: q.partner_questionnaire_id || q.id,
      name: q.name,
      active: q.active
    }));
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: summary.length, questionnaires: summary }, null, 2)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message })
    };
  }
};
