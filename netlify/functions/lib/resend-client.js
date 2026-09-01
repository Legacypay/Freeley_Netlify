/**
 * Minimal Resend API client (plain fetch, no SDK dependency — matches this
 * repo's convention of not adding a package for a single HTTP call).
 *
 * Used ONLY for transactional emails our own code composes and sends
 * directly (currently: the post-checkout Hub welcome/temporary-password
 * email — see lib/hub-account.js). This is separate from, and does not
 * replace, Supabase Auth's own emails (magic link, signup confirmation,
 * password reset) — those are triggered by Supabase itself and merely
 * relayed through Resend once Resend is configured as Supabase's custom SMTP
 * provider (Authentication → Emails → SMTP Settings in the Supabase
 * dashboard, not something this codebase can configure via API).
 *
 * Required env var:
 *   RESEND_API_KEY   - from the Resend dashboard (Settings > API Keys)
 *   RESEND_FROM_EMAIL - e.g. "Freeley <no-reply@freeley.com>". Must be an
 *                        address on a domain verified in Resend, or every
 *                        send fails. Defaults to a freeley.com address that
 *                        MUST exist and be verified before relying on this.
 */

const DEFAULT_FROM = 'Freeley <no-reply@freeley.com>';

/**
 * @param {{ to: string, subject: string, html: string, replyTo?: string }} args
 * @returns {Promise<{ sent: boolean, id?: string, reason?: string }>} never throws
 */
async function sendResendEmail({ to, subject, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not set' };
  if (!to || !subject || !html) return { sent: false, reason: 'missing to/subject/html' };

  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  const body = { from, to, subject, html };
  if (replyTo) body.reply_to = replyTo;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    if (!res.ok) {
      console.warn('[RESEND] Send failed (' + res.status + '): ' + text.slice(0, 300));
      return { sent: false, reason: res.status + ' ' + text.slice(0, 200) };
    }
    let id;
    try { id = JSON.parse(text).id; } catch { /* ignore */ }
    return { sent: true, id };
  } catch (e) {
    console.warn('[RESEND] Send threw (non-critical):', e.message);
    return { sent: false, reason: e.message };
  }
}

module.exports = { sendResendEmail };
