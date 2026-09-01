/**
 * Shared ownership resolution for Supabase-authenticated hub endpoints that
 * accept a client-supplied voucher_id/patient_id/case_id.
 *
 * These identifiers are ALWAYS untrusted input — a signed-in patient can send
 * any UUID in a request body. The only thing this app trusts to bind an
 * identifier to the calling patient is an `mdi-orders` blob record whose
 * `email` field matches the authenticated Supabase session's email (the same
 * record submitQuiz.js creates for every voucher, keyed by voucher_id).
 *
 * Used by caseStatus.js, getOrders.js, getEncounterDetails.js and
 * patientCases.js — kept in one place after a duplicated, hand-rolled copy in
 * getEncounterDetails.js broke on first case_id match instead of continuing
 * past a same-id-but-wrong-owner record (see git history for the fix).
 */

const { getStore } = require('@netlify/blobs');

function normalizeEmail(email) {
  return (email || '').toLowerCase().trim();
}

/**
 * Resolve the `mdi-orders` blob record owned by the authenticated user.
 *
 * Never distinguishes "that identifier isn't yours" from "nothing exists
 * yet" — callers should treat a null return as a normal pending/empty state,
 * not an error, to avoid turning this into an enumeration oracle.
 *
 * @param {{voucher_id?: string, patient_id?: string, case_id?: string}} ids
 * @param {string} userEmail - the verified Supabase session's email
 * @param {string} [logTag] - e.g. '[CASE STATUS]', used for console output
 * @returns {Promise<object|null>} the owned order record, or null
 */
async function resolveOwnedOrder({ voucher_id, patient_id, case_id } = {}, userEmail, logTag = '[MDI OWNERSHIP]') {
  const email = normalizeEmail(userEmail);
  if (!email || (!voucher_id && !patient_id && !case_id)) return null;

  let store;
  try {
    store = getStore('mdi-orders');
  } catch (e) {
    console.warn(`${logTag} Blob store access failed: ${e.message}`);
    return null;
  }

  // Fast path: direct voucher_id key lookup — still gated on email ownership.
  if (voucher_id) {
    try {
      const order = await store.get(voucher_id, { type: 'json' });
      if (order) {
        if (normalizeEmail(order.email) === email) return order;
        console.warn(`${logTag} voucher_id resolved to a record owned by a different email — refusing`);
      }
    } catch (e) {
      console.warn(`${logTag} Direct voucher lookup failed: ${e.message}`);
    }
  }

  // Fallback: scan by patient_id / case_id. Keep scanning past a same-id
  // match owned by someone else — a duplicate id across records must not
  // shadow the caller's own legitimate record.
  if (patient_id || case_id) {
    try {
      const { blobs } = await store.list();
      for (const blob of blobs || []) {
        try {
          const order = await store.get(blob.key, { type: 'json' });
          if (!order) continue;
          const idMatches =
            (patient_id && order.patient_id === patient_id) ||
            (case_id && order.case_id === case_id);
          if (!idMatches) continue;
          if (normalizeEmail(order.email) === email) {
            console.log(`${logTag} Found owned order by scan: ${blob.key}`);
            return order;
          }
          console.warn(`${logTag} Scan match ${blob.key} owned by a different email — refusing`);
        } catch { /* skip corrupted entries */ }
      }
    } catch (e) {
      console.warn(`${logTag} Blob scan failed: ${e.message}`);
    }
  }

  return null;
}

/**
 * Ownership check for endpoints that act on an MDI `patient_id` directly
 * (messaging). Two independent sources, either is sufficient:
 *   1. an `mdi-orders` blob record for that patient_id whose email matches;
 *   2. MDI's own patient record (GET /v1/partner/patients/:id) whose email
 *      matches the authenticated session — covers patients whose voucher
 *      predates the order store or was created outside the checkout.
 * Returns true only on a positive match. Never throws.
 */
async function verifyPatientOwnership(patientId, userEmail, logTag = '[MDI OWNERSHIP]') {
  const email = normalizeEmail(userEmail);
  if (!email || !patientId || !/^[0-9a-f-]{36}$/i.test(String(patientId))) return false;

  const owned = await resolveOwnedOrder({ patient_id: patientId }, email, logTag);
  if (owned) return true;

  try {
    const { mdiRequest } = require('./mdi-client');
    const p = await mdiRequest('GET', '/v1/partner/patients/' + encodeURIComponent(patientId));
    const mdiEmail = normalizeEmail(p && (p.email || (p.data && p.data.email)));
    if (mdiEmail && mdiEmail === email) return true;
    console.warn(`${logTag} patient_id ${patientId} belongs to a different email — refusing`);
  } catch (e) {
    console.warn(`${logTag} MDI patient lookup failed (${e.statusCode || 'network'}) — refusing`);
  }
  return false;
}

module.exports = { resolveOwnedOrder, verifyPatientOwnership, normalizeEmail };
