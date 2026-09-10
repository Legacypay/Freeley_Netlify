const { renderEmailShell, renderButton, COLORS } = require('./shared');

/** T4 — mdiWebhook.js `case_completed`: pharmacy has confirmed the prescription. */
function render({ firstName }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Great news &mdash; you're all set</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Your prescription has been confirmed and sent to the pharmacy for fulfillment. We'll email you again the moment it ships.
    </p>
    ${renderButton('Track your order', 'https://freeley.com/hub')}
  `;
  return {
    subject: 'Your prescription is ready and on its way!',
    preheader: 'Your prescription has been confirmed by the pharmacy.',
    html: renderEmailShell({ preheader: 'Your prescription has been confirmed by the pharmacy.', bodyHtml })
  };
}

module.exports = { render };
