/**
 * Template registry — maps the string key lib/email/engine.js's
 * sendTransactional() receives to the render(data) => {subject, preheader, html}
 * function that builds the actual email. One entry per template file in
 * this directory (transactional templates) plus every step of every drip
 * journey defined in lib/email/journeys.js (journeys/*.js).
 */
const orderConfirmed = require('./order-confirmed');
const completeIntake = require('./complete-intake');
const caseWaiting = require('./case-waiting');
const caseCompleted = require('./case-completed');
const orderShipped = require('./order-shipped');
const clinicianMessage = require('./clinician-message');
const paymentFailed = require('./payment-failed');
const refundIssued = require('./refund-issued');
const renewalCharged = require('./renewal-charged');
const renewalFailed = require('./renewal-failed');
const subscriptionCancelled = require('./subscription-cancelled');
const hubWelcome = require('./hub-welcome');

const quizAbandoned = require('./journeys/quiz-abandoned');
const checkoutAbandoned = require('./journeys/checkout-abandoned');
const browseAbandoned = require('./journeys/browse-abandoned');
const intakeReminder = require('./journeys/intake-reminder');
const onboarding = require('./journeys/onboarding');
const refillReminder = require('./journeys/refill-reminder');
const winback = require('./journeys/winback');
const leadNurture = require('./journeys/lead-nurture');
const patientNewsletter = require('./journeys/patient-newsletter');

const TEMPLATES = {
  'order-confirmed': orderConfirmed.render,
  'complete-intake': completeIntake.render,
  'case-waiting': caseWaiting.render,
  'case-completed': caseCompleted.render,
  'order-shipped': orderShipped.render,
  'clinician-message': clinicianMessage.render,
  'payment-failed': paymentFailed.render,
  'refund-issued': refundIssued.render,
  'renewal-charged': renewalCharged.render,
  'renewal-failed': renewalFailed.render,
  'subscription-cancelled': subscriptionCancelled.render,
  'hub-welcome': hubWelcome.render,

  'quiz-abandoned-1': quizAbandoned.step1,
  'quiz-abandoned-2': quizAbandoned.step2,
  'quiz-abandoned-3': quizAbandoned.step3,

  'checkout-abandoned-1': checkoutAbandoned.step1,
  'checkout-abandoned-2': checkoutAbandoned.step2,
  'checkout-abandoned-3': checkoutAbandoned.step3,

  'browse-abandoned-1': browseAbandoned.step1,
  'browse-abandoned-2': browseAbandoned.step2,

  'intake-reminder-1': intakeReminder.step1,
  'intake-reminder-2': intakeReminder.step2,

  'onboarding-1': onboarding.step1,
  'onboarding-2': onboarding.step2,
  'onboarding-3': onboarding.step3,

  'refill-reminder': refillReminder.render,

  'winback-1': winback.step1,
  'winback-2': winback.step2,

  // The two campaign journeys are the exception to the one-entry-per-step rule
  // above: their 29 steps are thin adapters over docs/email-campaign/flow.js's
  // own EMAILS array (see journeys/lead-nurture.js), so listing each key here
  // by hand would only be a second place for the same list to drift.
  //   lead-nurture-a1 … -a16, lead-nurture-c1 … -c4  (20 steps)
  //   patient-newsletter-b1 … -b9                    (9 steps)
  // Every key is still spelled out literally in lib/email/journeys.js.
  ...leadNurture.TEMPLATES,
  ...patientNewsletter.TEMPLATES
};

module.exports = { TEMPLATES };
