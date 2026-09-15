const { renderEmailShell, renderButton, COLORS, siteUrl } = require('../shared');

/**
 * `browse-abandoned` journey — enrolled from captureLead.js when the
 * exit-intent modal (public/exit-intent.js) captures an email. No name is
 * collected at that point, so these always use the generic greeting.
 * @typedef {{ resumeUrl?: string, unsubscribeUrl?: string }} Data
 */

/** @param {Data} data */
function step1({ resumeUrl, unsubscribeUrl }) {
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Here's what you were looking at</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">Hi there,</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Freeley connects you with a licensed clinician online, so you can get physician-guided treatment without ever leaving home. Here's how it works, in three steps: take a 2-minute assessment, a clinician reviews your case, and if approved, treatment ships to your door.
    </p>
    ${renderButton('See how it works', resumeUrl || siteUrl('/how-it-works'))}
  `;
  return { subject: "Here's what you asked for", preheader: 'How Freeley works, in three simple steps.', html: renderEmailShell({ preheader: 'How Freeley works, in three simple steps.', bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

/** @param {Data} data */
function step2({ resumeUrl, unsubscribeUrl }) {
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Ready when you are</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">Hi there,</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      The Freeley assessment takes about 2 minutes and there's no obligation to continue afterward &mdash; it's simply the first step to see what a licensed clinician recommends for you.
    </p>
    ${renderButton('Take the assessment', resumeUrl || siteUrl('/assessment-quiz'))}
  `;
  return { subject: 'Take the 2-minute assessment', preheader: 'No obligation — just a quick first step.', html: renderEmailShell({ preheader: 'No obligation — just a quick first step.', bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

module.exports = { step1, step2 };
