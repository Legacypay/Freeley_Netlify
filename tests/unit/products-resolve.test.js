// Unit tests for resolveProductKey/computeAge in netlify/functions/lib/products.js
// — the clinical/business rules that map a coarse vertical key ('hair-loss',
// 'longevity', …) onto a specific MDI offering. Run with `npm run test:unit`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { resolveProductKey, computeAge, PRODUCTS } =
  require(path.join(__dirname, '..', '..', 'netlify', 'functions', 'lib', 'products'));

/** ISO date-of-birth for someone who is exactly `years` old today. */
function dobForAge(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() - 1); // clear of same-day/leap-day edges
  return d.toISOString().slice(0, 10);
}

// ── Hair loss: Cedar (men) / Ivy (women 45+) / Willow (women <45) ──
test('hair-loss male → hair-men (Cedar)', () => {
  assert.equal(resolveProductKey('hair-loss', { sex: 'Male' }), 'hair-men');
  assert.equal(resolveProductKey('hair-loss', { sex: '1' }), 'hair-men');
});

test('hair-loss female age 30 → hair-women-under45 (Willow)', () => {
  assert.equal(
    resolveProductKey('hair-loss', { sex: 'Female', dateOfBirth: dobForAge(30) }),
    'hair-women-under45'
  );
});

test('hair-loss female age 50 → hair-women-45plus (Ivy)', () => {
  assert.equal(
    resolveProductKey('hair-loss', { sex: 'Female', dateOfBirth: dobForAge(50) }),
    'hair-women-45plus'
  );
});

test('hair-loss female with no DOB → hair-women-45plus (conservative default)', () => {
  assert.equal(resolveProductKey('hair-loss', { sex: '2' }), 'hair-women-45plus');
  assert.equal(
    resolveProductKey('hair-loss', { sex: 'Female', dateOfBirth: 'not-a-date' }),
    'hair-women-45plus'
  );
});

test('hair-loss never resolves to the FDA-held or duplicate offerings', () => {
  const cases = [
    {},
    { sex: 'Female' },
    { sex: '9' },
    { sex: 'Female', dateOfBirth: dobForAge(20) }
  ];
  for (const ctx of cases) {
    const key = resolveProductKey('hair-loss', ctx);
    assert.notEqual(key, 'hair-topical');
    assert.notEqual(key, 'hair-biotin-fin-min');
    assert.equal(PRODUCTS[key].category, 'hair-loss');
  }
});

// ── Weight loss ──
test('weight-loss + compound tirz → tirzepatide-t1', () => {
  assert.equal(resolveProductKey('weight-loss', { compound: 'tirz' }), 'tirzepatide-t1');
  assert.equal(resolveProductKey('weight-loss', { compound: 'Tirzepatide' }), 'tirzepatide-t1');
});

test('weight-loss + compound semaglutide (or missing) → semaglutide-s1', () => {
  assert.equal(resolveProductKey('weight-loss', { compound: 'semaglutide' }), 'semaglutide-s1');
  assert.equal(resolveProductKey('weight-loss', {}), 'semaglutide-s1');
});

test('weight-loss still honors the dose tier tables', () => {
  assert.equal(resolveProductKey('weight-loss', { compound: 'semaglutide', dose: 0.9 }), 'semaglutide-s3');
  assert.equal(resolveProductKey('weight-loss', { compound: 'tirzepatide', dose: 7 }), 'tirzepatide-t3');
});

// ── Longevity ──
test('longevity with explicit compound nad → nad-plus', () => {
  assert.equal(resolveProductKey('longevity', { compound: 'nad' }), 'nad-plus');
  assert.equal(resolveProductKey('longevity', { compound: 'NAD+' }), 'nad-plus');
  assert.equal(resolveProductKey('longevity', { compound: 'sermorelin-oral' }), 'sermorelin-troche');
  assert.equal(resolveProductKey('longevity', { compound: 'glutathione' }), 'glutathione-troche');
});

test('longevity with no compound → sermorelin-injectable (assumed default)', () => {
  assert.equal(resolveProductKey('longevity', {}), 'sermorelin-injectable');
  assert.equal(resolveProductKey('longevity', { compound: 'standard' }), 'sermorelin-injectable');
  assert.equal(resolveProductKey('longevity', { compound: 'premium' }), 'nad-plus');
});

// ── Sexual wellness ──
test('sexual-wellness with explicit compound olympus-max → olympus-max', () => {
  assert.equal(resolveProductKey('sexual-wellness', { compound: 'olympus-max' }), 'olympus-max');
  assert.equal(resolveProductKey('sexual-wellness', { compound: 'tadalafil-prn' }), 'tadalafil-prn');
});

test('sexual-wellness with no compound → tadalafil-daily (assumed default)', () => {
  assert.equal(resolveProductKey('sexual-wellness', {}), 'tadalafil-daily');
  assert.equal(resolveProductKey('sexual-wellness', { compound: 'standard' }), 'tadalafil-daily');
  assert.equal(resolveProductKey('sexual-wellness', { compound: 'premium' }), 'olympus');
  assert.equal(resolveProductKey('ed', {}), 'tadalafil-daily');
});

// ── Legacy signature must keep working (tests/integration-check.js relies on it) ──
test('legacy bare-dose second argument still resolves tiers', () => {
  assert.equal(resolveProductKey('semaglutide', 0.4), 'semaglutide-s2');
  assert.equal(resolveProductKey('tirzepatide', 14), 'tirzepatide-t6');
  assert.equal(resolveProductKey('semaglutide'), 'semaglutide-s1');
  assert.equal(resolveProductKey('olympus-peak'), 'olympus-peak');
});

test('unknown productKey → null (unchanged legacy behavior)', () => {
  assert.equal(resolveProductKey('nonexistent'), null);
  assert.equal(resolveProductKey(''), null);
  assert.equal(resolveProductKey('nonexistent', { compound: 'olympus' }), null);
});

// ── computeAge ──
test('computeAge returns whole years, null when unusable', () => {
  assert.equal(computeAge(dobForAge(45)), 45);
  assert.equal(computeAge(dobForAge(18)), 18);
  assert.equal(computeAge(null), null);
  assert.equal(computeAge(''), null);
  assert.equal(computeAge('garbage'), null);
});
