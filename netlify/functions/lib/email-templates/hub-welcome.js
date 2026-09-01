const { renderEmailShell, renderButton, COLORS } = require('./shared');

/**
 * The "temporary password" fallback email — sent once, right after checkout,
 * alongside (not instead of) Supabase's own magic-link email. Exists because
 * a magic link can fail to arrive/open (corporate email scanners pre-fetching
 * and burning one-time links is the classic case) and the patient needs a
 * way in that doesn't depend on it.
 *
 * @param {{ firstName?: string, email: string, password: string, hubUrl: string }} args
 */
function renderHubWelcomeEmail({ firstName, email, password, hubUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Welcome to Freeley</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Your order is confirmed and your Freeley Health Hub account is ready. You'll also get a separate
      one-click sign-in link by email &mdash; if that link doesn't work for any reason, you can always sign in directly with:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 8px; background:${COLORS.card}; border-radius:14px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 6px; font-size:12px; text-transform:uppercase; letter-spacing:.5px; color:${COLORS.muted};">Email</p>
        <p style="margin:0 0 14px; font-size:15px; font-weight:600; color:${COLORS.ink};">${email}</p>
        <p style="margin:0 0 6px; font-size:12px; text-transform:uppercase; letter-spacing:.5px; color:${COLORS.muted};">Temporary password</p>
        <p style="margin:0; font-size:15px; font-weight:600; color:${COLORS.ink}; font-family:'SF Mono',Consolas,monospace; letter-spacing:.5px;">${password}</p>
      </tr></td>
    </table>
    <p style="margin:0 0 4px; font-size:13px; line-height:1.6; color:${COLORS.muted};">
      You can change this password anytime from inside the portal, under Account settings.
    </p>
    ${renderButton('Sign in to the Hub', hubUrl)}
    <p style="margin:0; font-size:13px; line-height:1.6; color:${COLORS.muted};">
      In the Hub you can track your order, message your care team, and view your treatment plan.
    </p>
  `;
  return renderEmailShell({
    preheader: 'Your Freeley Health Hub account is ready — sign-in details inside.',
    bodyHtml
  });
}

module.exports = { renderHubWelcomeEmail };
