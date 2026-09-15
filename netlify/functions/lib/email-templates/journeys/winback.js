const { renderEmailShell, renderButton, siteUrl, COLORS } = require('../shared');

/**
 * `winback` journey — enrolled when a subscription is cancelled or a
 * renewal fails without resolution; cancelled by a new purchase (T1).
 * @typedef {{ firstName?: string, unsubscribeUrl?: string }} Data
 */

/** @param {Data} data */
function step1({ firstName, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">We'd love to have you back</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      It's been a little while since your Freeley plan ended. If you're ready to pick back up, restarting takes just a couple of minutes.
    </p>
    ${renderButton('Restart my plan', siteUrl('/'))}
  `;
  return { subject: "We'd love to have you back", preheader: 'Restarting your plan takes just a couple of minutes.', html: renderEmailShell({ preheader: 'Restarting your plan takes just a couple of minutes.', bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

/** @param {Data} data */
function step2({ firstName, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Ready to restart?</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Whenever you're ready, Freeley is here &mdash; physician-guided care, from home, on your schedule.
    </p>
    ${renderButton('Get started again', siteUrl('/'))}
  `;
  return { subject: 'Ready to restart?', preheader: "We're here whenever you're ready.", html: renderEmailShell({ preheader: "We're here whenever you're ready.", bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

module.exports = { step1, step2 };
