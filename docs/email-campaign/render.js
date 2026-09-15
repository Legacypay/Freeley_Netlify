/**
 * Preview wrapper around the production campaign renderer
 * (netlify/functions/lib/email-templates/campaign-render.js) — same code path
 * that sends the `lead-nurture` and `patient-newsletter` journey steps, just
 * fed a fixed sample contact instead of a real one, so the PDF and the samples
 * show exactly what lands in an inbox.
 *
 * Used by scripts/build-campaign-pdf.js (mobile/desktop previews for every
 * email) and scripts/render-campaign-samples.js (the handful sent to a real
 * inbox). Both call renderCampaignEmail(emailDefinition, variant) — note that
 * is a different signature from campaign-render.js's own
 * renderCampaignEmail(id, data), which is the production one.
 */
const { renderCampaign, EMAILS } = require('../../netlify/functions/lib/email-templates/campaign-render');
const { SITE } = require('./flow');

const SAMPLE = {
  firstName: 'Samuel',
  vertical: 'weight loss',
  resumeUrl: `${SITE}/assessment-quiz`,
  unsubscribeUrl: `${SITE}/.netlify/functions/emailPreferences?sample=1`
};

/** Render one email (or one of its variants) with the sample contact. */
function renderCampaignEmail(e, variant = null) {
  return renderCampaign(e, variant, SAMPLE);
}

/** Render every email in the flow, one entry per variant. */
function renderAll() {
  const out = [];
  for (const e of EMAILS) {
    if (e.variants) for (const v of e.variants) out.push(renderCampaignEmail(e, v));
    else out.push(renderCampaignEmail(e));
  }
  return out;
}

module.exports = { renderCampaignEmail, renderAll, EMAILS, SAMPLE };
