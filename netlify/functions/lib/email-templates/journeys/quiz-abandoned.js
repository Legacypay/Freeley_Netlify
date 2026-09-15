const { renderEmailShell, renderButton, COLORS } = require('../shared');

/**
 * `quiz-abandoned` journey — enrolled from captureLead.js when the quiz's
 * own step-2 contact capture fires (public/quiz-scripts/asw.js), cancelled
 * the moment the quiz actually submits (submitQuiz.js) or a purchase
 * happens. `vertical` is the product line the visitor picked for
 * themselves in step 1 (weight loss / hair loss / sexual wellness /
 * longevity) — safe to mention in the body since it's their own stated
 * interest, not clinical information; never used in a subject line.
 * @typedef {{ firstName?: string, vertical?: string, resumeUrl: string, unsubscribeUrl?: string }} Data
 */

/** @param {Data} data */
function step1({ firstName, resumeUrl, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Your assessment is waiting</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      You started your Freeley assessment but didn't quite finish. It only takes about 2 minutes to complete, and a licensed clinician can't review your case until it's done.
    </p>
    ${renderButton('Finish my assessment', resumeUrl)}
  `;
  return { subject: 'Your assessment is waiting', preheader: 'Pick up right where you left off — it only takes 2 minutes.', html: renderEmailShell({ preheader: 'Pick up right where you left off — it only takes 2 minutes.', bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

/** @param {Data} data */
function step2({ firstName, vertical, resumeUrl, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const line = vertical
    ? `Thousands of patients have used Freeley's physician-guided care for ${vertical}, all from home — no waiting rooms, no awkward pharmacy counters.`
    : `Thousands of patients have used Freeley's physician-guided telehealth care, all from home — no waiting rooms, no awkward pharmacy counters.`;
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Why patients choose Freeley</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${line}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Every case is reviewed by a licensed clinician, and if you're a fit, treatment ships straight to your door.
    </p>
    ${renderButton('Continue my assessment', resumeUrl)}
  `;
  return { subject: 'Physician-guided care, from home', preheader: 'See why patients are choosing Freeley.', html: renderEmailShell({ preheader: 'See why patients are choosing Freeley.', bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

/** @param {Data} data */
function step3({ firstName, resumeUrl, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Still thinking it over?</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      A few things patients usually ask before finishing: is this safe? (Yes — every case is reviewed by a licensed clinician before anything ships.) What happens after I submit? (You'll hear back within 24&ndash;48 hours.) Can I cancel anytime? (Yes, always.)
    </p>
    ${renderButton('Finish my assessment', resumeUrl)}
    <p style="margin:0; font-size:13px; line-height:1.6; color:${COLORS.muted};">
      Have a different question? Just reply to this email.
    </p>
  `;
  return { subject: 'Still thinking it over?', preheader: 'Answers to what patients ask before finishing.', html: renderEmailShell({ preheader: 'Answers to what patients ask before finishing.', bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

module.exports = { step1, step2, step3 };
