const { renderEmailShell, renderButton, COLORS } = require('./shared');

/**
 * T2 — sent right after submitQuiz.js gets an onboarding_url back from MDI.
 * This is the ONLY copy of that link the patient reliably keeps — the
 * checkout flow only ever put it in sessionStorage, so closing the tab
 * before redirect loses it entirely. See docs/EMAIL_FLOWS.md.
 *
 * @param {{ firstName?: string, onboardingUrl: string }} data
 */
function render({ firstName, onboardingUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">One last step</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Your information has been submitted for physician review. Before a licensed clinician can evaluate your case, please complete your short medical intake — it takes about 2 minutes.
    </p>
    ${renderButton('Complete your intake', onboardingUrl)}
    <p style="margin:0; font-size:13px; line-height:1.6; color:${COLORS.muted};">
      Save this email — this link is the fastest way back if you need to finish later.
    </p>
  `;
  return {
    subject: 'One last step: complete your medical intake',
    preheader: 'Finish your 2-minute intake so a clinician can review your case.',
    html: renderEmailShell({ preheader: 'Finish your 2-minute intake so a clinician can review your case.', bodyHtml })
  };
}

module.exports = { render };
