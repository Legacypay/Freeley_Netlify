/**
 * Netlify Function: emailPreferences
 *
 * The landing page behind every marketing/journey email's unsubscribe link
 * (lib/email/unsubscribe.js builds the URL). Stateless auth: the HMAC token
 * in the query string IS the credential — no login, no lookup needed to
 * prove the request is legitimate for that one address.
 *
 * GET  /.netlify/functions/emailPreferences?e=<email>&t=<token>  → confirmation page
 * POST same query string                                         → actually unsubscribes
 */

const { connectBlobs } = require('./lib/blobs');
const { verifyToken } = require('./lib/email/unsubscribe');
const { suppress } = require('./lib/email/engine');
const { renderEmailShell, COLORS } = require('./lib/email-templates/shared');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function page(bodyHtml) {
  return renderEmailShell({ bodyHtml });
}

exports.handler = async (event) => {
  connectBlobs(event);
  const params = event.queryStringParameters || {};
  const email = params.e || '';
  const token = params.t || '';
  const headers = { 'Content-Type': 'text/html; charset=utf-8' };

  if (!verifyToken(email, token)) {
    return {
      statusCode: 400,
      headers,
      body: page(`
        <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">This link has expired</h1>
        <p style="margin:0; font-size:15px; line-height:1.6; color:${COLORS.ink};">This unsubscribe link is invalid or out of date. If you'd still like to stop receiving emails from Freeley, please contact support.</p>
      `)
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      await suppress(email, 'unsubscribed');
    } catch (e) {
      console.error('[EMAIL PREFERENCES] suppress failed:', e.message);
      return {
        statusCode: 500,
        headers,
        body: page(`<h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Something went wrong</h1><p style="margin:0; font-size:15px; line-height:1.6; color:${COLORS.ink};">Please try again in a moment.</p>`)
      };
    }
    return {
      statusCode: 200,
      headers,
      body: page(`
        <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">You're unsubscribed</h1>
        <p style="margin:0; font-size:15px; line-height:1.6; color:${COLORS.ink};"><strong>${escapeHtml(email)}</strong> won't receive marketing emails from Freeley anymore. Order updates and account emails will still be delivered.</p>
      `)
    };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const qs = `e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`;
  return {
    statusCode: 200,
    headers,
    body: page(`
      <h1 style="margin:0 0 16px; font-family:Georgia,'Source Serif 4',serif; font-size:24px; font-weight:600; color:${COLORS.ink};">Unsubscribe from Freeley emails</h1>
      <p style="margin:0 0 20px; font-size:15px; line-height:1.6; color:${COLORS.ink};">
        Confirm below to stop marketing emails to <strong>${escapeHtml(email)}</strong>. You'll still receive order updates and account emails.
      </p>
      <form method="POST" action="/.netlify/functions/emailPreferences?${qs}">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;"><tr><td align="center" style="border-radius:999px; background:${COLORS.green};">
          <button type="submit" style="display:inline-block; padding:15px 32px; font-size:15px; font-weight:600; color:#ffffff; background:transparent; border:none; border-radius:999px; cursor:pointer; font-family:-apple-system,'Archivo',Helvetica,Arial,sans-serif;">Unsubscribe</button>
        </td></tr></table>
      </form>
    `)
  };
};
