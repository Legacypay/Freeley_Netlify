const test = require('node:test');
const assert = require('node:assert/strict');

const { nextCycleStartDate } = require('../../netlify/functions/lib/authnet-arb');

test('nextCycleStartDate advances by the given number of months, YYYY-MM-DD', () => {
  const now = new Date();
  const expected = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, now.getUTCDate()));
  const got = nextCycleStartDate(3);
  assert.match(got, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(got, expected.toISOString().slice(0, 10));
});

test('nextCycleStartDate(1) is one calendar month ahead, not ~30 days', () => {
  const got = nextCycleStartDate(1);
  const now = new Date();
  const expectedMonth = (now.getUTCMonth() + 1) % 12;
  const gotMonth = Number(got.slice(5, 7)) - 1;
  assert.equal(gotMonth, expectedMonth);
});
