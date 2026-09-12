#!/usr/bin/env node
/**
 * Writes a handful of the campaign-proposal emails as real HTML/text files so
 * they can be sent to a real inbox (via the Resend MCP or `resend` CLI) and
 * checked in Gmail/Outlook before anything is wired into the engine.
 *
 *   node scripts/render-campaign-samples.js [outDir] [ids…]
 *
 * Default ids are the six bespoke layouts — one per layout family — chosen to
 * answer "they all look the same". All rendering lives in
 * docs/email-campaign/render.js (shared with the PDF builder).
 */
const fs = require('fs');
const path = require('path');
const { renderCampaignEmail, EMAILS } = require('../docs/email-campaign/render');

const args = process.argv.slice(2);
const OUT = path.resolve(args[0] || path.join(__dirname, '..', 'docs', 'email-campaign', 'samples'));
const IDS = args.length > 1 ? args.slice(1) : ['A1', 'A4', 'A6', 'A9', 'A13', 'B3'];

const samples = IDS.map((id) => {
  const e = EMAILS.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown email id ${id}`);
  return renderCampaignEmail(e, e.variants ? e.variants[0] : null);
});

fs.mkdirSync(OUT, { recursive: true });
for (const s of samples) {
  fs.writeFileSync(path.join(OUT, `${s.id}.html`), s.html);
  fs.writeFileSync(path.join(OUT, `${s.id}.txt`), s.text);
}
fs.writeFileSync(path.join(OUT, 'samples.json'), JSON.stringify(samples.map(({ id, subject }) => ({ id, subject, html: `${id}.html`, text: `${id}.txt` })), null, 2));
console.log(`[campaign-samples] wrote ${samples.length} samples to ${OUT}`);
samples.forEach((s) => console.log(`  ${s.id.padEnd(16)} ${Math.round(s.html.length / 1024)} KB  "${s.subject}"`));
