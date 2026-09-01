// Unit tests for netlify/functions/lib/authnet-arb.js.
//
// No network: the request BODY is what matters here. Authorize.Net's JSON
// endpoint maps straight onto its XML schema and rejects (E00003) any unknown
// element or out-of-order key, so these tests pin the exact element names and
// their order against AnetApiSchema.xsd (ARBSubscriptionType: name,
// paymentSchedule, amount, trialAmount, payment, order, customer, billTo,
// shipTo, profile).
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  ARB_MAX_INTERVAL_MONTHS,
  ARB_NO_END_DATE,
  buildCreateSubscriptionBody,
  createArbSubscriptionFromProfile,
  nextCycleStartDate
} = require('../../netlify/functions/lib/authnet-arb');

beforeEach(() => {
  process.env.AUTHNET_ENV = 'sandbox';
  process.env.AUTHNET_SANDBOX_API_LOGIN_ID = 'login';
  process.env.AUTHNET_SANDBOX_TRANSACTION_KEY = 'key';
});

// ── nextCycleStartDate ──────────────────────────────────────────────────────

test('nextCycleStartDate advances by calendar months, YYYY-MM-DD', () => {
  assert.equal(nextCycleStartDate(1, new Date('2026-09-02T12:00:00Z')), '2026-10-02');
  assert.equal(nextCycleStartDate(3, new Date('2026-09-02T12:00:00Z')), '2026-12-02');
  assert.equal(nextCycleStartDate(6, new Date('2026-09-02T12:00:00Z')), '2027-03-02');
  assert.equal(nextCycleStartDate(12, new Date('2026-09-02T12:00:00Z')), '2027-09-02');
});

test('nextCycleStartDate clamps to the last day of the target month instead of rolling over', () => {
  assert.equal(nextCycleStartDate(1, new Date('2026-01-31T12:00:00Z')), '2026-02-28');
  assert.equal(nextCycleStartDate(1, new Date('2028-01-31T12:00:00Z')), '2028-02-29'); // leap year
  assert.equal(nextCycleStartDate(1, new Date('2026-08-31T12:00:00Z')), '2026-09-30');
  assert.equal(nextCycleStartDate(3, new Date('2026-11-30T12:00:00Z')), '2027-02-28');
});

test('nextCycleStartDate defaults to now', () => {
  assert.match(nextCycleStartDate(1), /^\d{4}-\d{2}-\d{2}$/);
});

// ── buildCreateSubscriptionBody ─────────────────────────────────────────────

const args = {
  apiLoginId: 'login', transactionKey: 'key', refId: 'sub-1',
  customerProfileId: 123, customerPaymentProfileId: 456,
  intervalMonths: 6, startDate: '2027-03-02', amount: 390, planLabel: 'Hair Loss Treatment - 6mo'
};

test('uses the real root element ARBCreateSubscriptionRequest (there is no ...FromCustomerProfileRequest)', () => {
  const body = buildCreateSubscriptionBody(args);
  assert.deepEqual(Object.keys(body), ['ARBCreateSubscriptionRequest']);
  assert.equal(body.ARBCreateSubscriptionFromCustomerProfileRequest, undefined);
});

test('emits keys in XSD order and never sends payment/billTo/customer alongside profile', () => {
  const req = buildCreateSubscriptionBody(args).ARBCreateSubscriptionRequest;
  assert.deepEqual(Object.keys(req), ['merchantAuthentication', 'refId', 'subscription']);
  assert.deepEqual(Object.keys(req.subscription), ['name', 'paymentSchedule', 'amount', 'order', 'profile']);
  assert.deepEqual(Object.keys(req.subscription.paymentSchedule), ['interval', 'startDate', 'totalOccurrences']);
  assert.deepEqual(Object.keys(req.subscription.paymentSchedule.interval), ['length', 'unit']);
  assert.deepEqual(Object.keys(req.subscription.profile), ['customerProfileId', 'customerPaymentProfileId']);
});

test('schedule = every N months at the FULL plan price, open-ended, starting one interval out', () => {
  const sub = buildCreateSubscriptionBody(args).ARBCreateSubscriptionRequest.subscription;
  assert.deepEqual(sub.paymentSchedule.interval, { length: 6, unit: 'months' });
  assert.equal(sub.paymentSchedule.startDate, '2027-03-02');
  assert.equal(sub.paymentSchedule.totalOccurrences, ARB_NO_END_DATE);
  assert.equal(ARB_NO_END_DATE, 9999);
  assert.equal(sub.amount, 390);
  assert.equal(sub.profile.customerProfileId, '123'); // numericString → text
  assert.equal(sub.profile.customerPaymentProfileId, '456');
  assert.equal(sub.name, 'Freeley - Hair Loss Treatment - 6mo');
  assert.equal(sub.order.description, 'Hair Loss Treatment - 6mo');
});

test('respects schema max lengths (name 50, refId 50, description 255) and 2dp amounts', () => {
  const long = 'x'.repeat(400);
  const sub = buildCreateSubscriptionBody({ ...args, planLabel: long, refId: long, amount: 89.999 }).ARBCreateSubscriptionRequest;
  assert.equal(sub.refId.length, 50);
  assert.equal(sub.subscription.name.length, 50);
  assert.equal(sub.subscription.order.description.length, 255);
  assert.equal(sub.subscription.amount, 90);
});

// ── every checkout plan maps to what the patient was told ───────────────────

test('each plan renews at its own cadence and full term price (pricing.json × months)', () => {
  const pricing = require('../../pricing.json');
  const tier = pricing['hair-loss'].default; // {1:89, 3:75, 6:65, 12:59, 24:49}
  const expected = { 1: 89, 3: 225, 6: 390, 12: 708 };
  for (const [m, total] of Object.entries(expected)) {
    const months = Number(m);
    const sub = buildCreateSubscriptionBody({ ...args, intervalMonths: months, amount: tier[months] * months }).ARBCreateSubscriptionRequest.subscription;
    assert.equal(sub.amount, total, `${months}-month plan renews at $${total}`);
    assert.equal(sub.paymentSchedule.interval.length, months);
    assert.equal(sub.paymentSchedule.interval.unit, 'months');
  }
});

// ── createArbSubscriptionFromProfile guards (no network reached) ────────────

test('ARB max interval is 12 months; longer plans are refused before any request', async () => {
  assert.equal(ARB_MAX_INTERVAL_MONTHS, 12);
  const origFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('should not be called'); };
  try {
    const r = await createArbSubscriptionFromProfile({ customerProfileId: 1, customerPaymentProfileId: 2, intervalMonths: 24, amount: 1176, planLabel: 'x' });
    assert.equal(r.created, false);
    assert.match(r.reason, /interval-exceeds-arb-max/);
    assert.equal(called, false);
  } finally { global.fetch = origFetch; }
});

test('missing CIM profile / bad amount / bad interval are refused without a request', async () => {
  const origFetch = global.fetch;
  global.fetch = async () => { throw new Error('should not be called'); };
  try {
    assert.equal((await createArbSubscriptionFromProfile({ customerProfileId: null, customerPaymentProfileId: 2, intervalMonths: 1, amount: 89, planLabel: 'x' })).reason, 'no-cim-profile');
    assert.match((await createArbSubscriptionFromProfile({ customerProfileId: 1, customerPaymentProfileId: 2, intervalMonths: 1, amount: 0, planLabel: 'x' })).reason, /invalid-amount/);
    assert.match((await createArbSubscriptionFromProfile({ customerProfileId: 1, customerPaymentProfileId: 2, intervalMonths: 0, amount: 89, planLabel: 'x' })).reason, /invalid-interval/);
  } finally { global.fetch = origFetch; }
});

test('a gateway error becomes { created:false, reason } and never throws', async () => {
  const origFetch = global.fetch;
  global.fetch = async () => ({ text: async () => '﻿' + JSON.stringify({ messages: { resultCode: 'Error', message: [{ code: 'E00007', text: 'User authentication failed' }] } }) });
  try {
    const r = await createArbSubscriptionFromProfile({ customerProfileId: 1, customerPaymentProfileId: 2, intervalMonths: 1, amount: 89, planLabel: 'x' });
    assert.deepEqual(r, { created: false, reason: 'E00007: User authentication failed' });
  } finally { global.fetch = origFetch; }
});

test('a successful create returns the subscriptionId as a string plus the first renewal date', async () => {
  const origFetch = global.fetch;
  let sent;
  global.fetch = async (_url, opts) => { sent = JSON.parse(opts.body); return { text: async () => JSON.stringify({ subscriptionId: 987654, messages: { resultCode: 'Ok', message: [{ code: 'I00001', text: 'Successful.' }] } }) }; };
  try {
    const r = await createArbSubscriptionFromProfile({ customerProfileId: 1, customerPaymentProfileId: 2, intervalMonths: 3, amount: 225, planLabel: 'Hair Loss Treatment - 3mo' });
    assert.equal(r.created, true);
    assert.equal(r.subscriptionId, '987654');
    assert.equal(r.startDate, nextCycleStartDate(3));
    assert.equal(sent.ARBCreateSubscriptionRequest.subscription.amount, 225);
    assert.equal(sent.ARBCreateSubscriptionRequest.subscription.paymentSchedule.startDate, nextCycleStartDate(3));
  } finally { global.fetch = origFetch; }
});
