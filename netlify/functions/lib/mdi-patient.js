/**
 * MDI patient / intake helpers — the "patient-first" half of the voucher flow.
 *
 * Until 2026-09-01 the checkout only ever called POST /v1/partner/vouchers with a
 * questionnaire_id + offering. Everything the patient typed at checkout (name, DOB,
 * sex, phone, address, allergies, medications, conditions, the whole quiz Q&A) was
 * validated, encrypted into the retry queue… and never sent to MD Integrations.
 * The patient then re-typed all of it on MDI's onboarding site, and Freeley had no
 * patient_id until MDI's webhook (which has never been delivered — see docs) told us.
 *
 * What this module adds, all straight from the Postman docs (14212272/2s8Yt1r9B8):
 *
 *   ensureMdiPatient()   POST /v1/partner/patients/search { search: <email>, is_sandbox }
 *                        → reuse the existing patient_id, else
 *                        POST /v1/partner/patients { first_name, last_name, email,
 *                          date_of_birth, gender (ISO 5218), phone_number, phone_type,
 *                          address{address,zip_code,city_name,state_name}, allergies,
 *                          current_medications, medical_conditions, metadata, external_id }
 *                        Every field marked required in the docs must be present or we
 *                        skip patient creation and fall back to the voucher-only flow —
 *                        never block a paid checkout on optional enrichment.
 *
 *   buildPrefilledQuestions()  maps the quiz answers onto the documented
 *                        `prefilled_questions[]` voucher field ({ question, answer,
 *                        type, display_in_pdf, label, metadata }) so the clinician sees
 *                        the funnel answers on the case PDF.
 *
 *   createPatientOrder() POST /v1/partner/patients/:patient_id/orders — records the
 *                        Freeley purchase (amount, gateway transaction, card last4,
 *                        product) on the MDI patient so the encounter shows what was
 *                        paid for. Best-effort.
 *
 * All three are best-effort and NEVER throw — callers log and continue.
 */

const { mdiRequest } = require('./mdi-client');

const MAX_PREFILLED = 60;
const MAX_ANSWER = 1000;
// The $20 physician consultation is included in every plan price (checkout fine print).
const CONSULTATION_PRICE = 20;
const SITE_URL = (process.env.URL || 'https://freeley.com').replace(/\/$/, '');
const CATEGORY_IMAGES = {
  'weight-loss': '/assets/quiz/default.png',
  'hair-loss': '/assets/quiz/hair-lose.png',
  'longevity': '/assets/quiz/longevity.png',
  'sexual-wellness': '/assets/quiz/default.png'
};
function productImageUrl(product) {
  return SITE_URL + (CATEGORY_IMAGES[product && product.category] || '/assets/quiz/default.png');
}

function str(v, max) {
  if (v == null) return '';
  const s = String(v).trim();
  return max ? s.slice(0, max) : s;
}

/** ISO 5218: 1 male, 2 female. Anything else → null (MDI requires 1/2 for DoseSpot). */
function toIsoGender(sex) {
  if (sex == null) return null;
  const s = String(sex).trim().toLowerCase();
  if (s === '1' || s === 'male' || s === 'man' || s === 'm') return 1;
  if (s === '2' || s === 'female' || s === 'woman' || s === 'f') return 2;
  return null;
}

/** Digits-only US phone → "(555) 555-0142"; returns null when not 10 digits. */
function toUsPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '').replace(/^1(\d{10})$/, '$1');
  if (d.length !== 10) return null;
  return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
}

/**
 * Build the documented POST /v1/partner/patients body, or return { missing: [...] }
 * when a required field is absent so the caller can fall back gracefully.
 */
function buildPatientPayload(patient, clinical = {}, meta = {}) {
  const missing = [];
  const gender = toIsoGender(patient.gender);
  const phone = toUsPhone(patient.phone_number);
  const dob = /^\d{4}-\d{2}-\d{2}$/.test(String(patient.date_of_birth || '')) ? patient.date_of_birth : null;
  const address = str(patient.address, 35);
  const zip = str(patient.zip_code, 10).replace(/[^0-9-]/g, '');
  const city = str(patient.city, 35);
  const state = str(patient.state, 50);

  if (!str(patient.first_name)) missing.push('first_name');
  if (!str(patient.last_name)) missing.push('last_name');
  if (!str(patient.email)) missing.push('email');
  if (!dob) missing.push('date_of_birth');
  if (!gender) missing.push('gender');
  if (!phone) missing.push('phone_number');
  if (!address) missing.push('address');
  if (!zip) missing.push('zip_code');
  if (!city) missing.push('city');
  if (!state) missing.push('state');
  if (missing.length) return { missing };

  const payload = {
    first_name: str(patient.first_name, 35),
    last_name: str(patient.last_name, 35),
    email: str(patient.email, 80).toLowerCase(),
    date_of_birth: dob,
    gender,
    phone_number: phone,
    phone_type: 2,
    address: { address, zip_code: zip, city_name: city, state_name: state }
  };
  const allergies = str(clinical.allergies, 4000);
  const meds = str(clinical.current_medications, 4000);
  const conds = str(clinical.medical_conditions, 4000);
  if (allergies) payload.allergies = allergies;
  if (meds) payload.current_medications = meds;
  if (conds) payload.medical_conditions = conds;
  if (meta.metadata) payload.metadata = str(meta.metadata, 255);
  if (meta.external_id) payload.external_id = str(meta.external_id, 255);
  return { payload };
}

function extractList(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  return [];
}

/**
 * Find (by email) or create the MDI patient. Returns
 *   { patientId, created, reused, skipped?: string }
 * and never throws.
 *
 * @param {object} patient   validated `patient` object from the submitQuiz body
 * @param {object} clinical  { allergies, current_medications, medical_conditions }
 * @param {{ isSandbox: boolean, metadata?: string, external_id?: string, logTag?: string }} opts
 */
async function ensureMdiPatient(patient, clinical, opts = {}) {
  const tag = opts.logTag || '[MDI PATIENT]';
  const email = str(patient && patient.email, 80).toLowerCase();
  if (!email) return { patientId: null, created: false, reused: false, skipped: 'no-email' };

  // 1) Reuse an existing MDI patient with this email (one patient, many cases).
  try {
    const found = extractList(await mdiRequest('POST', '/v1/partner/patients/search', {
      search: email,
      is_sandbox: opts.isSandbox === true
    }));
    const hit = found.find(p => p && String(p.email || '').toLowerCase() === email);
    if (hit && hit.patient_id) {
      console.log(tag + ' Reusing existing MDI patient ' + hit.patient_id);
      return { patientId: hit.patient_id, created: false, reused: true };
    }
  } catch (e) {
    console.warn(tag + ' Patient search failed (non-critical): ' + e.message.slice(0, 200));
  }

  // 2) Create the patient with everything the checkout collected.
  const built = buildPatientPayload(patient, clinical, { metadata: opts.metadata, external_id: opts.external_id });
  if (built.missing) {
    console.warn(tag + ' Skipping patient creation — missing required field(s): ' + built.missing.join(', ') + ' (voucher-only flow)');
    return { patientId: null, created: false, reused: false, skipped: 'missing:' + built.missing.join(',') };
  }
  try {
    const res = await mdiRequest('POST', '/v1/partner/patients', built.payload);
    const patientId = res && (res.patient_id || (res.data && res.data.patient_id)) || null;
    if (!patientId) {
      console.warn(tag + ' Patient create returned no patient_id: ' + JSON.stringify(res).slice(0, 200));
      return { patientId: null, created: false, reused: false, skipped: 'no-id-in-response' };
    }
    console.log(tag + ' Created MDI patient ' + patientId + (res.is_live === false ? ' (sandbox)' : ''));
    return { patientId, created: true, reused: false };
  } catch (e) {
    console.warn(tag + ' Patient create failed (non-critical, voucher-only flow): ' + e.message.slice(0, 300));
    return { patientId: null, created: false, reused: false, skipped: 'create-failed:' + (e.statusCode || 'network') };
  }
}

/**
 * Map quiz answers (array [{question, answer, type}] or object {key: value}) plus the
 * clinical narrative fields onto the documented voucher `prefilled_questions[]` shape.
 * Returns [] when there is nothing usable.
 */
function buildPrefilledQuestions(quizAnswers, clinical = {}) {
  const out = [];
  const push = (question, answer, extra = {}) => {
    if (out.length >= MAX_PREFILLED) return;
    const q = str(question, 500);
    let a = answer;
    if (Array.isArray(a)) a = a.map(x => str(x, 200)).filter(Boolean).join(', ');
    if (a == null || a === '') return;
    const type = typeof a === 'boolean' ? 'boolean' : (typeof a === 'number' ? 'number' : 'string');
    a = str(a, MAX_ANSWER);
    if (!q || !a) return;
    out.push({ question: q, answer: a, type, display_in_pdf: true, should_skip: false, ...extra });
  };

  if (Array.isArray(quizAnswers)) {
    for (const item of quizAnswers) {
      if (item && typeof item === 'object') push(item.question || item.label || item.key, item.answer, { label: str(item.label || '', 50) || undefined, metadata: 'freeley-quiz' });
    }
  } else if (quizAnswers && typeof quizAnswers === 'object') {
    for (const [key, value] of Object.entries(quizAnswers)) {
      push(key.replace(/[_-]+/g, ' '), value, { label: str(key, 50), metadata: 'freeley-quiz' });
    }
  }

  const narrative = [
    ['Known allergies', clinical.allergies],
    ['Current medications', clinical.current_medications],
    ['Medical conditions', clinical.medical_conditions]
  ];
  for (const [q, a] of narrative) if (str(a)) push(q, str(a, MAX_ANSWER), { important: true, metadata: 'freeley-checkout' });

  return out;
}

/**
 * Record the Freeley purchase on the MDI patient (Partners › Patients › Orders).
 * @param {string} patientId
 * @param {{ transaction_id: string, amount: number|string, plan_months?: number, card_last4?: string, card_brand?: string, simulated?: boolean }} payment
 * @param {{ product: object, productKey: string, caseId?: string|null, isTest?: boolean }} ctx
 * @returns {Promise<string|null>} MDI order id or null
 */
async function createPatientOrder(patientId, payment, ctx = {}) {
  const tag = ctx.logTag || '[MDI PATIENT]';
  if (!patientId || !payment || !payment.transaction_id) return null;
  const amount = Number(payment.amount);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const product = ctx.product || {};
  const total = Math.round(amount * 100) / 100;
  // MDI validation (sandbox, 2026-09-01): consultation_price must be >= 1,
  // products[].image_url is required, and billing.expire_date is required
  // whenever billing is present. Freeley's plan price INCLUDES the $20
  // consultation (checkout fine print), so we report that split; the card's
  // expiry is never returned by Authorize.Net's charge response, so billing
  // is only sent when the caller can supply expire_date.
  const consultation = Math.min(CONSULTATION_PRICE, Math.max(1, total));
  const body = {
    order_number: str(payment.transaction_id, 100),
    status: 'open',
    payment_status: payment.simulated ? 'pending' : 'completed',
    total_amount: total,
    consultation_price: consultation,
    order_created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    products: [{
      name: str(product.name || ctx.productKey || 'Treatment', 120),
      description: str((product.mdi_offering_name || '') + (payment.plan_months ? ' — ' + payment.plan_months + '-month plan' : '') + (ctx.isTest ? ' [TEST]' : ''), 255),
      image_url: productImageUrl(product),
      ...(product.offering_id ? { offering_id: product.offering_id } : {}),
      unit_price: total,
      amount: 1,
      total_amount: total
    }]
  };
  if (ctx.caseId) body.case_id = ctx.caseId;
  const last4 = str(payment.card_last4, 4).replace(/\D/g, '');
  const expire = str(payment.card_expire_date, 7); // "MM/YYYY"
  if (last4 && /^\d{2}\/\d{4}$/.test(expire)) {
    body.billing = { card_id: last4, issuer: str(payment.card_brand || 'card', 30).toLowerCase(), type: 'credit', expire_date: expire };
  }
  try {
    const res = await mdiRequest('POST', '/v1/partner/patients/' + encodeURIComponent(patientId) + '/orders', body);
    const id = res && (res.id || res.order_id) || null;
    console.log(tag + ' Patient order recorded in MDI: ' + (id || '<no id>') + ' | ' + body.order_number + ' | $' + body.total_amount);
    return id;
  } catch (e) {
    console.warn(tag + ' Patient order create failed (non-critical): ' + e.message.slice(0, 300));
    return null;
  }
}

module.exports = { ensureMdiPatient, buildPatientPayload, buildPrefilledQuestions, createPatientOrder, toIsoGender, toUsPhone };
