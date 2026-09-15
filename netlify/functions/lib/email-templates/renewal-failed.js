const { renderEmailShell, renderButton, siteUrl, COLORS } = require('./shared');

/** T10 — authnetWebhook.js `net.authorize.customer.subscription.suspended`. */
function render({ firstName }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Your renewal payment didn't go through</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      We tried to charge your card for your next Freeley cycle and it didn't go through. Your plan is paused until this is resolved — update your payment method to keep it active.
    </p>
    ${renderButton('Update payment method', siteUrl('/hub'))}
  `;
  return {
    subject: "Your renewal payment didn't go through",
    preheader: 'Update your payment method to keep your plan active.',
    html: renderEmailShell({ preheader: 'Update your payment method to keep your plan active.', bodyHtml })
  };
}

module.exports = { render };
