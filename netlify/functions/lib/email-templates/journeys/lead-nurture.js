const { renderCampaignEmail, EMAILS } = require('../campaign-render');

/**
 * `lead-nurture` journey — the 20-step top-of-funnel campaign, enrolled from
 * captureLead.js for `source:'quiz'` and `source:'exit-intent'` (and in bulk
 * by importLeadNurture.js for the waitlist). It replaces the old three-step
 * `quiz-abandoned`/`browse-abandoned` drips.
 *
 * Track A (`lead-nurture-a1` … `-a16`, days 0–30) is education then offer;
 * Track C (`lead-nurture-c1` … `-c4`, days 45–90) is re-engagement. They are
 * one journey rather than two because a purchase cancels the whole journey —
 * so "Track C only fires if Track A finished without a purchase" falls out for
 * free, with no on-complete chaining. The steps are listed in
 * lib/email/journeys.js; the copy lives in docs/email-campaign/flow.js and is
 * rendered by ../campaign-render.js.
 *
 * `vertical` is the product line the visitor picked for themselves in the quiz
 * (weight loss / hair loss / sexual wellness / longevity) — safe to mention in
 * the body since it's their own stated interest, not clinical information, and
 * never used in a subject line. A4 picks its variant from it and falls back to
 * the Weight loss version when it's missing (waitlist imports have none).
 * @typedef {{ firstName?: string, vertical?: string, resumeUrl?: string, unsubscribeUrl?: string }} Data
 */

/** @type {Record<string, (data: Data) => {subject: string, preheader: string, html: string}>} */
const TEMPLATES = {};
for (const email of EMAILS) {
  if (email.track !== 'A' && email.track !== 'C') continue;
  TEMPLATES[`lead-nurture-${email.id.toLowerCase()}`] = (data) => renderCampaignEmail(email.id, data);
}

module.exports = { TEMPLATES };
