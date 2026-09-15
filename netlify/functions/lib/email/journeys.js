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
 *
 * `lead-nurture` (20 steps over 90 days) and `patient-newsletter` (9 steps
 * over 90 days) are the 2026-09-14 campaign flow — the copy for both lives in
 * docs/email-campaign/flow.js and renders through
 * lib/email-templates/campaign-render.js. They superseded `quiz-abandoned`,
 * `browse-abandoned` and `onboarding`, which are kept defined below but are no
 * longer enrolled into by anything (contacts already mid-journey keep
 * receiving them).
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
  },

  // Track A (education → offer, days 0–30) and Track C (re-engagement, days
  // 45–90) are deliberately one journey: a purchase cancels the journey as a
  // whole, so the C steps of someone who bought on day 20 are never sent.
  'lead-nurture': {
    kind: 'marketing',
    steps: [
      { delayMs: 0, template: 'lead-nurture-a1' },
      { delayMs: 1 * DAY, template: 'lead-nurture-a2' },
      { delayMs: 3 * DAY, template: 'lead-nurture-a3' },
      { delayMs: 5 * DAY, template: 'lead-nurture-a4' },
      { delayMs: 7 * DAY, template: 'lead-nurture-a5' },
      { delayMs: 9 * DAY, template: 'lead-nurture-a6' },
      { delayMs: 11 * DAY, template: 'lead-nurture-a7' },
      { delayMs: 13 * DAY, template: 'lead-nurture-a8' },
      { delayMs: 15 * DAY, template: 'lead-nurture-a9' },
      { delayMs: 17 * DAY, template: 'lead-nurture-a10' },
      { delayMs: 19 * DAY, template: 'lead-nurture-a11' },
      { delayMs: 21 * DAY, template: 'lead-nurture-a12' },
      { delayMs: 23 * DAY, template: 'lead-nurture-a13' },
      { delayMs: 25 * DAY, template: 'lead-nurture-a14' },
      { delayMs: 28 * DAY, template: 'lead-nurture-a15' },
      { delayMs: 30 * DAY, template: 'lead-nurture-a16' },
      { delayMs: 45 * DAY, template: 'lead-nurture-c1' },
      { delayMs: 60 * DAY, template: 'lead-nurture-c2' },
      { delayMs: 75 * DAY, template: 'lead-nurture-c3' },
      { delayMs: 90 * DAY, template: 'lead-nurture-c4' }
    ]
  },

  'patient-newsletter': {
    kind: 'marketing',
    steps: [
      { delayMs: 1 * DAY, template: 'patient-newsletter-b1' },
      { delayMs: 4 * DAY, template: 'patient-newsletter-b2' },
      { delayMs: 10 * DAY, template: 'patient-newsletter-b3' },
      { delayMs: 14 * DAY, template: 'patient-newsletter-b4' },
      { delayMs: 21 * DAY, template: 'patient-newsletter-b5' },
      { delayMs: 30 * DAY, template: 'patient-newsletter-b6' },
      { delayMs: 45 * DAY, template: 'patient-newsletter-b7' },
      { delayMs: 60 * DAY, template: 'patient-newsletter-b8' },
      { delayMs: 90 * DAY, template: 'patient-newsletter-b9' }
    ]
  }
};

module.exports = { JOURNEYS, HOUR, DAY };
