const { renderEmailShell, renderButton, renderStatCard, siteUrl, COLORS } = require('./shared');

/**
 * T1 — sent right after an approved charge (create-authnet-transaction.js),
 * before the patient's medical intake is even complete. Deliberately says
 * "your order"/"your plan", never the specific product/medication — that
 * stays in MDI (see lib/email/phi-guard.js).
 *
 * @param {{ firstName?: string, productLabel: string, planMonths: number,
 *   amount: string, cardLast4?: string, billingModel: 'subscription'|'one-time' }} data
 */
function render({ firstName, productLabel, planMonths, amount, cardLast4, billingModel }) {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const cadence = billingModel === 'subscription'
    ? `This plan renews automatically every ${planMonths} month${planMonths === 1 ? '' : 's'} — you can change or cancel anytime from the Hub.`
    : `This is a one-time order — there's nothing else to pay unless you order again.`;
  const bodyHtml = `
    <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Your order is confirmed</h1>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">${greeting}</p>
    <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
      Thanks for choosing Freeley. Your payment went through and your care team has been notified. ${cadence}
    </p>
    ${renderStatCard([
      ['Plan', productLabel],
      ['Term', `${planMonths} month${planMonths === 1 ? '' : 's'}`],
      ['Amount charged', amount],
      ...(cardLast4 ? [['Card', `•••• ${cardLast4}`]] : [])
    ])}
    <p style="margin:0 0 4px; font-size:13px; line-height:1.6; color:${COLORS.muted};">
      Next: finish your quick medical intake so a licensed clinician can review your case. If you already completed it, you're all set — we'll email you the moment there's an update.
    </p>
    ${renderButton('Go to your Hub', siteUrl('/hub'))}
  `;
  return {
    subject: 'Your Freeley order is confirmed',
    preheader: 'Payment received — here is what happens next.',
    html: renderEmailShell({ preheader: 'Payment received — here is what happens next.', bodyHtml })
  };
}

module.exports = { render };
