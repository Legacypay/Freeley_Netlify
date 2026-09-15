const test = require('node:test');
const assert = require('node:assert/strict');

const { TEMPLATES } = require('../../netlify/functions/lib/email-templates');
const { assertNoPhi } = require('../../netlify/functions/lib/email/phi-guard');

const UNSUB = 'https://freeley.com/.netlify/functions/emailPreferences?e=a%40b.com&t=abc';

// One plausible data payload per registered template — every key in
// lib/email-templates/index.js's TEMPLATES map must have an entry here, or
// the "every template is covered" test below fails on purpose.
const DATA_BY_TEMPLATE = {
  'order-confirmed': { firstName: 'Jane', productLabel: 'Freeley Plan', planMonths: 3, amount: '$267.00', cardLast4: '4242', billingModel: 'subscription' },
  'complete-intake': { firstName: 'Jane', onboardingUrl: 'https://onboard.example/abc' },
  'case-waiting': { firstName: 'Jane' },
  'case-completed': { firstName: 'Jane' },
  'order-shipped': { firstName: 'Jane' },
  'clinician-message': { firstName: 'Jane' },
  'payment-failed': { firstName: 'Jane', retryUrl: 'https://freeley.com/checkout' },
  'refund-issued': { firstName: 'Jane', amount: '$89.00' },
  'renewal-charged': { amount: '$89.00', cardLast4: '4242' },
  'renewal-failed': { firstName: 'Jane' },
  'subscription-cancelled': { firstName: 'Jane' },
  'hub-welcome': { firstName: 'Jane', email: 'jane@example.com', password: 'Ab3dEfGhJk9m', hubUrl: 'https://freeley.com/hub' },
  'quiz-abandoned-1': { firstName: 'Jane', vertical: 'Weight Loss', resumeUrl: 'https://freeley.com/assessment-quiz', unsubscribeUrl: UNSUB },
  'quiz-abandoned-2': { firstName: 'Jane', vertical: 'Weight Loss', resumeUrl: 'https://freeley.com/assessment-quiz', unsubscribeUrl: UNSUB },
  'quiz-abandoned-3': { firstName: 'Jane', vertical: 'Weight Loss', resumeUrl: 'https://freeley.com/assessment-quiz', unsubscribeUrl: UNSUB },
  'checkout-abandoned-1': { firstName: 'Jane', resumeUrl: 'https://freeley.com/checkout', unsubscribeUrl: UNSUB },
  'checkout-abandoned-2': { firstName: 'Jane', resumeUrl: 'https://freeley.com/checkout', unsubscribeUrl: UNSUB },
  'checkout-abandoned-3': { firstName: 'Jane', resumeUrl: 'https://freeley.com/checkout', unsubscribeUrl: UNSUB },
  'browse-abandoned-1': { resumeUrl: 'https://freeley.com/how-it-works', unsubscribeUrl: UNSUB },
  'browse-abandoned-2': { resumeUrl: 'https://freeley.com/assessment-quiz', unsubscribeUrl: UNSUB },
  'intake-reminder-1': { firstName: 'Jane', onboardingUrl: 'https://onboard.example/abc', unsubscribeUrl: UNSUB },
  'intake-reminder-2': { firstName: 'Jane', onboardingUrl: 'https://onboard.example/abc', unsubscribeUrl: UNSUB },
  'onboarding-1': { firstName: 'Jane', unsubscribeUrl: UNSUB },
  'onboarding-2': { firstName: 'Jane', unsubscribeUrl: UNSUB },
  'onboarding-3': { firstName: 'Jane', unsubscribeUrl: UNSUB },
  'refill-reminder': { firstName: 'Jane', unsubscribeUrl: UNSUB },
  'winback-1': { firstName: 'Jane', unsubscribeUrl: UNSUB },
  'winback-2': { firstName: 'Jane', unsubscribeUrl: UNSUB },

  // The two campaign journeys (docs/email-campaign/flow.js, rendered by
  // lib/email-templates/campaign-render.js). Every step takes the same shape:
  // lead-nurture carries whatever captureLead.js captured (first name,
  // self-declared vertical, a resume link), patient-newsletter only a first
  // name. Both are deliberately thin — a waitlist import enrolls with `{}`,
  // so the "no undefined" assertion below is doing real work here.
  ...leadNurtureFixtures(),
  ...patientNewsletterFixtures()
};

function leadNurtureFixtures() {
  const data = { firstName: 'Jane', vertical: 'Weight Loss', resumeUrl: 'https://freeley.com/assessment-quiz', unsubscribeUrl: UNSUB };
  const out = {};
  for (let i = 1; i <= 16; i++) out[`lead-nurture-a${i}`] = data;
  for (let i = 1; i <= 4; i++) out[`lead-nurture-c${i}`] = data;
  return out;
}

function patientNewsletterFixtures() {
  const out = {};
  for (let i = 1; i <= 9; i++) out[`patient-newsletter-b${i}`] = { firstName: 'Jane', unsubscribeUrl: UNSUB };
  return out;
}

test('every registered template has a test data fixture', () => {
  assert.deepEqual(Object.keys(TEMPLATES).sort(), Object.keys(DATA_BY_TEMPLATE).sort());
});

for (const [name, render] of Object.entries(TEMPLATES)) {
  test(`template "${name}" renders a clean {subject, preheader, html}`, () => {
    const result = render(DATA_BY_TEMPLATE[name]);
    assert.equal(typeof result.subject, 'string');
    assert.ok(result.subject.length > 0);
    assert.equal(typeof result.html, 'string');
    assert.match(result.html, /<!doctype html>/i);
    assert.doesNotMatch(result.html, /undefined/, `"${name}" leaked the literal word undefined`);
    assert.doesNotMatch(result.subject, /undefined/);
    assert.equal(assertNoPhi(result.html, name), true, `"${name}" tripped the PHI guard`);
    // Subject lines never mention a specific vertical/product either.
    assert.doesNotMatch(result.subject.toLowerCase(), /weight loss|hair loss|sexual wellness|longevity/);
  });
}

test('order-confirmed omits the card row entirely (no stray label) when cardLast4 is absent', () => {
  const { html } = TEMPLATES['order-confirmed']({ firstName: 'Jane', productLabel: 'Plan', planMonths: 1, amount: '$89.00', billingModel: 'one-time' });
  assert.doesNotMatch(html, /undefined/);
  assert.doesNotMatch(html, />Card</);
});

test('refund-issued omits the amount stat card when amount is absent', () => {
  const { html } = TEMPLATES['refund-issued']({ firstName: 'Jane' });
  assert.doesNotMatch(html, /undefined/);
});

test('lead-nurture A4 picks the variant matching the lead, and falls back to weight loss', () => {
  const render = TEMPLATES['lead-nurture-a4'];
  const subjectFor = (vertical) => render({ vertical, unsubscribeUrl: UNSUB }).subject;

  const hair = render({ vertical: 'hair loss', unsubscribeUrl: UNSUB });
  assert.match(hair.html, /Reactivates dormant follicles/i);

  // Whatever casing/punctuation captureLead.js happened to receive.
  assert.equal(subjectFor('Hair Loss'), hair.subject);
  assert.equal(subjectFor('hair-loss'), hair.subject);

  // The strings the REAL quiz sends: public/quiz-scripts/asw.js forwards
  // src/pages/assessment-quiz.astro's step-1 option labels verbatim, and
  // comma-joins them for a multi-select. "Longevity & performance" matching
  // only by equality is what silently sent every longevity lead the GLP-1
  // email, so each of these is a regression guard, not a hypothetical.
  const longevity = render({ vertical: 'Longevity & performance', unsubscribeUrl: UNSUB });
  assert.match(longevity.html, /Cellular energy/i);
  assert.match(longevity.html, /Longevity · Day 5/);
  assert.doesNotMatch(longevity.html, /Weight loss · Day 5/);
  assert.equal(subjectFor('Longevity'), longevity.subject);

  assert.equal(subjectFor('Sexual wellness'), render({ vertical: 'Sexual wellness', unsubscribeUrl: UNSUB }).subject);
  // Multi-select: the first pick wins.
  assert.equal(subjectFor('Hair loss, Weight loss'), hair.subject);

  // A waitlist import knows nothing about the contact — no crash, no blank
  // email, no "undefined": the weight-loss version is the default.
  const unknown = render({ unsubscribeUrl: UNSUB });
  assert.equal(unknown.subject, subjectFor('Weight loss'));
  assert.doesNotMatch(unknown.html, /undefined/);
});

test('every campaign CTA is utm-tagged, and the signed preferences link never is', () => {
  const linksIn = (html) => [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  for (const [key, render] of Object.entries(TEMPLATES)) {
    if (!key.startsWith('lead-nurture-') && !key.startsWith('patient-newsletter-')) continue;
    const journey = key.startsWith('lead-nurture-') ? 'lead-nurture' : 'patient-newsletter';
    const { html } = render({ firstName: 'Jane', unsubscribeUrl: UNSUB });
    for (const url of linksIn(html)) {
      if (!url.startsWith('https://freeley.com')) continue;
      // The bare homepage link is renderEmailShell's own footer ("you have an
      // account at freeley.com"), outside the body addUtm rewrites. No
      // campaign CTA points at the bare homepage.
      if (url === 'https://freeley.com') continue;
      if (url.includes('/.netlify/functions/emailPreferences')) {
        // Its query string is HMAC-signed — appending to it must never happen.
        assert.doesNotMatch(url, /utm_source/, `"${key}" tagged the signed preferences link`);
        continue;
      }
      assert.match(url, /utm_source=email&utm_medium=campaign/, `"${key}" has an untagged link: ${url}`);
      assert.ok(url.includes(`utm_campaign=${journey}`), `"${key}" tagged the wrong journey: ${url}`);
    }
  }
});

test('C4 keeps its opt-in on the signed preferences link, not a bare /?keep=1', () => {
  const { html } = TEMPLATES['lead-nurture-c4']({ firstName: 'Jane', unsubscribeUrl: UNSUB });
  assert.match(html, new RegExp(UNSUB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '&keep=1'));
  assert.doesNotMatch(html, /freeley\.com\/\?keep=1/);
});

test('A6 puts the price-ladder explanation above the button, not below it', () => {
  const { html } = TEMPLATES['lead-nurture-a6']({ firstName: 'Jane', unsubscribeUrl: UNSUB });
  const explanation = html.indexOf('The longer the plan');
  const closer = html.indexOf('No insurance needed');
  const button = html.indexOf('See full pricing');
  assert.ok(explanation > 0 && closer > 0 && button > 0);
  assert.ok(explanation < closer, 'the explanation should precede "No insurance needed"');
  assert.ok(closer < button, 'both paragraphs should precede the CTA button');
  // The 24-month tier is still an unconfirmed placeholder in pricing.json, so
  // the table stops at 12 months and the copy must not name those figures.
  // $49 (hair) and $79 (longevity) are 24-month-only — they appear nowhere in
  // the 1/3/6/12 ladder, so their presence anywhere means the copy regressed.
  // ($59 is NOT checked: it is hair loss's real 12-month price in the table.)
  assert.doesNotMatch(html, /\$49\b|\$79\b/);
});

test('every campaign step renders with no name, vertical or resume link at all', () => {
  const campaignKeys = Object.keys(TEMPLATES).filter(k => k.startsWith('lead-nurture-') || k.startsWith('patient-newsletter-'));
  assert.equal(campaignKeys.length, 29);
  for (const key of campaignKeys) {
    const { subject, html } = TEMPLATES[key]({ unsubscribeUrl: UNSUB });
    assert.doesNotMatch(html, /undefined/, `"${key}" leaked undefined`);
    assert.doesNotMatch(html, /\{\{/, `"${key}" left an unresolved merge tag`);
    // flow.js's [PLACEHOLDER] / [CONFIRM: …] notation must never reach an inbox.
    assert.doesNotMatch(html, /\[[A-Z][^\]]{6,}\]/, `"${key}" rendered a bracketed placeholder`);
    assert.match(html, /Hi there,/, `"${key}" lost its greeting fallback`);
    assert.ok(subject.length > 0);
  }
});

test('B7 promises no refill date or amount it cannot know', () => {
  const { html } = TEMPLATES['patient-newsletter-b7']({ firstName: 'Jane', unsubscribeUrl: UNSUB });
  // Its step is a fixed +45d from purchase, not the real ARB billing date.
  assert.doesNotMatch(html, /undefined/);
  assert.doesNotMatch(html, /\$\d/);
  assert.match(html, /scheduled to ship soon/);
});

test('marketing templates carry the unsubscribe link; transactional templates never do', () => {
  const marketing = TEMPLATES['onboarding-1']({ firstName: 'Jane', unsubscribeUrl: UNSUB });
  assert.match(marketing.html, /Unsubscribe/);
  assert.match(marketing.html, new RegExp(UNSUB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const transactional = TEMPLATES['order-confirmed'](DATA_BY_TEMPLATE['order-confirmed']);
  assert.doesNotMatch(transactional.html, /Unsubscribe/);
});
