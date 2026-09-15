const { renderEmailShell, renderButton, renderStatCard, siteUrl, COLORS } = require('./shared');

/** T9 — authnetWebhook.js ARB `authcapture.created`: the plan's recurring receipt. */
function render({ amount, cardLast4 }) {
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Your plan renewed</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      This is your receipt — your Freeley plan just renewed for another cycle.
    </p>
    ${renderStatCard([
      ['Amount charged', amount],
      ...(cardLast4 ? [['Card', `•••• ${cardLast4}`]] : [])
    ])}
    ${renderButton('View billing history', siteUrl('/hub'))}
    <p style="margin:0; font-size:13px; line-height:1.6; color:${COLORS.muted};">
      You can change or cancel your plan anytime from the Hub.
    </p>
  `;
  return {
    subject: 'Your Freeley plan renewed',
    preheader: 'Your receipt for this billing cycle.',
    html: renderEmailShell({ preheader: 'Your receipt for this billing cycle.', bodyHtml })
  };
}

module.exports = { render };
