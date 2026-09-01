const test = require('node:test');
const assert = require('node:assert/strict');

const { generateTempPassword } = require('../../netlify/functions/lib/hub-account');
const { renderHubWelcomeEmail } = require('../../netlify/functions/lib/email-templates/hub-welcome');
const { renderEmailShell, renderButton } = require('../../netlify/functions/lib/email-templates/shared');

test('generateTempPassword is 12 chars, unambiguous alphabet, varies per call', () => {
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    const pw = generateTempPassword();
    assert.equal(pw.length, 12);
    assert.match(pw, /^[ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]{12}$/);
    seen.add(pw);
  }
  assert.equal(seen.size, 20); // no collisions in 20 draws from a 12-char space
});

test('renderHubWelcomeEmail embeds the email, password and hub link, never the literal word undefined', () => {
  const html = renderHubWelcomeEmail({ firstName: 'Jane', email: 'jane@example.com', password: 'Ab3dEfGhJk9m', hubUrl: 'https://freeley.com/hub' });
  assert.match(html, /jane@example\.com/);
  assert.match(html, /Ab3dEfGhJk9m/);
  assert.match(html, /https:\/\/freeley\.com\/hub/);
  assert.match(html, /Hi Jane,/);
  assert.doesNotMatch(html, /undefined/);
});

test('renderHubWelcomeEmail falls back to a generic greeting without a first name', () => {
  const html = renderHubWelcomeEmail({ email: 'a@b.co', password: 'x'.repeat(12), hubUrl: 'https://freeley.com/hub' });
  assert.match(html, /Hi there,/);
});

test('renderEmailShell produces a full HTML document with the logo and preheader', () => {
  const html = renderEmailShell({ preheader: 'peek text', bodyHtml: '<p>hello</p>' });
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /freeley_logo_primary\.png/);
  assert.match(html, /peek text/);
  assert.match(html, /<p>hello<\/p>/);
});

test('renderButton keeps Supabase template variables intact (not treated as JS interpolation)', () => {
  const html = renderButton('Sign in', '{{ .ConfirmationURL }}');
  assert.match(html, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(html, />Sign in</);
});
