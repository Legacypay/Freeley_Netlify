// Tiny DOM helpers shared across the hub page's client scripts.

export function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

export function escapeHtml(str: unknown): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only http(s) URLs may become an href — blocks javascript:/data: links coming from API data. */
export function safeHref(url: unknown): string {
  const s = String(url || '').trim();
  return /^https?:\/\//i.test(s) ? escapeHtml(s) : '';
}
