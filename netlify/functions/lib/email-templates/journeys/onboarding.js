const { renderEmailShell, renderButton, renderStepTimeline, siteUrl, COLORS } = require('../shared');

/**
 * `onboarding` journey — enrolled right after a successful purchase (T1),
 * cancelled on cancellation/refund. Helps a new patient understand the
 * process and find their way around the Hub without waiting on a support
 * ticket.
 * @typedef {{ firstName?: string, unsubscribeUrl?: string }} Data
 */

/** @param {Data} data */
function step1({ firstName, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">What happens next</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:${COLORS.ink};">Here's the process from here:</p>
    ${renderStepTimeline([
      { title: 'Clinician review', detail: 'A licensed clinician reviews your intake, usually within 24–48 hours.' },
      { title: 'Pharmacy fulfillment', detail: "Once approved, your prescription is sent to our pharmacy partner." },
      { title: 'Shipped to your door', detail: "You'll get an email the moment it ships." }
    ])}
    ${renderButton('Check your status', siteUrl('/hub'))}
  `;
  return { subject: 'What happens next with your order', preheader: 'A quick look at the process ahead.', html: renderEmailShell({ preheader: 'A quick look at the process ahead.', bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

/** @param {Data} data */
function step2({ firstName, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Getting the most out of your Hub</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Your Freeley Hub is where everything lives: message your care team directly, track your order, and manage your billing &mdash; all in one place.
    </p>
    ${renderButton('Open your Hub', siteUrl('/hub'))}
  `;
  return { subject: 'How to use the Freeley Hub', preheader: 'Messages, tracking, and billing — all in one place.', html: renderEmailShell({ preheader: 'Messages, tracking, and billing — all in one place.', bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

/** @param {Data} data */
function step3({ firstName, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">How's it going so far?</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      We'd love to know how your first few weeks with Freeley have gone. If you have any questions for your care team, message them anytime from your Hub.
    </p>
    ${renderButton('Message your care team', siteUrl('/hub'))}
  `;
  return { subject: "How's it going?", preheader: 'Your care team is a message away.', html: renderEmailShell({ preheader: 'Your care team is a message away.', bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

module.exports = { step1, step2, step3 };
