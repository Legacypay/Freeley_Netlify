const { renderCampaignEmail, EMAILS } = require('../campaign-render');

/**
 * `patient-newsletter` journey — "The Freeley Journal", 9 steps over the first
 * 90 days of treatment (`patient-newsletter-b1` … `-b9`). Enrolled right after
 * a successful purchase (create-authnet-transaction.js), cancelled on
 * cancellation/refund. It replaces the old three-step `onboarding` drip.
 *
 * Runs alongside the transactional emails (order confirmed, shipped, clinician
 * message, receipts), which are unchanged — this is the "how do I get the most
 * out of this" layer: first-week prep, side-effect playbook, habits, check-ins,
 * a refill heads-up, referral, 90-day review. No medication names or doses
 * anywhere in it (lib/email/phi-guard.js would refuse the send); treatment
 * specifics live in the Hub.
 *
 * B7's step is a fixed +45d from purchase, NOT the real ARB billing date, so
 * it names no date or amount — `refill-reminder` is the journey timed off
 * lib/authnet-arb.js's own nextCycleStartDate(). The steps are listed in
 * lib/email/journeys.js; the copy lives in docs/email-campaign/flow.js and is
 * rendered by ../campaign-render.js.
 * @typedef {{ firstName?: string, unsubscribeUrl?: string }} Data
 */

/** @type {Record<string, (data: Data) => {subject: string, preheader: string, html: string}>} */
const TEMPLATES = {};
for (const email of EMAILS) {
  if (email.track !== 'B') continue;
  TEMPLATES[`patient-newsletter-${email.id.toLowerCase()}`] = (data) => renderCampaignEmail(email.id, data);
}

module.exports = { TEMPLATES };
