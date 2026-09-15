const { renderEmailShell, renderStatCard, COLORS } = require('./shared');

/** T8 — stripeWebhook.js `charge.refunded`; authnetWebhook.js `refund.created`/`void.created`. */
function render({ firstName, amount }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Your refund is on its way</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      We've issued a refund to your original payment method. It typically takes 5&ndash;10 business days to appear on your statement, depending on your bank.
    </p>
    ${amount ? renderStatCard([['Amount refunded', amount]]) : ''}
    <p style="margin:0; font-size:13px; line-height:1.6; color:${COLORS.muted};">
      Questions about this refund? Just reply to this email.
    </p>
  `;
  return {
    subject: 'Your refund is on its way',
    preheader: "We've issued a refund to your original payment method.",
    html: renderEmailShell({ preheader: "We've issued a refund to your original payment method.", bodyHtml })
  };
}

module.exports = { render };
