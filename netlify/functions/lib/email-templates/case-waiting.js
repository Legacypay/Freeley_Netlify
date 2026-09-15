const { renderEmailShell, renderButton, COLORS } = require('./shared');

/** T3 — mdiWebhook.js `case_waiting`: the clinician needs more info before proceeding. */
function render({ firstName }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Action needed</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Your clinician has a question about your case before they can move forward. Please check your Freeley Hub for details and respond when you can.
    </p>
    ${renderButton('View your Hub', 'https://freeley.com/hub')}
  `;
  return {
    subject: 'Action needed — your clinician has a question',
    preheader: 'Your clinician needs a bit more information from you.',
    html: renderEmailShell({ preheader: 'Your clinician needs a bit more information from you.', bodyHtml })
  };
}

module.exports = { render };
