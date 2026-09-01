// node --test — lib/mdi-patient.js (pure helpers) + the payment block in lib/validate-quiz.js
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPatientPayload, buildPrefilledQuestions, toIsoGender, toUsPhone } = require('../../netlify/functions/lib/mdi-patient');
const { buildVoucherPayload, resolveTestMode } = require('../../netlify/functions/lib/mdi-voucher');
const { validateQuizSubmission } = require('../../netlify/functions/lib/validate-quiz');

const PATIENT = {
  first_name: 'Test', last_name: 'Case', email: 'QA@Example.com', phone_number: '(305) 555-0142',
  date_of_birth: '1995-05-14', gender: '1', address: '123 Main St', city: 'Miami', state: 'FL', zip_code: '33101'
};

test('toIsoGender maps checkout selects and quiz free text to ISO 5218', () => {
  assert.equal(toIsoGender('1'), 1);
  assert.equal(toIsoGender('Male'), 1);
  assert.equal(toIsoGender('2'), 2);
  assert.equal(toIsoGender('Woman'), 2);
  assert.equal(toIsoGender('9'), null);   // "prefer not to say" → cannot create the MDI patient
  assert.equal(toIsoGender(undefined), null);
});

test('toUsPhone normalises to MDI US format, rejects non-10-digit', () => {
  assert.equal(toUsPhone('305-555-0142'), '(305) 555-0142');
  assert.equal(toUsPhone('+1 305 555 0142'), '(305) 555-0142');
  assert.equal(toUsPhone('12345'), null);
});

test('buildPatientPayload emits the documented POST /v1/partner/patients body', () => {
  const { payload, missing } = buildPatientPayload(PATIENT, { allergies: 'peanuts' }, { metadata: 'TEST CASE | freeley:hair-men', external_id: 'freeley-txn:1' });
  assert.equal(missing, undefined);
  assert.deepEqual(payload, {
    first_name: 'Test', last_name: 'Case', email: 'qa@example.com', date_of_birth: '1995-05-14', gender: 1,
    phone_number: '(305) 555-0142', phone_type: 2,
    address: { address: '123 Main St', zip_code: '33101', city_name: 'Miami', state_name: 'FL' },
    allergies: 'peanuts', metadata: 'TEST CASE | freeley:hair-men', external_id: 'freeley-txn:1'
  });
});

test('buildPatientPayload reports every missing required field instead of guessing', () => {
  const { missing } = buildPatientPayload({ first_name: 'A', last_name: 'B', email: 'a@b.co' });
  assert.deepEqual(missing.sort(), ['address', 'city', 'date_of_birth', 'gender', 'phone_number', 'state', 'zip_code']);
});

test('buildPatientPayload truncates address to MDI 35-char limit', () => {
  const { payload } = buildPatientPayload({ ...PATIENT, address: 'x'.repeat(60) });
  assert.equal(payload.address.address.length, 35);
});

test('buildPrefilledQuestions handles array and object quiz shapes + narrative fields', () => {
  const fromArray = buildPrefilledQuestions([{ question: 'Are you pregnant?', answer: 'No' }, { question: '', answer: 'x' }, { question: 'Weight', answer: 180 }], { allergies: 'none known' });
  assert.equal(fromArray.length, 3);
  assert.deepEqual(fromArray[0], { question: 'Are you pregnant?', answer: 'No', type: 'string', display_in_pdf: true, should_skip: false, label: undefined, metadata: 'freeley-quiz' });
  assert.equal(fromArray[1].type, 'number');
  assert.equal(fromArray[2].question, 'Known allergies');
  assert.equal(fromArray[2].important, true);

  const fromObject = buildPrefilledQuestions({ goal_weight: '160', conditions: ['diabetes', 'htn'], skip_me: '' });
  assert.equal(fromObject.length, 2);
  assert.equal(fromObject[0].question, 'goal weight');
  assert.equal(fromObject[1].answer, 'diabetes, htn');

  assert.deepEqual(buildPrefilledQuestions(null, {}), []);
});

test('buildPrefilledQuestions caps at 60 entries and 1000 chars per answer', () => {
  const many = {};
  for (let i = 0; i < 100; i++) many['q' + i] = 'a'.repeat(2000);
  const out = buildPrefilledQuestions(many);
  assert.equal(out.length, 60);
  assert.equal(out[0].answer.length, 1000);
});

test('buildVoucherPayload binds patient_id + prefilled_questions only on non-demo vouchers', () => {
  const product = { questionnaire_id: 'q-1', offering_id: 'o-1' };
  const qs = [{ question: 'x', answer: 'y', type: 'string' }];
  const demo = buildVoucherPayload({ product, testMode: { isTest: true, demo: true, liveMode: false }, patientId: 'p-1', prefilledQuestions: qs });
  assert.equal(demo.patient_id, undefined);
  assert.equal(demo.prefilled_questions, undefined);
  assert.equal(demo.demo, true);

  const full = buildVoucherPayload({ product, testMode: { isTest: true, demo: false, liveMode: false }, patientId: 'p-1', prefilledQuestions: qs });
  assert.equal(full.patient_id, 'p-1');
  assert.deepEqual(full.prefilled_questions, qs);
  assert.equal(full.demo, undefined);
  assert.deepEqual(full.offerings, [{ id: 'o-1' }]);
});

test('buildVoucherPayload omits offerings when the product has no active offering', () => {
  const p = buildVoucherPayload({ product: { questionnaire_id: 'q-1', offering_id: null }, testMode: resolveTestMode({ explicitTest: true }) });
  assert.equal(p.offerings, undefined);
  assert.equal(p.questionnaire_id, 'q-1');
});

test('validateQuizSubmission accepts a well-formed payment block and rejects a bad one', () => {
  const base = { patient: { first_name: 'A', last_name: 'B', email: 'a@b.co' }, product: 'hair-loss' };
  assert.equal(validateQuizSubmission({ ...base, payment: { transaction_id: 'SIM-1', amount: '225.00', plan_months: 3, card_last4: '1111', simulated: true } }).ok, true);
  assert.equal(validateQuizSubmission({ ...base, payment: null }).ok, true);
  assert.match(validateQuizSubmission({ ...base, payment: { amount: 1 } }).error, /transaction_id/);
  assert.match(validateQuizSubmission({ ...base, payment: { transaction_id: 'x', card_last4: '12345' } }).error, /card_last4/);
  assert.match(validateQuizSubmission({ ...base, payment: { transaction_id: 'x', amount: -1 } }).error, /amount/);
  assert.match(validateQuizSubmission({ ...base, payment: 'nope' }).error, /object/);
});
