const { renderEmailShell, renderButton, COLORS } = require('./shared');

/** T7 — stripeWebhook.js `payment_intent.payment_failed`; authnetWebhook.js `fraud.declined`. */
function render({ firstName, retryUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">We couldn't process your payment</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Your card was declined and we weren't able to complete your order. No charge was made. Please try again with the same card or a different one.
    </p>
    ${renderButton('Try again', retryUrl || 'https://freeley.com/checkout')}
    <p style="margin:0; font-size:13px; line-height:1.6; color:${COLORS.muted};">
      Still having trouble? Reply to this email and we'll help you sort it out.
    </p>
  `;
  return {
    subject: "We couldn't process your payment",
    preheader: 'Your card was declined — no charge was made.',
    html: renderEmailShell({ preheader: 'Your card was declined — no charge was made.', bodyHtml })
  };
}

module.exports = { render };
