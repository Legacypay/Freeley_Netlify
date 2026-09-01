/**
 * Lightweight schema validation for /submitQuiz and /savePendingCase payloads.
 *
 * Goals:
 *  - Reject obvious garbage (wrong types, oversized fields, deep nesting)
 *    BEFORE we touch MDI.
 *  - Stay permissive on medical-narrative fields (allergies, conditions,
 *    free-form quiz answers) — we just bound their size.
 *  - Never accidentally block a legitimate checkout flow.
 *
 * Returns { ok: true, value } on success, or { ok: false, error } on failure.
 */

const MAX_STR = 5000;          // generic free-text cap
const MAX_FIELD_NAME = 120;
const MAX_QUIZ_ANSWERS = 200;   // map of question -> answer
const MAX_QUIZ_VALUE = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function isObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

function boundedString(v, max = MAX_STR) {
  if (v == null) return '';
  if (typeof v !== 'string') return null;
  if (v.length > max) return null;
  return v;
}

function validatePatient(p) {
  if (!isObject(p)) return 'patient must be an object';
  const required = ['first_name', 'last_name', 'email'];
  for (const k of required) {
    if (!p[k] || typeof p[k] !== 'string' || p[k].length === 0) {
      return `patient.${k} is required`;
    }
    if (p[k].length > 200) return `patient.${k} too long`;
  }
  if (!EMAIL_RE.test(p.email)) return 'patient.email is invalid';
  const optionalStrings = ['phone_number', 'date_of_birth', 'address', 'city', 'state', 'zip_code'];
  for (const k of optionalStrings) {
    if (p[k] != null && (typeof p[k] !== 'string' || p[k].length > 200)) {
      return `patient.${k} invalid`;
    }
  }
  if (p.gender != null && !(typeof p.gender === 'number' || typeof p.gender === 'string')) {
    return 'patient.gender invalid';
  }
  return null;
}

function validateQuizAnswers(qa) {
  if (qa == null) return null;
  // Accept both array format [{question, answer, type}] and object format {key: value}
  if (Array.isArray(qa)) {
    if (qa.length > MAX_QUIZ_ANSWERS) return 'quiz_answers has too many items';
    for (let i = 0; i < qa.length; i++) {
      const item = qa[i];
      if (!isObject(item)) return `quiz_answers[${i}] must be an object`;
      // Validate question/answer pair
      if (item.question != null && typeof item.question === 'string' && item.question.length > MAX_QUIZ_VALUE) {
        return `quiz_answers[${i}].question too long`;
      }
      if (item.answer != null && typeof item.answer === 'string' && item.answer.length > MAX_QUIZ_VALUE) {
        return `quiz_answers[${i}].answer too long`;
      }
    }
    return null;
  }
  if (!isObject(qa)) return 'quiz_answers must be an object or array';
  const keys = Object.keys(qa);
  if (keys.length > MAX_QUIZ_ANSWERS) return 'quiz_answers has too many fields';
  for (const k of keys) {
    if (k.length > MAX_FIELD_NAME) return 'quiz_answers field name too long';
    const v = qa[k];
    if (v == null) continue;
    if (typeof v === 'string') {
      if (v.length > MAX_QUIZ_VALUE) return `quiz_answers.${k} too long`;
    } else if (Array.isArray(v)) {
      if (v.length > 200) return `quiz_answers.${k} too many items`;
      for (const item of v) {
        if (item != null && typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean') {
          return `quiz_answers.${k} contains invalid item`;
        }
        if (typeof item === 'string' && item.length > MAX_QUIZ_VALUE) return `quiz_answers.${k} item too long`;
      }
    } else if (typeof v !== 'number' && typeof v !== 'boolean') {
      return `quiz_answers.${k} has unsupported type`;
    }
  }
  return null;
}

function validateQuizSubmission(data) {
  if (!isObject(data)) return { ok: false, error: 'Invalid request body' };

  const patientErr = validatePatient(data.patient);
  if (patientErr) return { ok: false, error: patientErr };

  if (!data.product || typeof data.product !== 'string' || data.product.length > 200) {
    return { ok: false, error: 'product is required' };
  }

  if (data.dose != null && typeof data.dose !== 'string' && typeof data.dose !== 'number') {
    return { ok: false, error: 'dose has invalid type' };
  }

  // Optional compound/plan-tier hint — narrows a coarse vertical key
  // ('hair-loss', 'longevity', …) to a specific offering in lib/products.js.
  if (data.compound != null && (typeof data.compound !== 'string' || data.compound.length > 100)) {
    return { ok: false, error: 'compound is invalid or too long' };
  }

  const qaErr = validateQuizAnswers(data.quiz_answers);
  if (qaErr) return { ok: false, error: qaErr };

  const narrativeFields = ['allergies', 'current_medications', 'medical_conditions'];
  for (const k of narrativeFields) {
    if (data[k] != null && boundedString(data[k], 4000) === null) {
      return { ok: false, error: `${k} is invalid or too long` };
    }
  }

  if (data.social_history != null && !isObject(data.social_history)) {
    return { ok: false, error: 'social_history must be an object' };
  }

  // Optional test marker — routes the voucher to MDI sandbox (never billed).
  if (data.is_test != null && typeof data.is_test !== 'boolean') {
    return { ok: false, error: 'is_test must be a boolean' };
  }

  // Optional payment receipt (checkout → submitQuiz after an approved charge).
  // Only ever used to record a Patient Order on the MDI side and to key the
  // retry queue — the server never trusts it for pricing.
  const payErr = validatePayment(data.payment);
  if (payErr) return { ok: false, error: payErr };

  return { ok: true, value: data };
}

function validatePayment(p) {
  if (p == null) return null;
  if (!isObject(p)) return 'payment must be an object';
  if (!p.transaction_id || typeof p.transaction_id !== 'string' || p.transaction_id.length > 200) {
    return 'payment.transaction_id is required';
  }
  if (p.amount != null) {
    const n = Number(p.amount);
    if (!Number.isFinite(n) || n < 0 || n > 100000) return 'payment.amount invalid';
  }
  if (p.plan_months != null && !(Number.isInteger(Number(p.plan_months)) && Number(p.plan_months) > 0 && Number(p.plan_months) <= 24)) {
    return 'payment.plan_months invalid';
  }
  if (p.card_last4 != null && !(typeof p.card_last4 === 'string' && /^\d{0,4}$/.test(p.card_last4))) {
    return 'payment.card_last4 invalid';
  }
  if (p.card_brand != null && !(typeof p.card_brand === 'string' && p.card_brand.length <= 40)) {
    return 'payment.card_brand invalid';
  }
  if (p.simulated != null && typeof p.simulated !== 'boolean') {
    return 'payment.simulated must be a boolean';
  }
  return null;
}

module.exports = { validateQuizSubmission };
