const { renderEmailShell, renderButton, COLORS } = require('../shared');

/**
 * `checkout-abandoned` journey — enrolled from captureLead.js when the
 * checkout page's email field loses focus (src/pages/checkout.astro),
 * cancelled the moment a purchase actually completes.
 * @typedef {{ firstName?: string, resumeUrl: string, unsubscribeUrl?: string }} Data
 */

/** @param {Data} data */
function step1({ firstName, resumeUrl, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">You're one step from starting</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      You were almost done checking out with Freeley. Your cart is still saved — pick up right where you left off.
    </p>
    ${renderButton('Return to checkout', resumeUrl)}
  `;
  return { subject: "You're one step from starting", preheader: 'Your cart is still saved — finish in under a minute.', html: renderEmailShell({ preheader: 'Your cart is still saved — finish in under a minute.', bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

/** @param {Data} data */
function step2({ firstName, resumeUrl, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Questions before you start?</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Every Freeley order is reviewed by a licensed clinician before it ships, and you can cancel anytime from your Hub &mdash; no long-term commitment required.
    </p>
    ${renderButton('Return to checkout', resumeUrl)}
    <p style="margin:0; font-size:13px; line-height:1.6; color:${COLORS.muted};">
      Not sure this is right for you? Just reply to this email and we'll help.
    </p>
  `;
  return { subject: 'Questions before you start?', preheader: 'No long-term commitment — cancel anytime from your Hub.', html: renderEmailShell({ preheader: 'No long-term commitment — cancel anytime from your Hub.', bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

/** @param {Data} data */
function step3({ firstName, resumeUrl, unsubscribeUrl }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">We saved your cart</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      This is our last reminder — your cart is still ready whenever you are.
    </p>
    ${renderButton('Return to checkout', resumeUrl)}
  `;
  return { subject: 'Your cart is still here', preheader: 'One click to pick up where you left off.', html: renderEmailShell({ preheader: 'One click to pick up where you left off.', bodyHtml, kind: 'marketing', unsubscribeUrl }) };
}

module.exports = { step1, step2, step3 };
