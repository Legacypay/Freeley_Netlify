/**
 * Netlify Function: checkAdditionalApprovals (scheduled)
 *
 * Surfaces MDI cases flagged `is_additional_approval_needed: true` — MD Integrations'
 * documented mechanism (POST /v1/partner/cases/status/:status, per the Postman docs
 * "Partners > Cases > Get cases by status") for "the doctor is requesting a change in
 * treatment/titration; a partner team member must review and move the case back to
 * Assigned to proceed."
 *
 * Why this exists: per MDI's go-live guidance (2026-08-21) — "Please regularly review
 * encounters in Approved status... someone on your team will need to review and move
 * the encounter back to Assigned to proceed" — without this, that review only happens
 * if/when someone manually checks the MDI portal. This function polls the documented
 * `is_additional_approval_needed` filter and alerts internally (n8n → Slack) the first
 * time each case is seen, so nothing sits unreviewed silently.
 *
 * NOTE: The webhook event `case_approved` handled in mdiWebhook.js is a DIFFERENT,
 * separately-documented concept (a clinician's final approval of the case) — we could
 * not confirm from the public API docs whether it is the same thing as the portal's
 * "Approved (Action Required)" status, so that handler was deliberately left untouched.
 * This function uses the one mechanism the docs confirm unambiguously instead.
 *
 * Alerting is Encounter-ID only — no patient_email/PHI — per MDI's explicit guidance.
 *
 * Env vars (all optional):
 *   MDI_APPROVAL_CHECK_STATUSES   comma-separated MDI case statuses to scan
 *                                 (default: "Assigned,Waiting" — the documented values
 *                                 are Created, Assigned, Waiting, Cancelled, Support,
 *                                 Processing, Completed)
 *   MDI_APPROVAL_CHECK_PER_PAGE   not applicable — the endpoint is not paginated in the
 *                                 documented payload; left as a hook for future use
 *   N8N_WEBHOOK_URL               reused from the rest of the codebase for the alert
 *
 * Schedule: configured in netlify.toml (not env-configurable — Netlify's CommonJS
 * function format only supports a static `schedule` in netlify.toml, see AGENTS.md).
 *
 * GET /.netlify/functions/checkAdditionalApprovals — can also be triggered manually.
 */

const { mdiRequest } = require('./lib/mdi-client');
const { getStore } = require('@netlify/blobs');

const DEFAULT_STATUSES = ['Assigned', 'Waiting'];
const ALERT_STORE = 'mdi-approval-alerts';

function statusesToCheck() {
  const raw = process.env.MDI_APPROVAL_CHECK_STATUSES;
  if (!raw) return DEFAULT_STATUSES;
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_STATUSES;
}

exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json' };
  const statuses = statusesToCheck();
  const store = getStore(ALERT_STORE);

  const found = [];
  const errors = [];

  for (const status of statuses) {
    try {
      const res = await mdiRequest('POST', '/v1/partner/cases/status/' + encodeURIComponent(status), {
        is_additional_approval_needed: true,
        sort: 'desc'
      });
      const cases = Array.isArray(res) ? res : (res && (res.data || res.cases)) || [];
      for (const c of cases) {
        const caseId = c && (c.case_id || c.id);
        if (caseId) found.push({ caseId, status });
      }
    } catch (e) {
      console.error(`[APPROVAL CHECK] Failed to query status "${status}":`, e.message);
      errors.push(status + ': ' + e.message);
    }
  }

  const newlyAlerted = [];
  for (const { caseId, status } of found) {
    let already = false;
    try { already = Boolean(await store.get(caseId)); } catch { /* treat as not-yet-alerted */ }
    if (already) continue;

    await alertOps(caseId, status);
    try { await store.set(caseId, JSON.stringify({ status, alerted_at: new Date().toISOString() })); }
    catch (e) { console.warn('[APPROVAL CHECK] Failed to record alert (non-critical):', e.message); }
    newlyAlerted.push(caseId);
  }

  console.log(`[APPROVAL CHECK] Scanned statuses [${statuses.join(', ')}] — found ${found.length} case(s) needing approval, ${newlyAlerted.length} newly alerted, ${errors.length} error(s)`);

  return {
    statusCode: errors.length && !found.length ? 500 : 200,
    headers,
    body: JSON.stringify({ statuses, found: found.length, newly_alerted: newlyAlerted, errors })
  };
};

/** Encounter-ID-only alert — no PHI. See file header. */
async function alertOps(caseId, status) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(`[APPROVAL CHECK] Case needs review (no N8N_WEBHOOK_URL to alert): ${caseId} (status: ${status})`);
    return;
  }
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'check_additional_approvals',
        event_type: 'mdi_case_needs_approval',
        severity: 'action_required',
        case_id: caseId,
        status,
        message: `Case ${caseId} is flagged is_additional_approval_needed — a doctor requested a treatment/titration change. Review in the MDI portal and move back to Assigned to proceed.`,
        timestamp: new Date().toISOString()
      })
    });
  } catch (e) {
    console.warn('[APPROVAL CHECK] Alert webhook failed (non-critical):', e.message);
  }
}
