const { renderEmailShell, renderButton, COLORS } = require('../shared');

/**
 * `intake-reminder` journey — enrolled alongside T2 (complete-intake) right
 * after submitQuiz.js gets an onboarding_url; cancelled the moment MDI
 * reports the case actually exists (case_created / voucher_used in
 * mdiWebhook.js), since at that point the patient clearly used the link.
 * @typedef {{ firstName?: string, onboardingUrl: string, unsubscribeUrl?: string }} Data
 */

/** @param {Data} data */
function step1({ firstName, onboardingUrl, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Your doctor is waiting on your intake</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      A licensed clinician can't review your case until your short medical intake is complete. It only takes about 2 minutes.
    </p>
    ${renderButton('Complete your intake', onboardingUrl)}
  `;
  return { subject: 'Your doctor is waiting on your intake', preheader: 'Complete your 2-minute intake to keep things moving.', html: renderEmailShell({ preheader: 'Complete your 2-minute intake to keep things moving.', bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

/** @param {Data} data */
function step2({ firstName, onboardingUrl, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Don't lose your spot</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Your order is confirmed, but we still need your medical intake before a clinician can move forward. This is the last step.
    </p>
    ${renderButton('Complete your intake', onboardingUrl)}
  `;
  return { subject: "Don't lose your spot", preheader: 'One last step before a clinician can review your case.', html: renderEmailShell({ preheader: 'One last step before a clinician can review your case.', bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

module.exports = { step1, step2 };
