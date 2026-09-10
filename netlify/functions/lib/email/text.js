/**
 * Minimal HTML→plain-text conversion for the `text` alternative part of an
 * outbound email. Not a general-purpose HTML parser — it only has to handle
 * the small, controlled set of tags our own templates emit (see
 * lib/email-templates/shared.js): headings, paragraphs, tables-as-layout,
 * anchors, line breaks. Good enough to make the plain-text part readable
 * (helps deliverability/spam scoring) without pulling in a dependency.
 */
function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
      const text = label.replace(/<[^>]+>/g, '').trim();
      return href && text && href !== text ? `${text} (${href})` : (text || href);
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&middot;/gi, '·')
    .replace(/&mdash;/gi, '—')
    .replace(/&rsquo;/gi, '’')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { htmlToText };
