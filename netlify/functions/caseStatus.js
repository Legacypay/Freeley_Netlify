/**
 * Netlify Function: caseStatus
 *
 * Allows authenticated patients to check the status of their MDI case.
 * REQUIRES a valid Supabase access token in the Authorization header.
 *
 * POST /.netlify/functions/caseStatus
 * Headers: { Authorization: 'Bearer <supabase-access-token>' }
 *
 * Request Body:
 * {
 *   "patient_id": "uuid-here",
 *   "case_id": "uuid-here",          // optional if voucher_id provided
 *   "voucher_id": "uuid-here"        // optional — used to resolve case_id from blob store
 * }
 *
 * If case_id is missing but voucher_id or patient_id is provided,
 * the function will attempt to resolve case_id from the mdi-orders
 * blob store before calling the MDI API.
 *
 * Returns a simplified, patient-friendly status.
 */

const { mdiRequest, CORS_HEADERS } = require('./lib/mdi-client');
const { verifySupabaseToken } = require('./lib/verify-supabase-token');
const { resolveOwnedOrder } = require('./lib/mdi-order-ownership');

// Map MDI internal statuses to patient-friendly messages
const STATUS_MAP = {
  'created': {
    status: 'submitted',
    title: 'Submitted for Review',
    message: 'Your information has been submitted. A licensed physician will review your case shortly.',
    icon: '📝'
  },
  'assigned': {
    status: 'in_review',
    title: 'Under Physician Review',
    message: 'A licensed physician is currently reviewing your health information.',
    icon: '👨‍⚕️'
  },
  'waiting': {
    status: 'needs_info',
    title: 'Additional Information Needed',
    message: 'Your physician has a question for you. Please check your messages.',
    icon: '⏳'
  },
  'processing': {
    status: 'processing',
    title: 'Prescription Processing',
    message: 'Great news! Your prescription has been approved and is being processed by the pharmacy.',
    icon: '🔄'
  },
  'approved': {
    status: 'approved',
    title: 'Approved',
    message: 'Your case has been approved by the physician. Your prescription is being prepared.',
    icon: '✅'
  },
  'completed': {
    status: 'completed',
    title: 'Prescription Ready',
    message: 'Your prescription has been confirmed and your order is being prepared for shipment.',
    icon: '🎉'
  },
  'cancelled': {
    status: 'cancelled',
    title: 'Case Cancelled',
    message: 'This case has been cancelled. Please contact support if you have questions.',
    icon: '❌'
  },
  'support': {
    status: 'support',
    title: 'Under Support Review',
    message: 'Your case has been escalated to our support team. We\'ll be in touch soon.',
    icon: '🛟'
  }
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // ── Step 1: Verify Supabase authentication ──────────────────
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const user = await verifySupabaseToken(idToken);
    if (!user) {
      console.warn('[CASE STATUS] Unauthorized access attempt — no valid Supabase token');
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Authentication required. Please sign in.' })
      };
    }

    console.log(`[CASE STATUS] Authenticated user: ${user.email}`);

    // ── Step 2: Parse and validate request ──────────────────────
    const { patient_id, case_id, voucher_id } = JSON.parse(event.body);

    // ── Step 2b: Resolve identifiers from an OWNED blob record ──
    // patient_id/case_id/voucher_id are client-supplied and therefore untrusted
    // — without this check, any authenticated patient could pass another
    // patient's identifiers and read their case status/clinician/offerings.
    // resolveOwnedOrder only trusts identifiers backed by an mdi-orders record
    // whose `email` matches the verified Supabase session (lib/mdi-order-ownership.js).
    // This runs even when case_id/patient_id are supplied directly (not just when
    // resolving from voucher_id) — a direct client-supplied case_id must never
    // be trusted on its own.
    const ownedOrder = await resolveOwnedOrder({ voucher_id, patient_id, case_id }, user.email, '[CASE STATUS]');

    // No owned record = voucher not redeemed yet, patient not created by MDI
    // yet, or the caller supplied an identifier that isn't theirs. All three are
    // handled identically — a normal pending state, not an error, and never
    // distinguishable from "that's not your case" to avoid an enumeration oracle.
    if (!ownedOrder) {
      console.log('[CASE STATUS] No owned order resolved — returning pending status');
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          status: 'submitted',
          title: 'Submitted for Review',
          message: 'Your information has been submitted. A licensed physician will review your case shortly.',
          icon: '📝',
          case_id: null,
          patient_id: null,
          patient_email: null,
          voucher_id: voucher_id || null,
          clinician: null,
          offerings: [],
          last_updated: new Date().toISOString()
        })
      };
    }

    const resolvedPatientId = ownedOrder.patient_id || null;
    const resolvedCaseId = ownedOrder.case_id || null;
    const resolvedEmail = ownedOrder.email || null;

    // Owned record exists but MDI hasn't fired the case_created webhook yet.
    if (!resolvedCaseId) {
      console.log('[CASE STATUS] Owned order has no case_id yet — returning pending status');
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          status: ownedOrder.status || 'submitted',
          title: 'Submitted for Review',
          message: 'Your information has been submitted. A licensed physician will review your case shortly.',
          icon: '📝',
          case_id: null,
          patient_id: resolvedPatientId,
          patient_email: resolvedEmail,
          voucher_id: voucher_id || null,
          clinician: null,
          offerings: [],
          last_updated: ownedOrder.updated_at || ownedOrder.created_at || null
        })
      };
    }

    // ── Step 3: Fetch case details from MDI ─────────────────────
    const caseData = await mdiRequest(
      'GET',
      `/v1/patient/patients/${resolvedPatientId}/cases/${resolvedCaseId}`
    );

    // ── Step 4: Extract the status ──────────────────────────────
    const mdiStatus = caseData.case_status?.name?.toLowerCase() || 'created';
    const friendlyStatus = STATUS_MAP[mdiStatus] || STATUS_MAP['created'];

    // Extract clinician info (if assigned)
    let clinician = null;
    if (caseData.case_assignment?.clinician) {
      const doc = caseData.case_assignment.clinician;
      clinician = {
        name: doc.full_name,
        specialty: doc.clinician_specialty || doc.specialty,
        photo: doc.photo?.url_thumbnail || null
      };
    }

    // Extract prescription/offering info
    const offerings = (caseData.case_offerings || []).map(o => ({
      name: o.name || o.title,
      status: o.status || 'pending'
    }));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ...friendlyStatus,
        case_id: resolvedCaseId,
        patient_id: resolvedPatientId,
        patient_email: resolvedEmail || caseData.patient?.email || null,
        clinician,
        offerings,
        last_updated: caseData.case_status?.updated_at || null
      })
    };

  } catch (error) {
    console.error('[CASE STATUS] Error:', error);

    if (error.statusCode === 404) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Case not found. Please check your case ID.' })
      };
    }

    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unable to retrieve case status. Please try again.' })
    };
  }
};

// Exported for reference only
exports.verifySupabaseToken = verifySupabaseToken;
