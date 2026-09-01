// Unit tests for netlify/functions/lib/funnel-orders.js — mocks
// @supabase/supabase-js so no network is needed. Verifies the RPC contract
// (param names must match the SQL signatures exactly), that the Hub read /
// cancel paths run AS THE PATIENT (their access token forwarded, no email
// parameter anywhere), and that every failure mode degrades to a null/[]
// return, never a throw — a Supabase problem must never fail a charge
// Authorize.Net already accepted.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const libDir = path.join(__dirname, '..', '..', 'netlify', 'functions', 'lib');
const modPath = path.join(libDir, 'funnel-orders.js');

let rpcCalls = [];
let clientOpts = [];
let rpcResult = { data: 'order-uuid-1', error: null };
let createClientThrows = false;

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@supabase/supabase-js') {
    return {
      createClient: (_url, _key, opts) => {
        if (createClientThrows) throw new Error('boom');
        clientOpts.push(opts || {});
        return { rpc: async (name, params) => { rpcCalls.push({ name, params }); return rpcResult; } };
      }
    };
  }
  return originalLoad.apply(this, arguments);
};

function fresh() {
  delete require.cache[modPath];
  return require(modPath);
}

beforeEach(() => {
  rpcCalls = [];
  clientOpts = [];
  rpcResult = { data: 'order-uuid-1', error: null };
  createClientThrows = false;
  process.env.PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

test('calls save_funnel_order with the exact SQL parameter names', async () => {
  const { saveFunnelOrder } = fresh();
  const id = await saveFunnelOrder({
    leadId: 'lead-1', planMonths: 3, amountCents: 22500, status: 'paid',
    gateway: 'authorize_net', gatewayTransactionId: '80058673597',
    billing: { firstName: 'QA', lastName: 'T', address: '1 St', city: 'Miami', state: 'FL', zip: '33101', dateOfBirth: '1990-01-01' },
    card: { brand: 'Visa', last4: '1111', customerProfileId: 123, paymentProfileId: 456 },
    authnetSubscriptionId: 789
  });
  assert.equal(id, 'order-uuid-1');
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, 'save_funnel_order');
  assert.deepEqual(Object.keys(rpcCalls[0].params).sort(), [
    'p_address', 'p_amount_cents', 'p_authnet_subscription_id', 'p_card_brand', 'p_card_last4', 'p_city',
    'p_customer_profile_id', 'p_date_of_birth', 'p_first_name', 'p_gateway', 'p_gateway_transaction_id',
    'p_last_name', 'p_lead_id', 'p_payment_profile_id', 'p_plan_months', 'p_product_name', 'p_status',
    'p_treatment', 'p_us_state', 'p_zip'
  ]);
  assert.equal(rpcCalls[0].params.p_card_last4, '1111');
  assert.equal(rpcCalls[0].params.p_customer_profile_id, '123'); // ids go over as text
  assert.equal(rpcCalls[0].params.p_authnet_subscription_id, '789');
  assert.equal(rpcCalls[0].params.p_amount_cents, 22500);
  assert.equal(rpcCalls[0].params.p_gateway_transaction_id, '80058673597');
});

test('authnetSubscriptionId is null when the ARB schedule was never created', async () => {
  const { saveFunnelOrder } = fresh();
  await saveFunnelOrder({ planMonths: 1, amountCents: 8900, status: 'paid', gateway: 'authorize_net', gatewayTransactionId: 't2' });
  assert.equal(rpcCalls[0].params.p_authnet_subscription_id, null);
});

test('missing lead / billing become SQL nulls, not undefined', async () => {
  const { saveFunnelOrder } = fresh();
  await saveFunnelOrder({ planMonths: 1, amountCents: 8900, status: 'paid', gateway: 'authorize_net', gatewayTransactionId: 't' });
  const p = rpcCalls[0].params;
  assert.equal(p.p_lead_id, null);
  assert.equal(p.p_first_name, null);
  assert.equal(p.p_date_of_birth, null);
  assert.equal(p.p_card_last4, null);
  assert.equal(p.p_payment_profile_id, null);
});

test('returns null (does not throw) when the RPC errors', async () => {
  rpcResult = { data: null, error: { message: 'constraint violated' } };
  const { saveFunnelOrder } = fresh();
  const id = await saveFunnelOrder({ planMonths: 1, amountCents: 8900, status: 'paid', gateway: 'authorize_net', gatewayTransactionId: 't' });
  assert.equal(id, null);
});

test('returns null (does not throw) when Supabase env is not configured', async () => {
  delete process.env.PUBLIC_SUPABASE_URL;
  const { saveFunnelOrder } = fresh();
  const id = await saveFunnelOrder({ planMonths: 1, amountCents: 8900, status: 'paid', gateway: 'authorize_net', gatewayTransactionId: 't' });
  assert.equal(id, null);
  assert.equal(rpcCalls.length, 0);
});

// ── Hub read / cancel: run AS the patient, never with an email parameter ────

test('getMyFunnelOrders forwards the access token and calls the parameterless JWT-bound RPC', async () => {
  rpcResult = { data: [{ id: 'o1', amount_cents: 8900, status: 'paid' }], error: null };
  const { getMyFunnelOrders } = fresh();
  const rows = await getMyFunnelOrders('jwt-abc');
  assert.equal(rpcCalls[0].name, 'get_my_funnel_orders');
  assert.equal(rpcCalls[0].params, undefined); // no email — the RPC reads auth.jwt()
  assert.equal(clientOpts[0].global.headers.Authorization, 'Bearer jwt-abc');
  assert.equal(rows.length, 1);
});

test('getMyFunnelOrders returns [] on error, missing token, or missing env — without calling the RPC when it cannot act as the user', async () => {
  rpcResult = { data: null, error: { message: 'boom' } };
  let { getMyFunnelOrders } = fresh();
  assert.deepEqual(await getMyFunnelOrders('jwt'), []);
  assert.deepEqual(await getMyFunnelOrders(''), []);
  assert.equal(rpcCalls.length, 1); // only the first call reached the RPC
  delete process.env.PUBLIC_SUPABASE_ANON_KEY;
  ({ getMyFunnelOrders } = fresh());
  assert.deepEqual(await getMyFunnelOrders('jwt'), []);
});

test('cancelMySubscription forwards the token, passes only the subscription id, returns the RPC boolean', async () => {
  rpcResult = { data: true, error: null };
  const { cancelMySubscription } = fresh();
  const ok = await cancelMySubscription('jwt-abc', 'sub-123');
  assert.equal(rpcCalls[0].name, 'cancel_my_subscription');
  assert.deepEqual(rpcCalls[0].params, { p_authnet_subscription_id: 'sub-123' });
  assert.equal(clientOpts[0].global.headers.Authorization, 'Bearer jwt-abc');
  assert.equal(ok, true);
});

test('cancelMySubscription returns false without calling the RPC when args are missing, and on RPC error', async () => {
  const { cancelMySubscription } = fresh();
  assert.equal(await cancelMySubscription('', 'sub-123'), false);
  assert.equal(await cancelMySubscription('jwt', ''), false);
  assert.equal(rpcCalls.length, 0);
  rpcResult = { data: null, error: { message: 'boom' } };
  assert.equal(await cancelMySubscription('jwt', 'sub-123'), false);
});

test('the email-parameter functions no longer exist', () => {
  const m = fresh();
  assert.equal(m.getFunnelOrdersForEmail, undefined);
  assert.equal(m.markSubscriptionCanceledForEmail, undefined);
});
