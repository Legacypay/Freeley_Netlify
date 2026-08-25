// Unit tests for netlify/functions/lib/mdi-voucher.js — run with `npm run test:unit`.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { resolveTestMode, buildVoucherPayload, parseVoucherResponse, demoMismatch, getSandboxEnvId, getLiveEnvId, MDI_LIVE_ENV_ID, MDI_SANDBOX_ENV_ID } =
  require(path.join(__dirname, '..', '..', 'netlify', 'functions', 'lib', 'mdi-voucher'));

const ENV_KEYS = ['MDI_LIVE_MODE', 'MDI_ALLOW_LIVE_ORDERS', 'MDI_FORCE_TEST', 'MDI_TEST_EMAIL_PATTERNS', 'MDI_TEST_FULL_FLOW', 'MDI_SEND_ENVIRONMENT_ID', 'MDI_SANDBOX_ENV_ID', 'MDI_LIVE_ENV_ID'];
const product = { questionnaire_id: 'q-123', offering_id: 'off-456' };

beforeEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });

test('default (no env) is TEST + demo', () => {
  const m = resolveTestMode({ email: 'someone@example.com' });
  assert.equal(m.isTest, true);
  assert.equal(m.demo, true);
  assert.equal(m.reason, 'MDI_LIVE_MODE!=true');
});

test('MDI_LIVE_MODE=true alone is still TEST (needs MDI_ALLOW_LIVE_ORDERS)', () => {
  process.env.MDI_LIVE_MODE = 'true';
  const m = resolveTestMode({ email: 'someone@example.com' });
  assert.equal(m.isTest, true);
  assert.equal(m.reason, 'MDI_ALLOW_LIVE_ORDERS!=true');
  const p = buildVoucherPayload({ product, testMode: m, metadata: 'freeley:x' });
  assert.equal(p.demo, true);
  assert.equal(p.metadata, 'TEST CASE | freeley:x');
  assert.equal(p.environment_id, MDI_LIVE_ENV_ID);
});

test('LIVE only when both flags are set and email is not a test pattern', () => {
  process.env.MDI_LIVE_MODE = 'true';
  process.env.MDI_ALLOW_LIVE_ORDERS = 'true';
  const m = resolveTestMode({ email: 'real@customer.com' });
  assert.equal(m.isTest, false);
  assert.equal(m.reason, 'live');
  const p = buildVoucherPayload({ product, testMode: m, metadata: 'freeley:x' });
  assert.equal('demo' in p, false);
  assert.equal(p.metadata, 'freeley:x');
  assert.equal(p.metadata.startsWith('TEST'), false);
});

test('MDI_FORCE_TEST overrides live flags', () => {
  process.env.MDI_LIVE_MODE = 'true';
  process.env.MDI_ALLOW_LIVE_ORDERS = 'true';
  process.env.MDI_FORCE_TEST = 'true';
  const m = resolveTestMode({ email: 'real@customer.com' });
  assert.equal(m.isTest, true);
  assert.equal(m.reason, 'MDI_FORCE_TEST');
});

test('test email patterns force TEST even in live mode', () => {
  process.env.MDI_LIVE_MODE = 'true';
  process.env.MDI_ALLOW_LIVE_ORDERS = 'true';
  process.env.MDI_TEST_EMAIL_PATTERNS = '@freeley.com, +test@';
  assert.equal(resolveTestMode({ email: 'Sam@Freeley.com' }).reason, 'test-email:@freeley.com');
  assert.equal(resolveTestMode({ email: 'qa+test@gmail.com' }).reason, 'test-email:+test@');
  assert.equal(resolveTestMode({ email: 'real@customer.com' }).isTest, false);
});

test('MDI_TEST_FULL_FLOW: test but NOT demo, still tagged in metadata', () => {
  process.env.MDI_TEST_FULL_FLOW = 'true';
  const m = resolveTestMode({});
  assert.equal(m.isTest, true);
  assert.equal(m.demo, false);
  const p = buildVoucherPayload({ product, testMode: m, metadata: 'freeley:x' });
  assert.equal('demo' in p, false);
  assert.equal(p.metadata, 'TEST CASE | freeley:x');
});

test('payload uses documented offerings[].id, never offering_id; sandbox env id when not live', () => {
  const p = buildVoucherPayload({ product, testMode: resolveTestMode({}), metadata: null });
  assert.equal('offering_id' in p, false);
  assert.deepEqual(p.offerings, [{ id: 'off-456' }]);
  assert.equal(p.questionnaire_id, 'q-123');
  assert.equal(p.hold_status, false);
  assert.equal(p.environment_id, MDI_SANDBOX_ENV_ID);
  assert.equal(p.metadata, 'TEST CASE');
});

test('MDI_SEND_ENVIRONMENT_ID=false omits environment_id; no offerings when product has none', () => {
  process.env.MDI_SEND_ENVIRONMENT_ID = 'false';
  const p = buildVoucherPayload({ product: { questionnaire_id: 'q' }, testMode: resolveTestMode({}) });
  assert.equal('environment_id' in p, false);
  assert.equal('offerings' in p, false);
});

test('metadata is capped at 255 chars and the TEST prefix always survives', () => {
  const p = buildVoucherPayload({ product, testMode: resolveTestMode({}), metadata: 'x'.repeat(400) });
  assert.equal(p.metadata.length, 255);
  assert.ok(p.metadata.startsWith('TEST CASE | '));
  process.env.MDI_LIVE_MODE = 'true'; process.env.MDI_ALLOW_LIVE_ORDERS = 'true';
  const live = buildVoucherPayload({ product, testMode: resolveTestMode({ email: 'a@b.com' }), metadata: 'y'.repeat(400) });
  assert.equal(live.metadata.length, 255);
  assert.equal(live.metadata.startsWith('TEST'), false);
});

test('demoMismatch flags a requested demo that MDI did not echo', () => {
  const testMode = resolveTestMode({});           // demo: true
  assert.equal(demoMismatch(testMode, parseVoucherResponse({ partner_voucher_id: 'v', demo: true })), false);
  assert.equal(demoMismatch(testMode, parseVoucherResponse({ partner_voucher_id: 'v', demo: false })), true);
  assert.equal(demoMismatch(testMode, parseVoucherResponse({ partner_voucher_id: 'v' })), true); // not echoed
  process.env.MDI_TEST_FULL_FLOW = 'true';
  assert.equal(demoMismatch(resolveTestMode({}), parseVoucherResponse({ partner_voucher_id: 'v' })), false); // demo not requested
});

test('environment ids are overridable via env vars, read fresh (not cached at require-time)', () => {
  const before = getSandboxEnvId();
  process.env.MDI_SANDBOX_ENV_ID = 'custom-sandbox-id';
  process.env.MDI_LIVE_ENV_ID = 'custom-live-id';
  assert.equal(getSandboxEnvId(), 'custom-sandbox-id');
  assert.equal(getLiveEnvId(), 'custom-live-id');
  delete process.env.MDI_SANDBOX_ENV_ID;
  delete process.env.MDI_LIVE_ENV_ID;
  assert.equal(getSandboxEnvId(), before); // falls back again once unset
});

test('buildVoucherPayload rejects product without questionnaire_id', () => {
  assert.throws(() => buildVoucherPayload({ product: {}, testMode: resolveTestMode({}) }), /questionnaire_id/);
});

test('parseVoucherResponse reads documented partner_voucher_id + onboarding_url', () => {
  const r = parseVoucherResponse({ partner_voucher_id: 'v1', onboarding_url: 'https://patient.mdintegrations.dev/?token=t', demo: true, environment_id: 'env', case_id: null, metadata: 'TEST CASE' });
  assert.equal(r.voucherId, 'v1');
  assert.equal(r.onboardingUrl, 'https://patient.mdintegrations.dev/?token=t');
  assert.equal(r.demo, true);
  assert.equal(r.environmentId, 'env');
  assert.equal(r.caseId, null);
  assert.equal(r.patientId, null);
});

test('parseVoucherResponse keeps legacy `id` compatibility and builds a fallback URL', () => {
  const r = parseVoucherResponse({ id: 'legacy', patient_id: 'p1' });
  assert.equal(r.voucherId, 'legacy');
  assert.equal(r.patientId, 'p1');
  assert.equal(r.onboardingUrl, 'https://patient.mdintegrations.com?token=legacy');
  assert.equal(r.demo, null); // not echoed ≠ false
  assert.equal(parseVoucherResponse({ id: 'x', demo: false }).demo, false);
  assert.equal(parseVoucherResponse(null).voucherId, null);
});
