const test = require('node:test');
const assert = require('node:assert/strict');

const { findPhi, assertNoPhi } = require('../../netlify/functions/lib/email/phi-guard');

test('clean patient-lifecycle copy passes with no hits', () => {
  const samples = [
    'Your order is confirmed and on its way.',
    'Your clinician has a question about your treatment.',
    'Thanks for choosing Freeley for your weight loss journey.',
    'Your prescription is ready and on its way!',
    'Take the assessment to see if sexual wellness treatment is right for you.',
    'Your longevity plan renewed today.',
    '<p>Complete your intake in about 2 minutes.</p>'
  ];
  for (const s of samples) {
    assert.deepEqual(findPhi(s), [], `expected no PHI hits in: ${s}`);
  }
});

test('flags a specific medication name pulled from the product catalog', () => {
  assert.ok(findPhi('Your semaglutide prescription has been approved').length > 0);
  assert.ok(findPhi('Minoxidil and finasteride are on the way').length > 0);
});

test('flags a dosage pattern even without a drug name', () => {
  assert.ok(findPhi('Take 5mg once daily').length > 0);
  assert.ok(findPhi('Your dose is 0.4 mg weekly').length > 0);
});

test('assertNoPhi returns false (and does not throw) on flagged content', () => {
  assert.equal(assertNoPhi('Contains tirzepatide', 'test-template'), false);
});

test('assertNoPhi returns true on clean content', () => {
  assert.equal(assertNoPhi('Your order is confirmed.', 'test-template'), true);
});
