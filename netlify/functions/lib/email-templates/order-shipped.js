const { renderEmailShell, renderButton, COLORS } = require('./shared');

/**
 * T5 — mdiWebhook.js `order_tracking_number_changed`. Tracking number/carrier
 * are deliberately NOT included here (mirrors the internal Slack
 * notification for the same event) — full detail lives in the Hub, behind
 * the patient's own login.
 */
function render({ firstName }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Your order has shipped</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Good news — your order is on its way. You can see tracking details anytime from your Hub.
    </p>
    ${renderButton('View tracking', 'https://freeley.com/hub')}
  `;
  return {
    subject: 'Your order has shipped!',
    preheader: 'Your order is on its way — tracking is in your Hub.',
    html: renderEmailShell({ preheader: 'Your order is on its way — tracking is in your Hub.', bodyHtml })
  };
}

module.exports = { render };
