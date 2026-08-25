#!/usr/bin/env node
/**
 * mdi-verify-env.js — prove which MDI environment/mode the current credentials hit,
 * WITHOUT creating a patient, a case, or a billable encounter.
 *
 * What it does:
 *   1. POST /v1/partner/auth/token           (via lib/mdi-client.js)
 *   2. GET  /v1/partner                      → partner name / active flag
 *   3. Resolves the test/live decision exactly like submitQuiz.js would
 *   4. POST /v1/partner/vouchers { demo: true, metadata: "TEST CASE | env-check" }
 *      Docs: "Demo vouchers will not create any patient or cases and will not expire."
 *   5. Prints partner_voucher_id / environment_id / onboarding_url / demo
 *   6. DELETE /v1/partner/vouchers/:id       (cleanup; ignored if it fails)
 *
 * Exit codes: 0 = OK (MDI echoed demo:true), 1 = config/API failure, 2 = MDI did NOT echo demo:true.
 *
 * Usage (needs MDI_CLIENT_ID / MDI_CLIENT_SECRET in env):
 *   npx netlify dev:exec node scripts/mdi-verify-env.js         # inherits Netlify env vars
 *   MDI_CLIENT_ID=… MDI_CLIENT_SECRET=… node scripts/mdi-verify-env.js
 * Options:
 *   --product <key>   product key from lib/products.js (default: first product with a questionnaire_id)
 *   --keep            do not delete the demo voucher afterwards
 *   --email <addr>    email to run the test-mode decision against
 */

const path = require('path');
const fnLib = path.join(__dirname, '..', 'netlify', 'functions', 'lib');
const { mdiRequest, BASE_URL } = require(path.join(fnLib, 'mdi-client'));
const { PRODUCTS } = require(path.join(fnLib, 'products'));
const { resolveTestMode, buildVoucherPayload, parseVoucherResponse } = require(path.join(fnLib, 'mdi-voucher'));

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const KEEP = process.argv.includes('--keep');

// Deferring to the next tick avoids a Windows/libuv crash (`Assertion failed:
// !(handle->flags & UV_HANDLE_CLOSING)`) seen when process.exit() races an
// in-flight fetch/undici socket teardown.
function die(code) {
  setImmediate(() => process.exit(code));
}

(async () => {
  console.log('── MDI environment check ──────────────────────────────');
  console.log('base_url         :', BASE_URL);
  console.log('MDI_LIVE_MODE    :', process.env.MDI_LIVE_MODE || '<unset>');
  console.log('MDI_ALLOW_LIVE_ORDERS:', process.env.MDI_ALLOW_LIVE_ORDERS || '<unset>');
  console.log('MDI_FORCE_TEST   :', process.env.MDI_FORCE_TEST || '<unset>');
  console.log('MDI_TEST_FULL_FLOW:', process.env.MDI_TEST_FULL_FLOW || '<unset>');

  if (!process.env.MDI_CLIENT_ID || !process.env.MDI_CLIENT_SECRET) {
    console.error('\n✖ MDI_CLIENT_ID / MDI_CLIENT_SECRET not set. Run via `npx netlify dev:exec node scripts/mdi-verify-env.js`.');
    die(1); return;
  }

  let partner;
  try {
    partner = await mdiRequest('GET', '/v1/partner');
    console.log('\npartner          :', partner && partner.name, '| active:', partner && partner.active, '| id:', partner && partner.partner_id);
  } catch (e) {
    console.error('\n✖ GET /v1/partner failed:', e.message);
    die(1); return;
  }

  const productKey = arg('product', Object.keys(PRODUCTS).find(k => PRODUCTS[k].questionnaire_id && !PRODUCTS[k]._hold));
  const product = PRODUCTS[productKey];
  if (!product) { console.error('✖ Unknown product key:', productKey); die(1); return; }

  const testMode = resolveTestMode({ email: arg('email', '') });
  console.log('\nsubmitQuiz would run as:', testMode.isTest ? 'TEST' : 'LIVE', '(' + testMode.reason + ') demo=' + testMode.demo);

  // Force demo for the probe regardless of configuration — this script must never bill.
  const payload = buildVoucherPayload({ product, testMode: { ...testMode, isTest: true, demo: true }, metadata: 'env-check ' + new Date().toISOString() });
  payload.demo = true;
  console.log('\nprobe payload    :', JSON.stringify(payload));

  let parsed;
  try {
    const res = await mdiRequest('POST', '/v1/partner/vouchers', payload);
    parsed = parseVoucherResponse(res);
    console.log('\nvoucher id       :', parsed.voucherId);
    console.log('demo (echoed)    :', parsed.demo);
    console.log('environment_id   :', parsed.environmentId);
    console.log('onboarding_url   :', parsed.onboardingUrl);
    console.log('metadata (echoed):', parsed.metadata);
    console.log('raw keys         :', Object.keys(res || {}).join(', '));
  } catch (e) {
    console.error('\n✖ POST /v1/partner/vouchers failed:', e.message);
    if (/environment_id/i.test(e.message)) {
      console.error('  hint: MDI rejected environment_id — set MDI_SEND_ENVIRONMENT_ID=false and retry.');
    }
    die(1); return;
  }

  if (parsed.voucherId && !KEEP) {
    try {
      await mdiRequest('DELETE', '/v1/partner/vouchers/' + parsed.voucherId);
      console.log('\ncleanup          : demo voucher deleted');
    } catch (e) {
      console.warn('\ncleanup          : delete failed (non-critical, demo vouchers never expire):', e.message);
    }
  }

  if (!parsed.demo) {
    console.error('\n✖ MDI did NOT echo demo:true — do not run live tests until this is understood.');
    die(2); return;
  }
  console.log('\n✔ OK — demo voucher accepted; nothing was created or billed.');
})();
