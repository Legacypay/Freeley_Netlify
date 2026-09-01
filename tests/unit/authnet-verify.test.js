const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { verifyAuthnetTransaction } = require('../../netlify/functions/lib/authnet-verify');

beforeEach(() => {
  process.env.AUTHNET_ENV = 'sandbox';
  process.env.AUTHNET_SANDBOX_API_LOGIN_ID = 'login';
  process.env.AUTHNET_SANDBOX_TRANSACTION_KEY = 'key';
  delete process.env.AUTHNET_SIMULATE;
  delete process.env.CONTEXT;
});

const gateway = (json) => async () => ({ text: async () => '﻿' + JSON.stringify(json) });
const okMsg = { resultCode: 'Ok', message: [{ code: 'I00001', text: 'Successful.' }] };

test('missing / malformed ids are rejected before any network call', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; };
  assert.equal((await verifyAuthnetTransaction('', { fetchImpl })).ok, false);
  assert.equal((await verifyAuthnetTransaction('abc', { fetchImpl })).ok, false);
  assert.equal((await verifyAuthnetTransaction("1; drop", { fetchImpl })).ok, false);
  assert.equal(called, false);
});

test('SIM- ids are accepted only while AUTHNET_SIMULATE is in effect', async () => {
  const fetchImpl = async () => { throw new Error('no network expected'); };
  assert.equal((await verifyAuthnetTransaction('SIM-1756760000000', { fetchImpl })).ok, false);
  process.env.AUTHNET_SIMULATE = 'true';
  assert.equal((await verifyAuthnetTransaction('SIM-1756760000000', { fetchImpl })).ok, true);
});

test('AUTHNET_SIMULATE is ignored on the production deploy context in production mode', async () => {
  process.env.AUTHNET_SIMULATE = 'true';
  process.env.AUTHNET_ENV = 'production';
  process.env.AUTHNET_LIVE_API_LOGIN_ID = 'l';
  process.env.AUTHNET_LIVE_TRANSACTION_KEY = 'k';
  process.env.CONTEXT = 'production';
  const fetchImpl = async () => { throw new Error('no network expected'); };
  assert.equal((await verifyAuthnetTransaction('SIM-1', { fetchImpl })).ok, false);
  process.env.CONTEXT = 'deploy-preview';
  assert.equal((await verifyAuthnetTransaction('SIM-1', { fetchImpl })).ok, true);
});

test('an approved transaction on our account verifies, with its amount', async () => {
  const r = await verifyAuthnetTransaction('80058673597', { fetchImpl: gateway({ transaction: { transId: '80058673597', transactionStatus: 'capturedPendingSettlement', authAmount: 390 }, messages: okMsg }) });
  assert.deepEqual(r, { ok: true, status: 'capturedPendingSettlement', amount: 390 });
});

test('held-for-review transactions still count as paid (checkout already treats them as accepted)', async () => {
  const r = await verifyAuthnetTransaction('80058673597', { fetchImpl: gateway({ transaction: { transactionStatus: 'FDSPendingReview', authAmount: 89 }, messages: okMsg }) });
  assert.equal(r.ok, true);
});

test('declined / voided / refunded / unknown transactions are refused', async () => {
  for (const s of ['declined', 'voided', 'refundSettledSuccessfully', 'expired', 'generalError', '']) {
    const r = await verifyAuthnetTransaction('80058673597', { fetchImpl: gateway({ transaction: { transactionStatus: s }, messages: okMsg }) });
    assert.equal(r.ok, false, s || '(empty)');
  }
});

test('E00040 (record not found) is a definitive refusal', async () => {
  const r = await verifyAuthnetTransaction('80058673597', { fetchImpl: gateway({ messages: { resultCode: 'Error', message: [{ code: 'E00040', text: 'The record cannot be found.' }] } }) });
  assert.deepEqual(r, { ok: false, reason: 'transaction-not-found' });
});

test('E00007 (auth failed / Transaction Details API disabled) fails CLOSED — forged ids must not pass', async () => {
  const r = await verifyAuthnetTransaction('80058673597', { fetchImpl: gateway({ messages: { resultCode: 'Error', message: [{ code: 'E00007', text: 'User authentication failed due to invalid authentication values.' }] } }) });
  assert.deepEqual(r, { ok: false, reason: 'gateway-auth-failed' });
});

test('gateway outage / garbage / other errors fail OPEN but flagged unverified', async () => {
  const down = async () => { throw new Error('ECONNRESET'); };
  assert.deepEqual(await verifyAuthnetTransaction('80058673597', { fetchImpl: down }), { ok: true, unverified: true, reason: 'ECONNRESET' });
  const garbage = async () => ({ text: async () => '<html>503</html>' });
  assert.equal((await verifyAuthnetTransaction('80058673597', { fetchImpl: garbage })).unverified, true);
  const other = gateway({ messages: { resultCode: 'Error', message: [{ code: 'E00001', text: 'An error occurred during processing.' }] } });
  assert.equal((await verifyAuthnetTransaction('80058673597', { fetchImpl: other })).unverified, true);
});

test('the request is a read-only getTransactionDetailsRequest for exactly that id', async () => {
  let sent;
  const fetchImpl = async (_u, o) => { sent = JSON.parse(o.body); return { text: async () => JSON.stringify({ transaction: { transactionStatus: 'settledSuccessfully' }, messages: okMsg }) }; };
  await verifyAuthnetTransaction('42424242', { fetchImpl });
  assert.deepEqual(Object.keys(sent), ['getTransactionDetailsRequest']);
  assert.equal(sent.getTransactionDetailsRequest.transId, '42424242');
});
