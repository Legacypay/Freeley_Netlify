const { renderEmailShell, COLORS } = require('./shared');

/** T11 — cancelSubscription.js (patient-initiated) and authnetWebhook.js `.terminated`/`.cancelled`. */
function render({ firstName }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Your subscription has been cancelled</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      We've cancelled your Freeley plan as requested. You won't be charged again, and any remaining supply is still yours to keep.
    </p>
    <p style="margin:0; font-size:13px; line-height:1.6; color:${COLORS.muted};">
      Changed your mind? You're always welcome back — just visit freeley.com whenever you're ready.
    </p>
  `;
  return {
    subject: 'Your subscription has been cancelled',
    preheader: "We've cancelled your plan — you won't be charged again.",
    html: renderEmailShell({ preheader: "We've cancelled your plan — you won't be charged again.", bodyHtml })
  };
}

module.exports = { render };
