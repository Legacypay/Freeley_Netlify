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
  'winback-2': { firstName: 'Jane', unsubscribeUrl: UNSUB }
};

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

test('marketing templates carry the unsubscribe link; transactional templates never do', () => {
  const marketing = TEMPLATES['onboarding-1']({ firstName: 'Jane', unsubscribeUrl: UNSUB });
  assert.match(marketing.html, /Unsubscribe/);
  assert.match(marketing.html, new RegExp(UNSUB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const transactional = TEMPLATES['order-confirmed'](DATA_BY_TEMPLATE['order-confirmed']);
  assert.doesNotMatch(transactional.html, /Unsubscribe/);
});
