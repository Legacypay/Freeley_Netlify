/**
 * Freeley — Email Campaign Flow (live since 2026-09-14)
 *
 * Single source of truth for the 29-email campaign — both for the
 * client-facing PDF (`scripts/build-campaign-pdf.js`) AND for what actually
 * goes out: netlify/functions/lib/email-templates/campaign-render.js reads
 * this same EMAILS array to render the `lead-nurture` (A1–A16 + C1–C4) and
 * `patient-newsletter` (B1–B9) journey steps. Editing copy here changes live
 * email — it is no longer a document.
 *
 * The copy is design-independent: every email is subject + preheader +
 * headline + body + CTA, plus a *suggested* hero image from `public/assets/`
 * and a layout hint.
 *
 * Merge tags: {{first_name}} (falls back to "there"), {{vertical}} (the
 * interest the lead picked in the quiz), {{resume_url}}, {{promo_code}},
 * {{hub_url}}, {{keep_url}}. Every tag used below must have a resolver in
 * campaign-render.js's MERGE map — an unresolved tag renders as nothing, and
 * a bracketed [PLACEHOLDER] would render literally, so neither is allowed to
 * survive in this file (tests/unit/email-campaign.test.js enforces both).
 *
 * Image paths are relative to `public/` — i.e. they are live at
 * https://freeley.com/<path>, which is what the email HTML would reference.
 */

const SITE = 'https://freeley.com';
const QUIZ = `${SITE}/assessment-quiz`;
const HUB = `${SITE}/hub`;
// A16's four "what held you back?" options are ordinary links to the FAQ page;
// the ?why= value is what distinguishes them in analytics (see A16's notes).
// campaign-render.js adds the utm_* params to this and every other link.
const FEEDBACK = `${SITE}/faqs?why=`;

const TRACKS = [
  {
    id: 'A',
    name: 'Lead Nurture — "Meet Freeley"',
    audience: 'Anyone who gave us an email but has not purchased: quiz step 2, exit-intent popup, checkout email field, the waitlist list.',
    cadence: '16 emails over 30 days. Every other day for the first two weeks (education), then twice a week (conversion).',
    entry: 'Email captured (captureLead.js) or waitlist import.',
    exit: 'A purchase moves the contact to Track B immediately. No purchase after Day 30 → Track C.',
    color: '#0f6b45',
    intro: 'A newsletter-style sequence that earns trust before it asks for the sale. The first 11 emails are education and story; the offer only appears once the reader knows who prescribes, who compounds, what it costs and what to expect. Vertical-aware: Emails A4 and A8 have a version per product line based on what the lead said they were interested in.'
  },
  {
    id: 'B',
    name: 'Patient Newsletter — "The Freeley Journal"',
    audience: 'Every paying patient, from the day of purchase.',
    cadence: '9 emails over the first 90 days, then a monthly edition.',
    entry: 'Successful payment (create-authnet-transaction.js).',
    exit: 'Subscription cancelled or refund issued → moves to the existing win-back journey.',
    color: '#123c2c',
    intro: 'Runs alongside the transactional emails (order confirmed, shipped, clinician message, receipts) — those stay exactly as they are. This track is the "how do I get the most out of this" layer: first-week prep, side-effect playbook, habits, progress check-ins, refill heads-up, referral, 90-day review. It replaces the current 3-step onboarding drip.'
  },
  {
    id: 'C',
    name: 'Re-engagement — "Still here"',
    audience: 'Leads who finished Track A without buying and have not unsubscribed.',
    cadence: '4 emails, Day 45 → Day 90 after capture, then the contact is parked on a monthly newsletter only.',
    entry: 'Track A completed, no purchase.',
    exit: 'A purchase (→ Track B) or the Day-90 sunset email (→ monthly newsletter only).',
    color: '#8a6a2e',
    intro: 'Low frequency, honest tone. Each email gives one new reason to look again (a new plan option, the cost of waiting, a plain "what held you back?"), and the last one openly says we will stop emailing — which protects deliverability for everyone else.'
  }
];

/** @type {Array<object>} */
const EMAILS = [
  // ───────────────────────────── TRACK A ─────────────────────────────
  {
    id: 'A1', track: 'A', day: 0, send: 'Immediately after capture',
    name: 'Welcome',
    goal: 'Set expectations, introduce the 3-step model, get the assessment finished.',
    segment: 'All leads',
    layout: 'Hero image + 3-step timeline + one button',
    subject: 'Welcome to Freeley — here’s how this works',
    preheader: 'Real physicians, real pharmacies, no waiting room. Three steps.',
    headline: 'Care that never starts in a waiting room.',
    body: [
      'Hi {{first_name}},',
      'You just took the first step toward treatment that fits your life instead of your calendar. Here’s the whole process, start to finish:',
      '- **Tell us about you.** A 2-minute online assessment — no appointment, no phone tag.',
      '- **A licensed U.S. physician reviews it.** Usually within 24–48 hours. If treatment is right for you, they write the prescription.',
      '- **It ships to your door.** Compounded by a licensed 503A pharmacy, delivered discreetly, with your care team a message away.',
      'Over the next few weeks we’ll send you the short version of everything patients ask us before starting — who prescribes, what it costs, what the first month feels like. No pressure, just answers.'
    ],
    cta: { label: 'Start my 2-minute assessment', url: QUIZ },
    ps: 'Already finished your assessment? Ignore that button — you’ll hear from your clinician soon.',
    image: { src: 'assets/home/hero-image.png', why: 'Same hero as the homepage — instant brand recognition for someone who was just on the site.' },
    alt: ['assets/howItsWork/Hero.png', 'assets/home/4-cards.png']
  },
  {
    id: 'A2', track: 'A', day: 1, send: 'Day 1, morning',
    name: 'Why Freeley exists',
    goal: 'Brand story. Make the reader feel understood, not sold to.',
    segment: 'All leads',
    layout: 'Editorial letter: large serif headline, single column, small signature',
    subject: 'Why we built Freeley',
    preheader: 'Most people don’t fail at treatment. They fail at getting to it.',
    headline: 'The hardest part of getting help was always the getting.',
    body: [
      'Hi {{first_name}},',
      'Think about the last time you almost did something about your weight, your hair, your sex life, your energy. What stopped you probably wasn’t the treatment. It was the six-week wait for an appointment, the time off work, the awkward conversation at a pharmacy counter, the surprise bill.',
      'We built Freeley to remove every one of those steps. You answer questions online. A licensed physician reviews them. A licensed pharmacy compounds your treatment. It arrives at your door in a plain box. Your clinician is a message away the whole time.',
      'Same medicine, same doctors, same pharmacies — minus everything that used to get in the way.',
      'That’s it. That’s the company.'
    ],
    cta: { label: 'See how it works', url: `${SITE}/how-it-works` },
    image: { src: 'assets/home/Real_Doctors.png', why: '"Real doctors" badge reinforces the credibility claim right under the story.' },
    alt: ['assets/about/value-integrity.jpg', 'assets/promo/dr-team.png']
  },
  {
    id: 'A3', track: 'A', day: 3, send: 'Day 3',
    name: 'Who’s behind your prescription',
    goal: 'Answer "is this legit?" — physicians, 503A pharmacies, what compounded means.',
    segment: 'All leads',
    layout: 'Three stacked cards (physician / pharmacy / testing) with icon images',
    subject: 'Who actually writes your prescription?',
    preheader: 'Licensed U.S. physicians and 503A pharmacies. Here’s what that means.',
    headline: 'Real physicians. Licensed pharmacies. Nothing in between.',
    body: [
      'Hi {{first_name}},',
      'The most common question we get isn’t about price or side effects. It’s "is this real?" Fair question. Here’s exactly who touches your case:',
      '- **A licensed U.S. physician.** Every assessment is read by a doctor licensed in your state. They decide whether treatment is appropriate, which one, and at what starting point — and they can say no.',
      '- **A licensed 503A compounding pharmacy.** Your treatment is prepared for you by a pharmacy regulated by your state board of pharmacy, under a physician’s prescription. "Compounded" means made-to-order, not made-up.',
      '- **Third-party testing.** Our partner pharmacies test for potency and sterility before anything ships.',
      'You can read more about our pharmacy partners and quality standards any time — we published it because we think you should be able to check.'
    ],
    cta: { label: 'Read our quality standards', url: `${SITE}/quality-trust` },
    image: { src: 'assets/pricing/Licensed_Pharmacy.png', why: 'Pair with Physician-Prescribed.png and Third-Party_Tested.png as the three card icons.' },
    alt: ['assets/pricing/Physician-Prescribed.png', 'assets/pricing/Third-Party_Tested.png', 'assets/wl/Compounded_securely_in_503A_Pharmacies.png']
  },
  {
    id: 'A4', track: 'A', day: 5, send: 'Day 5',
    name: 'Your treatment, explained (vertical-specific)',
    goal: 'The first email that talks about *their* problem. Four variants, one per product line, chosen from the quiz answer.',
    segment: 'By {{vertical}} — falls back to the Weight Loss version if unknown',
    layout: 'Full-width lifestyle hero + 3 benefit tiles + button',
    variants: [
      {
        vertical: 'Weight loss',
        subject: 'Your last diet didn’t fail. Your biology did.',
        preheader: 'Why willpower was never the problem — and what GLP-1 treatment changes.',
        headline: 'Your last diet didn’t fail. Your biology did.',
        body: [
          'Hi {{first_name}},',
          'If you’ve lost weight before and watched it come back, that’s not a character flaw. Your body defends its weight with hunger hormones, and they don’t care how disciplined you are.',
          'GLP-1 treatment works on that signal directly:',
          '- **Quiets the "food noise."** The constant background thinking about the next meal gets turned down.',
          '- **You stay full longer.** Digestion slows, so a normal portion actually satisfies.',
          '- **Improves metabolic health.** Blood sugar and appetite regulation move in the right direction together.',
          'A physician decides if it’s right for you and where to start. Plans begin at $199/month on the 12-month plan — physician review, treatment and shipping included.'
        ],
        cta: { label: 'See if GLP-1 treatment is right for me', url: `${SITE}/weight-loss` },
        image: { src: 'assets/promo/weight-loss-lifestyle.jpg', why: 'Lifestyle shot, not a vial — this email is about how they feel, not the product.' },
        alt: ['assets/wl/QuietsThe_FoodNoise_.png', 'assets/wl/YouStayFullLonger.png', 'assets/wl/ImprovesMetabolicHealth.png']
      },
      {
        vertical: 'Hair loss',
        subject: 'Six months from now, they’ll ask what you did',
        preheader: 'Stop the shedding first. Then regrow. Here’s the timeline.',
        headline: 'They won’t stop asking what you did.',
        body: [
          'Hi {{first_name}},',
          'Hair loss is one of the few things that is genuinely easier to stop than to reverse — which is why starting earlier matters more than starting perfectly.',
          'Physician-prescribed hair treatment works in two stages:',
          '- **Stops shedding in its tracks.** The hormone signal that miniaturizes follicles gets blocked.',
          '- **Reactivates dormant follicles.** Follicles that thinned out but never died get a second chance.',
          '- **Fits your routine.** A daily step you’ll forget you’re doing by week two.',
          'Most patients see shedding slow within 2–3 months and visible regrowth by month 4–6. Plans start at $49/month on the 24-month plan.'
        ],
        cta: { label: 'Start my hair assessment', url: `${SITE}/hair-loss` },
        image: { src: 'assets/hl/hero-loss-couple.png', why: 'Confident, social image — the outcome, not the problem.' },
        alt: ['assets/hl/Stops_Shedding_In_Its_Tracks.png', 'assets/hl/Reactivates_Dormant_Follicles.png', 'assets/hl/8_out_of_10_see_visible_regrowth.png']
      },
      {
        vertical: 'Sexual wellness',
        subject: 'Reliable. Fast-acting. Delivered in a plain box.',
        preheader: 'Prescription sexual wellness treatment, without the pharmacy counter.',
        headline: 'Live your best sex life.',
        body: [
          'Hi {{first_name}},',
          'Most men wait years before dealing with this. Not because treatment doesn’t work — it does, extremely well — but because the process of getting it felt worse than the problem.',
          'Freeley removes the process:',
          '- **Fast-acting formulas.** Dissolves under the tongue, works in minutes rather than an hour.',
          '- **Control & confidence.** Options for as-needed use or a daily routine, chosen by your physician.',
          '- **Totally discreet.** No pharmacy line, no labeled bottle, no conversation you didn’t choose to have.',
          'Plans start at $59/month on the 24-month plan. Your physician picks the formula; you pick when.'
        ],
        cta: { label: 'Start my private assessment', url: `${SITE}/sexual-wellness` },
        image: { src: 'assets/sw/hero-intimate.png', why: 'Intimacy/couple image; keep it warm, not clinical.' },
        alt: ['assets/sw/Control_&_Confidence.png', 'assets/sw/Targeted_Absorption.png', 'assets/lifestyle/sw-lifestyle-confidence.jpg']
      },
      {
        vertical: 'Longevity',
        subject: 'Optimize how you perform and age',
        preheader: 'Physician-prescribed peptide therapy, fully online.',
        headline: 'Optimize how you perform & age.',
        body: [
          'Hi {{first_name}},',
          'Energy that fades by 3pm. Sleep that doesn’t restore. Recovery that takes twice as long as it used to. These aren’t just "getting older" — they are measurable processes, and some of them can be supported.',
          'Freeley’s longevity protocols are built around three targets:',
          '- **Cellular energy.** Supporting the molecules your cells use to make and repair themselves.',
          '- **Deep, restorative sleep.** The kind that changes how the next day feels.',
          '- **Detox & immunity.** Helping your body clear what slows it down.',
          'Your physician builds the protocol around your goals and labs. Plans start at $79/month on the 24-month plan.'
        ],
        cta: { label: 'Build my protocol', url: `${SITE}/longevity` },
        image: { src: 'assets/lifestyle/lg-lifestyle-vitality.jpg', why: 'Vitality lifestyle shot; tiles below can use the three benefit images.' },
        alt: ['assets/l/Cellular_Energy.png', 'assets/l/Deep,Restorative Sleep.png', 'assets/l/Detox_&_Immunity.png']
      }
    ]
  },
  {
    id: 'A5', track: 'A', day: 7, send: 'Day 7',
    name: 'What the assessment asks (and why)',
    goal: 'Remove the friction of the unknown. Reassure on privacy.',
    segment: 'All leads who have not completed the quiz',
    layout: 'Checklist / FAQ layout with the intake illustration',
    subject: 'What we ask in the assessment — and why',
    preheader: 'Two minutes, five topics, zero judgment.',
    headline: 'Two minutes. Here’s exactly what’s in it.',
    body: [
      'Hi {{first_name}},',
      'People sometimes stall on the assessment because they don’t know what’s coming. So here it is:',
      '- **Your goal.** What you want to change and how long it’s been on your mind.',
      '- **Your health history.** Conditions, medications, allergies — the things a physician must know before prescribing.',
      '- **Your habits.** Sleep, activity, alcohol. Not to judge — to choose the right starting point.',
      '- **Your ID.** Telehealth law requires a photo ID so your physician knows who they’re treating.',
      '- **Your contact details.** So the clinician can reach you if they have a question.',
      'Everything you enter is stored on HIPAA-compliant infrastructure and seen only by your care team. Nothing is shared with employers, insurers, or anyone else.'
    ],
    cta: { label: 'Finish my assessment', url: '{{resume_url}}' },
    image: { src: 'assets/howItsWork/Complete_Your_Health_Intake.png', why: 'The "complete your intake" illustration from the How It Works page.' },
    alt: ['assets/howItsWork/HIPAA-Compliant Infrastructure.png']
  },
  {
    id: 'A6', track: 'A', day: 9, send: 'Day 9',
    name: 'One price. No surprises.',
    goal: 'Pricing transparency: what’s included, why longer plans cost less.',
    segment: 'All leads',
    layout: 'Price ladder table + "what’s included" tiles',
    subject: 'One price. No surprises.',
    preheader: 'Physician, treatment, shipping, messaging — one number.',
    headline: 'What you pay is what you pay.',
    body: [
      'Hi {{first_name}},',
      'Traditional care hides its price in three places: the visit, the pharmacy, and the bill that arrives later. Freeley has one number and it includes:',
      '- Physician review and ongoing clinical oversight',
      '- Your compounded treatment',
      '- Shipping, straight to your door',
      '- Unlimited messaging with your care team',
      '- Automatic refills, so you never run out',
      'The longer the plan, the lower the monthly price — because it lets our pharmacy partners plan ahead. GLP-1 weight loss, for example, runs from $299/month on a 1-month plan to $179/month on the 24-month plan. The table above is the full ladder for every product line.',
      'No insurance needed. Cancel any time.'
    ],
    cta: { label: 'See full pricing', url: `${SITE}/pricing` },
    image: { src: 'assets/pricing/See_how_much.png', why: 'The pricing-page graphic. Show the price ladder as a simple table underneath.' },
    alt: ['assets/wl/slide-price-semaglutide.webp', 'assets/about/flat-rate-dosing.png'],
    notes: 'The rendered price table is read live from pricing.json at send time (campaign-render.js\'s priceLadder()), now including the 24-month column — the client confirmed those tier prices as final on 2026-09-15.'
  },
  {
    id: 'A7', track: 'A', day: 11, send: 'Day 11',
    name: 'Is it safe? An honest answer',
    goal: 'Address safety head-on. Builds more trust than avoiding it.',
    segment: 'All leads',
    layout: 'Editorial, single column, with the safety icons as a 3-up row',
    subject: 'Is it safe? An honest answer.',
    preheader: 'What a physician screens for, what side effects are common, who shouldn’t start.',
    headline: 'The safety question, answered like an adult.',
    body: [
      'Hi {{first_name}},',
      'We could tell you "it’s perfectly safe" and you’d rightly stop trusting us. Here’s the real answer.',
      '**Every treatment has side effects.** Most are mild and fade within the first weeks — for GLP-1s, that’s typically nausea or fullness; for hair treatment, it’s rare; for sexual wellness, headaches or flushing. Your physician tells you what to expect for your specific treatment before you start.',
      '**That’s why a physician screens you first.** Some conditions and medications mean a treatment isn’t right for you. The assessment exists so a doctor can catch that — and they do say no when they should.',
      '**And why the care team stays on the case.** If anything feels wrong, you message your clinician from your Hub and hear back, on average, within 24 hours. Serious concerns get escalated the same day.',
      'Safe doesn’t mean risk-free. It means someone qualified is paying attention. That’s the part we can promise.'
    ],
    cta: { label: 'Read about how we keep patients safe', url: `${SITE}/how-it-works` },
    image: { src: 'assets/howItsWork/yourSafety1.png', why: 'Use yourSafety1/2/3 as the three-up icon row (screening / monitoring / escalation).' },
    alt: ['assets/howItsWork/Adverse Event Monitoring.png', 'assets/howItsWork/Emergency Escalation.png', 'assets/home/24hr.Avg.physician.esponse.png']
  },
  {
    id: 'A8', track: 'A', day: 13, send: 'Day 13',
    name: 'What the first 90 days look like (vertical-specific)',
    goal: 'Make results concrete with a realistic timeline. Sets honest expectations.',
    segment: 'All leads, section by vertical',
    layout: 'Vertical timeline graphic (week 1 / month 1 / month 3) + button',
    subject: 'Week 1, month 1, month 3: what actually happens',
    preheader: 'A realistic timeline, not a before/after fantasy.',
    headline: 'A timeline of what you’ll feel.',
    body: [
      'Hi {{first_name}},',
      'Results aren’t a light switch. Here’s the honest shape of the first three months for most patients — your physician will tailor this to you.',
      '**Weight loss:** Week 1–2, appetite noticeably quieter. Month 1, first few pounds and smaller portions feeling normal. Month 3, steady loss and a dose your physician has adjusted to you.',
      '**Hair loss:** Month 1–2, shedding starts to slow (this is the goal, even if the mirror hasn’t caught up). Month 3–4, thinning stabilizes. Month 6, visible regrowth for most patients.',
      '**Sexual wellness:** First use, results. Month 1, you’ve found the timing that works. Month 3, it’s simply not something you think about anymore.',
      '**Longevity:** Week 2–4, sleep and daytime energy shift first. Month 2–3, recovery, focus and the markers your physician tracks.',
      'The one thing every timeline has in common: none of it starts until the assessment does.'
    ],
    cta: { label: 'Start my assessment', url: QUIZ },
    image: { src: 'assets/l/A_Timeline_of_What_You_ll_Feel.jpg', why: 'Existing timeline graphic; swap for the vertical’s own "Here’s what happens next" image per variant.' },
    alt: ['assets/wl/Here_sWhatHappensNext.jpg', 'assets/hl/Here_s_What_Happens_Next.jpg', 'assets/sw/Here_sWhatHappensNext.jpg'],
    notes: 'DELIBERATELY ONE EMAIL, not four variants like A4. A timeline is short enough that all four fit in one body, and seeing the other three is reassuring rather than noise ("this is what the whole service looks like"). B4 works the same way. Only A4 — where the whole email is a pitch for one product line — splits by vertical.'
  },
  {
    id: 'A9', track: 'A', day: 15, send: 'Day 15',
    name: 'Five things people get wrong about online prescriptions',
    goal: 'Newsletter-style myth-busting. Shareable, low-pressure.',
    segment: 'All leads',
    layout: 'Numbered editorial list, no product imagery, one small button',
    subject: '5 things people get wrong about online prescriptions',
    preheader: 'No, it’s not "a bot writing scripts."',
    headline: 'Five myths, five minutes.',
    body: [
      'Hi {{first_name}},',
      '**1. "It’s not a real doctor."** It is. Licensed in your state, with the same responsibilities as the one down the road. They can and do decline cases.',
      '**2. "Compounded means knock-off."** Compounding is a licensed pharmacy preparing a medication for an individual prescription. It’s regulated by state boards of pharmacy and has existed far longer than the internet.',
      '**3. "You just click and it ships."** You answer a full medical history and upload ID. A physician reads it. Then it ships.',
      '**4. "It’s only for people who are really struggling."** Most Freeley patients are people who simply got tired of waiting to deal with something.',
      '**5. "The price is a trap."** One number, everything included, cancel any time. We put the whole ladder on a public pricing page for a reason.',
      'Got a sixth one? Reply to this email — we read every one.'
    ],
    cta: { label: 'Read our FAQ', url: `${SITE}/faqs` },
    image: { src: 'assets/home/Real_Providers.png', why: 'Small badge only — this email is text-led.' },
    alt: ['assets/home/Pharmacy_Grade.png']
  },
  {
    id: 'A10', track: 'A', day: 17, send: 'Day 17',
    name: 'Why there’s no testimonial here yet',
    goal: 'Hold the social-proof slot honestly until a consented patient story exists, and invite the reader to ask questions (which is also how the first testimonial arrives).',
    segment: 'All leads',
    layout: 'Editorial, single column, one lifestyle image, one button',
    subject: 'We could fake this one. We’d rather not.',
    preheader: 'Why there’s no glossy testimonial in this email.',
    headline: 'No stock photo. No invented quote.',
    body: [
      'Hi {{first_name}},',
      'This is the email where most companies show you a before-and-after and a five-star quote from "Sarah M."',
      'We publish patient stories only when a real patient has given us written permission, and results vary from person to person — so until one of ours says yes, this space stays empty. We think that tells you more about us than a stock photo would.',
      'What we can tell you is the part that is checkable: every case is read by a physician licensed in your state, every treatment is prepared by a licensed 503A pharmacy, and your care team answers messages in under 24 hours on average.',
      'And if you’d rather hear it from a person than from a marketing email — reply to this one and ask us anything. A real person answers.'
    ],
    cta: { label: 'Start my assessment', url: QUIZ },
    image: { src: 'assets/wl/why-trust-freeley-lifestyle.jpg', why: 'Lifestyle shot, deliberately not a patient portrait. Before/after pairs exist in assets/wl and assets/hl but need documented patient consent before use in email.' },
    alt: ['assets/about/value-integrity.jpg', 'assets/home/Real_Providers.png'],
    notes: 'HOLDING VERSION. The approved testimonial copy needs a real, consented patient story from Anthony (one per vertical is ideal). Until then this ships the honest "we won\'t fake it" version rather than a fabricated quote — swap it back the day a consented story exists.'
  },
  {
    id: 'A11', track: 'A', day: 19, send: 'Day 19',
    name: 'Discreet by design',
    goal: 'Privacy, packaging, HIPAA, the Hub.',
    segment: 'All leads',
    layout: 'Image of plain packaging + 3 short privacy points',
    subject: 'What the box looks like',
    preheader: 'Plain packaging, HIPAA-grade privacy, and a Hub only you can open.',
    headline: 'Nobody needs to know. So nobody will.',
    body: [
      'Hi {{first_name}},',
      'A lot of people who hesitate don’t hesitate about the treatment. They hesitate about who might find out. So, plainly:',
      '- **The box is plain.** No product name, no branding beyond a return address. It looks like anything else you ordered online.',
      '- **Your data stays in your care team’s hands.** Your medical information lives on HIPAA-compliant infrastructure. We never sell it and never share it with employers or insurers. Our marketing emails — like this one — never contain medical details.',
      '- **Your Hub is yours.** Messages, order tracking, receipts and documents live behind your own login, not in your inbox.',
      'Discretion isn’t a feature we added. It’s the reason the whole thing works online.'
    ],
    cta: { label: 'Read our privacy commitment', url: `${SITE}/hipaa` },
    image: { src: 'assets/home/48hr_Door-to-Door_Delivery.png', why: 'Delivery badge; if a plain-box product photo is shot later, use that instead.' },
    alt: ['assets/howItsWork/Delivered_to_Your_Door.png', 'assets/howItsWork/Document Vault.png', 'assets/shared/slide-hub.webp']
  },
  {
    id: 'A12', track: 'A', day: 21, send: 'Day 21',
    name: 'Still on the fence? Let’s talk about it',
    goal: 'Objection handling: insurance, approval, cancellation, cost of doing nothing.',
    segment: 'All leads, no purchase',
    layout: 'Q&A accordion-style list, single button',
    subject: 'Still on the fence?',
    preheader: 'The four things that usually hold people back — answered.',
    headline: 'The four things that usually hold people back.',
    body: [
      'Hi {{first_name}},',
      '**"Do I need insurance?"** No. One flat price, no claims, no prior authorization.',
      '**"What if the physician says no?"** Then you don’t pay for treatment. If you are not approved by our physicians, your consultation and any prepaid amounts are refunded in full.',
      '**"What if it doesn’t work for me?"** Your physician can adjust your treatment, and you can cancel your plan at any time from your Hub — no phone call required.',
      '**"Is now the right time?"** Every month of waiting is a month of the same. The assessment takes two minutes and commits you to nothing.',
      'Anything else? Reply to this email. A real person answers.'
    ],
    cta: { label: 'Take the 2-minute assessment', url: QUIZ },
    image: { src: 'assets/home/96_Patient satisfaction.png', why: 'Satisfaction stat badge next to the Q&A.' },
    alt: ['assets/home/cta-girl-desktop.png'],
    notes: 'The declined-case refund line is quoted from the live refund answer on src/pages/pricing.astro ("If you are not approved for treatment by our physicians, your consultation and any prepaid amounts are 100% refunded immediately"), softened to "refunded in full" so the email never promises a timing the ops flow can\'t guarantee. Anthony should confirm it matches the policy he actually operates.'
  },
  {
    id: 'A13', track: 'A', day: 23, send: 'Day 23',
    name: 'The offer: 10% off your first order',
    goal: 'First explicit promotion. Only after 12 trust-building emails.',
    segment: 'All leads, no purchase',
    layout: 'Offer card: big code, expiry, one button',
    subject: '10% off your first order, this week only',
    preheader: 'Use code {{promo_code}} at checkout. Ends Sunday.',
    headline: 'A little push, if you wanted one.',
    body: [
      'Hi {{first_name}},',
      'You’ve heard from us a lot over the past three weeks. If Freeley sounds right for you, here’s a reason to stop thinking about it this week:',
      '**{{promo_code}} — 10% off your first order.** Enter it at checkout. It works on every plan and every product line, and expires Sunday at midnight.',
      'Two minutes for the assessment. A physician replies within 24–48 hours. Then it’s on its way.'
    ],
    cta: { label: 'Claim 10% off', url: `${QUIZ}?promo={{promo_code}}` },
    ps: 'The code only works once per person, so hold on to it if you’re not ready today — you’ve got until Sunday.',
    image: { src: 'assets/home/cta-girl-desktop.png', why: 'Existing CTA visual; the offer card sits on top.' },
    alt: ['assets/wl/cta-desk.png', 'assets/hl/cta-desk.png'],
    notes: 'WELCOME10 exists in pricing.json as a placeholder — Anthony must confirm the code and value. If no promo, this email becomes a "free shipping / plan comparison" email instead.'
  },
  {
    id: 'A14', track: 'A', day: 25, send: 'Day 25',
    name: 'Freeley vs. the clinic vs. the big brands',
    goal: 'Comparison. Time and money saved; what you give up by waiting.',
    segment: 'All leads, no purchase',
    layout: 'Three-column comparison table + button',
    subject: 'Freeley vs. the clinic vs. the big telehealth brands',
    preheader: 'Time, cost, and who’s actually watching your case.',
    headline: 'Three ways to get treatment. One of them fits in a lunch break.',
    body: [
      'Hi {{first_name}},',
      '**The clinic.** 2–6 weeks to an appointment. Time off work. A separate pharmacy trip. An insurance-dependent bill that shows up later.',
      '**The big telehealth brands.** Fast, but often a call center in between you and a clinician, tiered upsells, and pricing that changes after month one.',
      '**Freeley.** A 2-minute assessment. A licensed physician in 24–48 hours. One flat price that includes the medicine, the shipping and the messaging. The same care team for the whole plan.',
      'We’re not the only option. We’re the one designed for people who’ve already waited long enough.'
    ],
    cta: { label: 'Compare plans', url: `${SITE}/compare` },
    image: { src: 'assets/home/4-cards.png', why: 'Homepage comparison cards.' },
    alt: ['assets/home/graph-home.png']
  },
  {
    id: 'A15', track: 'A', day: 28, send: 'Day 28 (Friday if possible)',
    name: 'Offer reminder: ends Sunday',
    goal: 'Urgency, short, honest.',
    segment: 'Leads who opened A13 but did not purchase',
    layout: 'Very short — headline, two lines, button',
    subject: 'Your 10% ends Sunday',
    preheader: 'Last reminder for {{promo_code}}.',
    headline: 'Sunday, midnight.',
    body: [
      'Hi {{first_name}},',
      'Quick one: your code {{promo_code}} for 10% off your first order expires Sunday at midnight. After that we won’t be re-sending it — we’d rather not be that company.',
      'Two minutes. A physician. Your door.'
    ],
    cta: { label: 'Use my code', url: `${QUIZ}?promo={{promo_code}}` },
    image: { src: 'assets/home/Frame_399.png', why: 'Optional small graphic; this email works with no image at all.' },
    alt: []
  },
  {
    id: 'A16', track: 'A', day: 30, send: 'Day 30',
    name: 'One question before we go quiet',
    goal: 'Feedback + cadence reset. Ask what held them back; move to lower frequency.',
    segment: 'All leads, no purchase',
    layout: 'Plain text style, single-choice reply links',
    subject: 'One question before we go quiet',
    preheader: 'What held you back? One click, no hard feelings.',
    headline: 'What held you back?',
    body: [
      'Hi {{first_name}},',
      'You’ve had a month of Freeley in your inbox and you haven’t started — which is completely fine. We’d just like to know why, so we can do better. One click:',
      `- [It was the price](${FEEDBACK}price)`,
      `- [I’m not sure it’s safe](${FEEDBACK}safety)`,
      `- [It’s not the right time](${FEEDBACK}timing)`,
      `- [I was just browsing](${FEEDBACK}browsing)`,
      'From here on we’ll only email you a couple of times a month — patient stories, new treatments, honest answers. If you ever want to pick this back up, the assessment will be right where you left it.'
    ],
    cta: { label: 'Finish my assessment instead', url: '{{resume_url}}' },
    image: { src: 'assets/about/value-transparency.jpg', why: 'Optional; a text-only version performs well here.' },
    alt: [],
    notes: 'The four options are plain UTM-tagged links to the FAQ page (?why=… distinguishes them) — the click is the data. Reading it means looking at the A16 utm_content rows in GA4; nothing stores the answer server-side.'
  },

  // ───────────────────────────── TRACK B ─────────────────────────────
  {
    id: 'B1', track: 'B', day: 1, send: 'Day 1 after purchase (after the transactional order/intake emails)',
    name: 'Welcome to your program',
    goal: 'Orient the new patient: the first 30 days, the Hub, how to reach the care team.',
    segment: 'All new patients',
    layout: 'Hero + 4-step timeline + Hub screenshot',
    subject: 'Welcome to Freeley — your first 30 days',
    preheader: 'What happens now, where to find everything, who to message.',
    headline: 'You’re in. Here’s your first month.',
    body: [
      'Hi {{first_name}},',
      'Welcome to Freeley. Your order is confirmed and your intake is on its way to a physician. Here’s the shape of the next 30 days:',
      '- **Days 1–2: Clinician review.** A licensed physician reads your intake. If they have a question, you’ll get an email and a Hub message.',
      '- **Days 2–5: Pharmacy.** Once approved, your prescription goes to our compounding pharmacy partner and is prepared for you.',
      '- **Days 5–7: Delivery.** You’ll get a tracking number the moment it ships.',
      '- **Days 7–30: Getting started.** We’ll send you a short guide before your first dose, a side-effect playbook, and a check-in.',
      'Your Hub is where everything lives: order status, messages with your care team, receipts and documents.'
    ],
    cta: { label: 'Open my Hub', url: HUB },
    image: { src: 'assets/shared/slide-journey.webp', why: 'Journey graphic; pair with slide-hub.webp as a second image.' },
    alt: ['assets/shared/slide-hub.webp', 'assets/home/whatdoexpect.png']
  },
  {
    id: 'B2', track: 'B', day: 4, send: 'Day 4 (around delivery)',
    name: 'Before your first dose',
    goal: 'Practical prep: storage, timing, what to have on hand. Vertical-specific instructions live in the Hub, not the email.',
    segment: 'All new patients',
    layout: 'Checklist with icons',
    subject: 'Before your first dose: a 3-minute read',
    preheader: 'Storage, timing, and what to have on hand.',
    headline: 'Your treatment is almost here. Here’s how to be ready.',
    body: [
      'Hi {{first_name}},',
      'A few things that make the first week smoother — the specific instructions for your treatment are in your Hub, written by your physician.',
      '- **Read your treatment plan first.** It’s in your Hub under Documents. It covers how to take your treatment, when, and how to store it.',
      '- **Pick a consistent time.** Same day of the week or same time of day — whatever your plan says — and put it in your phone.',
      '- **Check storage.** Some treatments need the fridge, some don’t. Your plan says which.',
      '- **Start a simple log.** Date, how you felt, anything unusual. Two lines is enough. It makes your check-ins with your clinician far more useful.',
      '- **Know where the message button is.** Hub → Messages. Any question at all, before or after your first dose, that’s the place.'
    ],
    cta: { label: 'Read my treatment plan', url: HUB },
    image: { src: 'assets/howItsWork/You_Receive_Your_Treatment_Plan.png', why: 'Treatment-plan illustration.' },
    alt: ['assets/howItsWork/Smart Reminders.png'],
    notes: 'No medication names or doses in the email itself (PHI guard) — all specifics stay in the Hub.'
  },
  {
    id: 'B3', track: 'B', day: 10, send: 'Day 10',
    name: 'The side-effect playbook',
    goal: 'Reduce panic and drop-off in week one. When to wait, when to message.',
    segment: 'All patients',
    layout: 'Two-column "normal / message us" table',
    subject: 'What’s normal in week one (and what isn’t)',
    preheader: 'A calm guide to side effects: when to wait it out, when to message.',
    headline: 'Your week-one playbook.',
    body: [
      'Hi {{first_name}},',
      'Most side effects show up in the first two weeks and fade as your body adjusts. Here’s how to think about them:',
      '**Usually normal — give it a few days:** mild nausea or fullness, a headache, feeling more tired than usual, a mild reaction at an injection site, a little flushing.',
      '**Message your care team today:** anything severe, anything that lasts more than a few days, anything that worries you. There is no such thing as a silly message — that’s literally what the care team is for, and average response time is under 24 hours.',
      '**Call 911 or go to the ER:** trouble breathing, chest pain, a severe allergic reaction, or anything that feels like an emergency. Don’t wait for a message reply.',
      'Your physician may adjust your treatment based on what you report — that’s not a setback, it’s the process working.'
    ],
    cta: { label: 'Message my care team', url: HUB },
    image: { src: 'assets/howItsWork/Adverse Event Monitoring.png', why: 'Monitoring illustration; keep the tone calm.' },
    alt: ['assets/howItsWork/Physician Messaging.png']
  },
  {
    id: 'B4', track: 'B', day: 14, send: 'Day 14',
    name: 'Habits that multiply your results',
    goal: 'Lifestyle content that makes treatment work better. Newsletter style; vertical-matched section.',
    segment: 'All patients, section by vertical',
    layout: 'Editorial with lifestyle photography, 3–4 tips',
    subject: 'The habits that make treatment work harder',
    preheader: 'Small things that compound. Pick one this week.',
    headline: 'Treatment does the heavy lifting. These make it lift more.',
    body: [
      'Hi {{first_name}},',
      'Two weeks in. Treatment is working on your biology; here are the things that work on everything else. Pick one, not all four.',
      '**Weight loss:** Protein first at every meal — you’ll be eating less, so make it count. Water before you’re thirsty. A 20-minute walk beats a gym plan you won’t keep.',
      '**Hair:** Gentle on wet hair, no tight styles, and a photo of the same spot in the same light every two weeks — your eyes lie, photos don’t.',
      '**Sexual wellness:** Alcohol and a heavy meal both blunt results. Sleep and cardio improve them more than anything sold in a gas station.',
      '**Longevity:** A fixed wake-up time does more for energy than any supplement. Morning daylight, protein, and a real bedtime.',
      'Next week we’ll ask how it’s going. Keep that two-line log going.'
    ],
    cta: { label: 'Log a note in my Hub', url: HUB },
    image: { src: 'assets/lifestyle/wl-lifestyle-active.jpg', why: 'One lifestyle image per vertical: wl-lifestyle-kitchen, hl-lifestyle-grooming, sw-lifestyle-confidence, lg-lifestyle-science.' },
    alt: ['assets/lifestyle/wl-lifestyle-kitchen.jpg', 'assets/lifestyle/hl-lifestyle-grooming.jpg', 'assets/lifestyle/lg-lifestyle-science.jpg']
  },
  {
    id: 'B5', track: 'B', day: 21, send: 'Day 21',
    name: 'Three-week check-in',
    goal: 'Engagement + clinical signal. Get them to message the care team with a real update.',
    segment: 'All patients',
    layout: 'Short, personal, one button',
    subject: 'Three weeks in — how’s it going?',
    preheader: 'Tell your care team. It changes what they do next.',
    headline: 'How’s it going, honestly?',
    body: [
      'Hi {{first_name}},',
      'Three weeks is when patterns show up. Better than expected, about what you thought, or not what you hoped — all three are useful to your physician, and only one of them gets reported without a nudge.',
      'Take 60 seconds and send your care team a message with three things: what’s changed, what side effects you’ve had, and one question. That message is what your physician uses to decide whether to adjust anything at your next refill.',
      'And if the answer is "great, nothing to report" — send that too. They like those.'
    ],
    cta: { label: 'Send my 3-week update', url: HUB },
    image: { src: 'assets/howItsWork/Progress Dashboard.png', why: 'Progress dashboard illustration.' },
    alt: ['assets/howItsWork/Physician Messaging.png']
  },
  {
    id: 'B6', track: 'B', day: 30, send: 'Day 30',
    name: 'Month one: what patients notice',
    goal: 'Milestone reinforcement. Normalize dose adjustments; explain refills are automatic.',
    segment: 'All patients',
    layout: 'Milestone card + timeline of months 2–3',
    subject: 'One month with Freeley',
    preheader: 'What most patients notice by now, and what changes next.',
    headline: 'Month one, done.',
    body: [
      'Hi {{first_name}},',
      'A month ago you filled out a form. Here’s what usually has happened by now — and what comes next.',
      '**What most patients notice by month one:** the first measurable change — a quieter appetite, less shedding, a routine that just works, better sleep. Not the finish line; the proof of concept.',
      '**What your physician does now:** reviews your check-in and decides whether your treatment stays the same or steps up. Adjustments are normal and expected — most plans are designed to increase gradually.',
      '**What you don’t need to do:** re-order. Refills are automatic. You’ll get a heads-up email before each one, and you can change your address, card, or plan from your Hub.'
    ],
    cta: { label: 'See my plan', url: HUB },
    image: { src: 'assets/howItsWork/Ongoing_Care_&_Automatic_Refills.png', why: 'Ongoing care & refills illustration.' },
    alt: ['assets/home/graph-home.png']
  },
  {
    id: 'B7', track: 'B', day: 45, send: '~Day 45 (or 7 days before the next billing cycle, whichever is sooner)',
    name: 'Your refill is coming up',
    goal: 'No-surprise billing. Reduce chargebacks and "I forgot" cancellations.',
    segment: 'All patients with an upcoming renewal',
    layout: 'Simple notice card with date, amount, and three action links',
    subject: 'Heads-up: your next refill ships soon',
    preheader: 'Nothing to do unless something changed.',
    headline: 'Your next refill is on its way soon.',
    body: [
      'Hi {{first_name}},',
      'Just so nothing surprises you: your next refill is scheduled to ship soon, and the card on file will be charged your plan’s usual price on that date. The exact date and amount are on your plan in the Hub. You don’t need to do anything.',
      'If something has changed, it takes a minute in your Hub:',
      '- **Moved?** Update your shipping address.',
      '- **New card?** Update your payment method.',
      '- **Need a pause?** Message your care team — they’ll help you decide whether to adjust or hold.',
      'Questions about your treatment itself go to your care team, not to billing. Same button.'
    ],
    cta: { label: 'Review my plan', url: HUB },
    image: { src: 'assets/howItsWork/Shipment Tracking.png', why: 'Shipment tracking illustration.' },
    alt: [],
    notes: 'Complements the existing refill-reminder journey (3 days before ARB renewal); this one is the earlier, friendlier heads-up. Its step fires at a fixed +45d from purchase, NOT off the real ARB billing date, so it deliberately names no date or amount and points at the Hub for both — the `refill-reminder` journey is the one timed to the actual renewal.'
  },
  {
    id: 'B8', track: 'B', day: 60, send: 'Day 60',
    name: 'Know someone who’s been putting it off?',
    goal: 'Referral. Only works if a referral program exists; otherwise a plain "share" email.',
    segment: 'Patients active at day 60',
    layout: 'Warm, short, one share button',
    subject: 'Know someone who’s been putting it off?',
    preheader: 'You were there two months ago. Pass it on.',
    headline: 'Two months ago, that was you.',
    body: [
      'Hi {{first_name}},',
      'Most Freeley patients tell us the same thing: they wish they’d started sooner, and they know someone who’s exactly where they were two months ago.',
      'If that’s you, forward this email to them — or just send them the link below.',
      'No pressure, no spam. Just the same two-minute assessment you took.'
    ],
    // Points at /how-it-works rather than the homepage: the person opening
    // this link is a friend who has never heard of Freeley, and that page
    // answers "what is this" before asking for anything.
    cta: { label: 'Share Freeley', url: `${SITE}/how-it-works` },
    image: { src: 'assets/quiz/boy-girl.png', why: 'Friendly two-person visual.' },
    alt: ['assets/home/hero-mob.png'],
    notes: 'Ships as the plain forward-to-a-friend version: no referral program exists, so there is no {{referral_code}} and no incentive to promise. If Anthony approves one later, this is the email that carries it.'
  },
  {
    id: 'B9', track: 'B', day: 90, send: 'Day 90',
    name: 'Your 90-day review',
    goal: 'Milestone + retention + cross-sell + testimonial request.',
    segment: 'Patients active at day 90',
    layout: 'Review card, "what’s next" section, other-verticals row',
    subject: 'Ninety days. Let’s look back.',
    preheader: 'Where you started, where you are, and what’s next.',
    headline: 'Ninety days with Freeley.',
    body: [
      'Hi {{first_name}},',
      'Three months ago you started something most people spend years thinking about. Here’s a good moment to take stock.',
      '**Look back.** Open your first check-in message in your Hub and compare it to today. That gap is the whole point.',
      '**Talk to your physician.** Month three is when treatment plans get reviewed — whether to hold, adjust, or plan the next phase. Send an update so that review is based on you, not on averages.',
      '**Tell us.** If Freeley has worked for you, a two-sentence review helps the next person who’s on the fence. Reply to this email; we’ll ask before we ever publish anything.',
      '**And if you’re curious:** the same physicians, pharmacy partners and flat pricing cover hair, sexual wellness, weight and longevity. Patients often add a second focus around now.'
    ],
    cta: { label: 'Send my 90-day update', url: HUB },
    image: { src: 'assets/home/your_journey_What_to_expect_on.jpg', why: 'Journey graphic; the four vertical tiles (weightloss/hairloss/sexuallwellness + longevity) as a row below.' },
    alt: ['assets/home/weightloss.png', 'assets/home/hairloss.png', 'assets/home/sexuallwellness.png', 'assets/quiz/longevity.png']
  },

  // ───────────────────────────── TRACK C ─────────────────────────────
  {
    id: 'C1', track: 'C', day: 45, send: 'Day 45 after capture',
    name: 'What’s changed since you looked',
    goal: 'Give a genuinely new reason to return: new plan lengths, new products, new content.',
    segment: 'Track A completed, no purchase',
    layout: 'Newsletter: 3 short "new" items',
    subject: 'A few things have changed since you looked',
    preheader: 'New plan options, new treatments, same physicians.',
    headline: 'Since you last looked.',
    body: [
      'Hi {{first_name}},',
      'It’s been about six weeks. A quick catch-up on what’s new at Freeley:',
      '- **Longer plans, lower prices.** 12- and 24-month plans bring the monthly price down significantly — GLP-1 weight loss from $199/month on the 12-month plan.',
      '- **Four areas, one care team.** Weight, hair, sexual wellness and longevity all run through the same physicians, the same pharmacy partners and the same flat pricing.',
      '- **Everything in one place.** Your Hub holds order tracking, receipts, documents and a direct line to your clinician — no phone tree, no portal password you have to ask for.',
      'Your assessment is still saved. It picks up exactly where you left it.'
    ],
    cta: { label: 'Pick up my assessment', url: '{{resume_url}}' },
    image: { src: 'assets/home/hero-green-2.png', why: 'Alternate homepage hero; feels fresh vs. A1.' },
    alt: [],
    notes: 'The three bullets are all evergreen and true today. Swap them quarterly for genuinely new items (a new treatment, a new Hub feature, a physician Q&A) so a lead who reaches Day 45 twice never reads the same "what\'s new".'
  },
  {
    id: 'C2', track: 'C', day: 60, send: 'Day 60 after capture',
    name: 'The math on waiting',
    goal: 'Cost of inaction, stated respectfully. Vertical-aware line.',
    segment: 'Track A completed, no purchase',
    layout: 'Editorial, one stat graphic',
    subject: 'The math on waiting',
    preheader: 'Not a guilt trip. Just arithmetic.',
    headline: 'Waiting has a price too.',
    body: [
      'Hi {{first_name}},',
      'This isn’t a guilt trip. It’s just the arithmetic people don’t usually do.',
      'Two months ago you were interested enough to give us your email. Since then, the thing you wanted to change has had two more months to do what it does — weight that stays, hair that keeps thinning, a problem that keeps being a problem. Two months from now, the same.',
      'Or: two minutes today, a physician in 24–48 hours, and two months from now you’re the one with a check-in message to look back on.',
      'Same price either way. Only one of them moves.'
    ],
    cta: { label: 'Take the 2-minute assessment', url: QUIZ },
    image: { src: 'assets/wl/graph.png', why: 'Existing progress graph as a "direction of travel" visual.' },
    alt: ['assets/sw/graph.png']
  },
  {
    id: 'C3', track: 'C', day: 75, send: 'Day 75 after capture',
    name: 'One last, plain ask',
    goal: 'Final direct offer (re-issue promo if allowed) with no tricks.',
    segment: 'Track A completed, no purchase',
    layout: 'Very short, offer card',
    subject: 'One last, plain ask',
    preheader: 'If it’s a yes, here’s the door. If not, that’s okay.',
    headline: 'No countdown. Just the door.',
    body: [
      'Hi {{first_name}},',
      'We’ve told you who prescribes, who compounds, what it costs and what to expect. There isn’t much more to say, so we’ll just ask plainly:',
      'If Freeley is right for you, the assessment is here and takes two minutes. Your code {{promo_code}} still works for 10% off your first order.',
      'If it isn’t — that’s genuinely fine. Next email we’ll ask if you’d rather we stop.'
    ],
    cta: { label: 'Start my assessment', url: QUIZ },
    image: { src: 'assets/home/cta-girl-mob.png', why: 'Optional.' },
    alt: []
  },
  {
    id: 'C4', track: 'C', day: 90, send: 'Day 90 after capture',
    name: 'Should we stop?',
    goal: 'Sunset / preference email. Protects sender reputation; keeps only engaged contacts.',
    segment: 'Track A + C completed, no purchase, no click in 30 days',
    layout: 'Plain text style, two buttons',
    subject: 'Should we stop emailing you?',
    preheader: 'One click keeps you on the monthly letter. No click, and we go quiet.',
    headline: 'We’d rather ask than assume.',
    body: [
      'Hi {{first_name}},',
      'You haven’t opened much from us lately, and that’s a perfectly good answer. We don’t want to be noise in your inbox.',
      'If you’d like to keep getting our monthly letter — patient stories, new treatments, honest answers, once a month — click below. If you do nothing, we’ll take the hint and stop.',
      'Either way, the assessment stays saved under your email, whenever you want it.'
    ],
    cta: { label: 'Keep me on the monthly letter', url: '{{keep_url}}' },
    image: { src: '', why: 'No image — plain text performs best for a sunset email.' },
    alt: [],
    notes: '{{keep_url}} is the same HMAC-signed emailPreferences link the unsubscribe footer uses, plus &keep=1 — that signature is what identifies the clicker, so the preference is actually recorded against their address (a bare /?keep=1 link carries no identity and would be a no-op button). Contacts who do not click receive nothing further — good for deliverability.'
  }
];

/** Cross-cutting rules that apply to every email above. */
const RULES = [
  { title: 'Text is independent of design', body: 'Every email is complete as subject + preheader + headline + body + CTA. The image and layout columns are suggestions from the existing site assets in public/assets/ — the designer can swap any of them without touching the copy.' },
  { title: 'No medical details in marketing email', body: 'Track B (patients) never names a specific medication or dose — those live in the Hub. This is enforced in code (the PHI guard refuses to send a rendered email that names a compound). Track A speaks about treatment categories (GLP-1, hair treatment, sexual wellness, peptides), which is the lead’s own stated interest, never a clinical fact about them. Subject lines never mention the vertical.' },
  { title: 'Send window and cadence', body: 'All sends are clamped to 9am–8pm in the recipient’s timezone (defaults to America/New_York). Never more than one campaign email per day per contact; transactional emails (order, shipping, clinician messages) are exempt.' },
  { title: 'Exits are automatic', body: 'A purchase immediately stops Track A/C and starts Track B. A cancellation stops Track B and starts the existing win-back journey. An unsubscribe stops everything except transactional email.' },
  { title: 'Compliance', body: 'Every campaign email carries an unsubscribe link. EMAIL_POSTAL_ADDRESS is deliberately not set — the client decided the CAN-SPAM footer address line is not needed right now, so the footer omits it. Testimonials require written patient consent — A10 ships a holding version rather than an invented quote. Before/after images are never used without documented consent. The refund line in A12 is quoted from the live pricing page — Anthony still has to confirm it matches the policy actually operated for declined cases. The promo code is pricing.json\'s WELCOME10, set `active: false` (2026-09-15) — A13/A15/C3 quote it but it will not discount anything at checkout until it is flipped back on with a confirmed code/value.' },
  { title: 'Personalization tokens', body: '{{first_name}} (falls back to "there"), {{vertical}} (from the quiz; A4 falls back to the Weight loss variant), {{resume_url}} (returns to the saved assessment, falls back to /assessment-quiz), {{promo_code}} (WELCOME10 — currently inactive, see Compliance above), {{hub_url}}, {{keep_url}} (C4\'s signed "keep me subscribed" link). There is no billing-date or referral token: B7 is on a fixed +45d schedule rather than the real ARB date, and no referral program exists.' },
  { title: 'Measurement', body: 'campaign-render.js stamps every freeley.com link in every email with utm_source=email, utm_medium=campaign, utm_campaign=<journey> (lead-nurture or patient-newsletter) and utm_content=<email id> — centrally, at render time, so no email can ship untagged. The goal metric for Track A is assessment completions; for Track B it is refill retention at day 45 and day 90; for Track C it is assessment resumes.' }
];

// Still open now that the flow is live — each one is shipped in its safest
// form, not blocked on an answer, but each would change an email if answered.
const OPEN_QUESTIONS = [
  'Promo: WELCOME10 is set `active: false` in pricing.json (2026-09-15) — deliberately not implemented yet. A13 (Day 23), A15 (Day 28) and C3 (Day 75) still quote it, so flip it back on (with a confirmed code/value and a real "expires Sunday" mechanism — pricing.json has no expiry field today) before any lead reaches Day 23.',
  'A12\'s refund line is quoted from the pricing page. Confirm it matches the policy you actually operate for declined cases.',
  'Referral program: yes/no, and the incentive. B8 ships as a plain forward-to-a-friend email until there is one.',
  'One consented patient story per vertical — A10 is holding the slot with an honest "we won\'t fake it" email until you have one.',
  'Anything in these emails you’d say differently — this file is what sends, so a change here is a change to live email.'
];

module.exports = { SITE, TRACKS, EMAILS, RULES, OPEN_QUESTIONS };
