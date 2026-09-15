const { renderEmailShell, renderButton, siteUrl, COLORS } = require('../shared');

/**
 * `refill-reminder` journey — a single template reused for every step. The
 * schedule isn't static (see lib/email/journeys.js) because it depends on
 * the purchased plan's own cadence (subscription renewal date, or a
 * one-time order's days-supply) — computed at enroll time in
 * create-authnet-transaction.js and passed as an explicit `steps` array.
 * @param {{ firstName?: string, unsubscribeUrl?: string }} data
 */
function render({ firstName, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Your next shipment is coming up</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Just a heads up &mdash; your next Freeley shipment is coming up soon. If you'd like to change your plan or pause anytime, you can do that from your Hub.
    </p>
    ${renderButton('Manage my plan', siteUrl('/hub'))}
  `;
  return { subject: 'Your next shipment is coming up', preheader: 'Manage your plan anytime from the Hub.', html: renderEmailShell({ preheader: 'Manage your plan anytime from the Hub.', bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

module.exports = { render };
