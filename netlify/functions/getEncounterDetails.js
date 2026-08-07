/**
 * Netlify Function: getEncounterDetails
 *
 * Fetches detailed encounter/case information from MDI including:
 * - Case status and clinician assignment
 * - Offerings/prescriptions with details
 * - Encounter notes and clinical data
 * - Any attached documents
 *
 * POST /.netlify/functions/getEncounterDetails
 * Headers: { Authorization: 'Bearer <supabase-access-token>' }
 * Body: { "patient_id": "uuid", "case_id": "uuid" }
 */

const { mdiRequest, CORS_HEADERS } = require('./lib/mdi-client');
const { verifySupabaseToken } = require('./lib/verify-supabase-token');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    // Verify Supabase auth
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const user = await verifySupabaseToken(idToken);
    if (!user) {
      return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Authentication required.' }) };
    }

    const { patient_id, case_id } = JSON.parse(event.body || '{}');

    if (!case_id) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'case_id is required.' }) };
    }

    console.log(`[ENCOUNTER DETAILS] Fetching case=${case_id}, patient=${patient_id || 'N/A'}`);

    const records = [];

    // Strategy 1: If we have patient_id, fetch full case details via Patient API
    if (patient_id && case_id) {
      try {
        const caseData = await mdiRequest('GET', `/v1/patient/patients/${patient_id}/cases/${case_id}`);

        // Extract clinician notes if available
        if (caseData.case_assignment && caseData.case_assignment.clinician) {
          const doc = caseData.case_assignment.clinician;
          records.push({
            type: 'clinician_assignment',
            title: 'Physician Assigned',
            date: caseData.case_assignment.created_at || caseData.updated_at || null,
            clinician: {
              name: doc.full_name || doc.name || 'Your Physician',
              specialty: doc.clinician_specialty || doc.specialty || 'Board-Certified Physician',
              photo: doc.photo?.url_thumbnail || null
            },
            body: `Your case has been assigned to ${doc.full_name || 'a physician'} for review.`
          });
        }

        // Extract offerings/prescriptions
        if (caseData.case_offerings && caseData.case_offerings.length > 0) {
          for (const offering of caseData.case_offerings) {
            records.push({
              type: 'prescription',
              title: offering.name || offering.title || 'Prescribed Medication',
              date: offering.updated_at || offering.created_at || null,
              status: offering.status || 'pending',
              body: offering.description || null,
              offering_id: offering.id || null
            });
          }
        }

        // Extract case status changes as timeline entries
        if (caseData.case_status) {
          const statusName = caseData.case_status.name || caseData.case_status;
          records.push({
            type: 'status_update',
            title: 'Case Status: ' + (typeof statusName === 'string' ? statusName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Updated'),
            date: caseData.case_status.updated_at || caseData.updated_at || null,
            body: null
          });
        }

        // Extract any notes/messages attached to the case
        if (caseData.notes || caseData.clinical_notes) {
          const notes = caseData.notes || caseData.clinical_notes;
          const noteList = Array.isArray(notes) ? notes : [notes];
          for (const note of noteList) {
            if (typeof note === 'string') {
              records.push({ type: 'clinical_note', title: 'Clinical Note', date: null, body: note });
            } else if (note && note.text) {
              records.push({
                type: 'clinical_note',
                title: note.title || 'Clinical Note',
                date: note.created_at || null,
                body: note.text || note.body || note.content || null,
                author: note.author || note.clinician_name || null
              });
            }
          }
        }

        console.log(`[ENCOUNTER DETAILS] Found ${records.length} record(s) from case API`);
      } catch (e) {
        console.warn(`[ENCOUNTER DETAILS] Case details fetch failed: ${e.message}`);
      }
    }

    // Strategy 2: Try partner encounters endpoint for additional data
    if (records.length === 0 && case_id) {
      try {
        const encounter = await mdiRequest('GET', `/v1/partner/encounters/${case_id}`);
        if (encounter) {
          records.push({
            type: 'encounter_summary',
            title: 'Encounter Summary',
            date: encounter.updated_at || encounter.created_at || null,
            status: encounter.status || null,
            body: encounter.summary || encounter.description || 'Your encounter is being processed by the clinical team.'
          });

          // Extract any offerings from the encounter
          const offerings = encounter.offerings || encounter.case_offerings || [];
          for (const o of offerings) {
            records.push({
              type: 'prescription',
              title: o.name || o.title || 'Treatment',
              date: o.updated_at || null,
              status: o.status || 'pending',
              body: o.description || null
            });
          }
        }
      } catch (e) {
        console.warn(`[ENCOUNTER DETAILS] Encounter fetch failed: ${e.message}`);
      }
    }

    // Sort records by date descending
    records.sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ records })
    };

  } catch (error) {
    console.error('[ENCOUNTER DETAILS] Error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unable to retrieve encounter details.' })
    };
  }
};
