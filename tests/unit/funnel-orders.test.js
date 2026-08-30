// Unit tests for netlify/functions/lib/funnel-orders.js — mocks
// @supabase/supabase-js so no network is needed. Verifies the RPC contract
// (param names must match the save_funnel_order SQL signature exactly) and
// that every failure mode degrades to a null return, never a throw — a
// Supabase problem must never fail a charge Authorize.Net already accepted.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const libDir = path.join(__dirname, '..', '..', 'netlify', 'functions', 'lib');
const modPath = path.join(libDir, 'funnel-orders.js');

let rpcCalls = [];
let rpcResult = { data: 'order-uuid-1', error: null };
let createClientThrows = false;

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@supabase/supabase-js') {
    return {
      createClient: () => {
        if (createClientThrows) throw new Error('boom');
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
    card: { brand: 'Visa', last4: '1111', customerProfileId: 123, paymentProfileId: 456 }
  });
  assert.equal(id, 'order-uuid-1');
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, 'save_funnel_order');
  assert.deepEqual(Object.keys(rpcCalls[0].params).sort(), [
    'p_address', 'p_amount_cents', 'p_card_brand', 'p_card_last4', 'p_city', 'p_customer_profile_id',
    'p_date_of_birth', 'p_first_name', 'p_gateway', 'p_gateway_transaction_id', 'p_last_name', 'p_lead_id',
    'p_payment_profile_id', 'p_plan_months', 'p_product_name', 'p_status', 'p_treatment', 'p_us_state', 'p_zip'
  ]);
  assert.equal(rpcCalls[0].params.p_card_last4, '1111');
  assert.equal(rpcCalls[0].params.p_customer_profile_id, '123'); // ids go over as text
  assert.equal(rpcCalls[0].params.p_amount_cents, 22500);
  assert.equal(rpcCalls[0].params.p_gateway_transaction_id, '80058673597');
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

test('getFunnelOrdersForEmail calls the lookup RPC with the email and returns rows', async () => {
  rpcResult = { data: [{ id: 'o1', amount_cents: 8900, status: 'paid' }], error: null };
  const { getFunnelOrdersForEmail } = fresh();
  const rows = await getFunnelOrdersForEmail('a@b.co');
  assert.equal(rpcCalls[0].name, 'get_funnel_orders_for_email');
  assert.deepEqual(rpcCalls[0].params, { p_email: 'a@b.co' });
  assert.equal(rows.length, 1);
});

test('getFunnelOrdersForEmail returns [] on error, empty email, or missing env', async () => {
  rpcResult = { data: null, error: { message: 'boom' } };
  let { getFunnelOrdersForEmail } = fresh();
  assert.deepEqual(await getFunnelOrdersForEmail('a@b.co'), []);
  assert.deepEqual(await getFunnelOrdersForEmail(''), []);
  delete process.env.PUBLIC_SUPABASE_ANON_KEY;
  ({ getFunnelOrdersForEmail } = fresh());
  assert.deepEqual(await getFunnelOrdersForEmail('a@b.co'), []);
});

test('returns null (does not throw) when Supabase env is not configured', async () => {
  delete process.env.PUBLIC_SUPABASE_URL;
  const { saveFunnelOrder } = fresh();
  const id = await saveFunnelOrder({ planMonths: 1, amountCents: 8900, status: 'paid', gateway: 'authorize_net', gatewayTransactionId: 't' });
  assert.equal(id, null);
  assert.equal(rpcCalls.length, 0);
});
