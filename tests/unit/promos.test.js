const test = require('node:test');
const assert = require('node:assert/strict');
const { findPromo, discountCents, normalize } = require('../../netlify/functions/lib/promos');

test('normalize: trims, uppercases, strips junk', () => {
  assert.equal(normalize('  welcome10 '), 'WELCOME10');
  assert.equal(normalize('we lc<ome>10'), 'WELCOME10');
  assert.equal(normalize(null), '');
});

test('unknown / empty codes are null', () => {
  assert.equal(findPromo('NOPE-NOT-A-CODE'), null);
  assert.equal(findPromo(''), null);
  assert.equal(findPromo('_note'), null); // the JSON comment key is not a promo
});

test('percent and amount discounts, floored at $1 total', () => {
  const pct = { code: 'X', type: 'percent', value: 10 };
  const amt = { code: 'Y', type: 'amount', value: 50 };
  assert.equal(discountCents(pct, 22500), 2250);
  assert.equal(discountCents(amt, 22500), 5000);
  assert.equal(discountCents(amt, 3000), 2900);   // $30 - $50 → charge $1, not $0
  assert.equal(discountCents(null, 22500), 0);
});
