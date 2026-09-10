/**
 * Declarative drip-campaign definitions. Each journey is a named sequence
 * of { delayMs, template } steps, enrolled as a whole (engine.js's
 * enrollJourney schedules every step up front as queue items tagged with
 * one enrollment_id) and cancelled as a whole (cancelJourney flips the
 * journey's status; processEmailQueue skips any queued step whose
 * enrollment no longer matches "active" — so cancelling never needs to
 * search-and-delete individual queue entries).
 *
 * `kind: 'marketing'` gets an unsubscribe link + List-Unsubscribe header
 * (CAN-SPAM); the two lifecycle journeys below (`intake-reminder`,
 * `refill-reminder`) are borderline-transactional reminders about an
 * already-started order, but still carry unsubscribe out of caution — they
 * are drip campaigns, not a one-shot system email.
 *
 * `refill-reminder` has no fixed steps here — its schedule depends on the
 * purchased plan (subscription cadence or one-time days-supply), computed
 * at enroll time by the caller and passed as an explicit `steps` override
 * to enrollJourney(). See create-authnet-transaction.js.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const JOURNEYS = {
  'quiz-abandoned': {
    kind: 'marketing',
    steps: [
      { delayMs: 1 * HOUR, template: 'quiz-abandoned-1' },
      { delayMs: 24 * HOUR, template: 'quiz-abandoned-2' },
      { delayMs: 72 * HOUR, template: 'quiz-abandoned-3' }
    ]
  },

  'checkout-abandoned': {
    kind: 'marketing',
    steps: [
      { delayMs: 1 * HOUR, template: 'checkout-abandoned-1' },
      { delayMs: 24 * HOUR, template: 'checkout-abandoned-2' },
      { delayMs: 72 * HOUR, template: 'checkout-abandoned-3' }
    ]
  },

  'browse-abandoned': {
    kind: 'marketing',
    steps: [
      { delayMs: 10 * 60 * 1000, template: 'browse-abandoned-1' },
      { delayMs: 48 * HOUR, template: 'browse-abandoned-2' }
    ]
  },

  'intake-reminder': {
    kind: 'marketing',
    steps: [
      { delayMs: 24 * HOUR, template: 'intake-reminder-1' },
      { delayMs: 72 * HOUR, template: 'intake-reminder-2' }
    ]
  },

  onboarding: {
    kind: 'marketing',
    steps: [
      { delayMs: 2 * DAY, template: 'onboarding-1' },
      { delayMs: 7 * DAY, template: 'onboarding-2' },
      { delayMs: 21 * DAY, template: 'onboarding-3' }
    ]
  },

  'refill-reminder': {
    kind: 'marketing',
    steps: [] // built dynamically per purchase — see module comment above
  },

  winback: {
    kind: 'marketing',
    steps: [
      { delayMs: 7 * DAY, template: 'winback-1' },
      { delayMs: 30 * DAY, template: 'winback-2' }
    ]
  }
};

module.exports = { JOURNEYS, HOUR, DAY };
