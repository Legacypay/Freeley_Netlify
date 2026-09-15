const { renderEmailShell, renderButton, COLORS } = require('./shared');

/**
 * T6 — mdiWebhook.js `message_created` from a human sender (clinician/
 * support). Message content is PHI and is never included — points the
 * patient to the Hub's own messaging, not MDI's portal.
 */
function render({ firstName }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">You have a new message</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Your care team sent you a message. Sign in to your Hub to read and reply.
    </p>
    ${renderButton('Read your message', 'https://freeley.com/hub')}
  `;
  return {
    subject: 'You have a new message from your care team',
    preheader: 'Your care team sent you a message in the Hub.',
    html: renderEmailShell({ preheader: 'Your care team sent you a message in the Hub.', bodyHtml })
  };
}

module.exports = { render };
