/**
 * Freeley Analytics — GA4 + Meta Pixel Tracking
 * 
 * ┌──────────────────────────────────────────────┐
 * │  TO ACTIVATE: Replace the IDs below with     │
 * │  your real GA4 Measurement ID & Meta Pixel ID│
 * └──────────────────────────────────────────────┘
 * 
 * Tracks: page views, quiz funnel, CTA clicks, 
 * email captures, plan views, scroll depth, engagement.
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════
  // ▼▼▼ REPLACE THESE WITH YOUR REAL IDS ▼▼▼
  const GA4_ID = 'G-YE9R925LJP';          // LIVE — Freeley GA4
  const META_PIXEL_ID = 'XXXXXXXXXX';     // From business.facebook.com/events_manager
  // ▲▲▲ REPLACE THESE WITH YOUR REAL IDS ▲▲▲
  // ═══════════════════════════════════════════════════════

  const IS_GA4_LIVE = GA4_ID !== 'G-XXXXXXXXXX';
  const IS_META_LIVE = META_PIXEL_ID !== 'XXXXXXXXXX';

  // ─── Install GA4 ──────────────────────────────────────
  function installGA4() {
    if (!IS_GA4_LIVE) {
      console.log('[Analytics] GA4 in preview mode — replace GA4_ID in analytics.js to activate');
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID, {
      send_page_view: true,
      cookie_flags: 'SameSite=None;Secure'
    });
  }

  // ─── Install Meta Pixel ───────────────────────────────
  function installMetaPixel() {
    if (!IS_META_LIVE) {
      console.log('[Analytics] Meta Pixel in preview mode — replace META_PIXEL_ID in analytics.js to activate');
      return;
    }

    !function(f,b,e,v,n,t,s){
      if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  // ─── Unified Event Tracker ────────────────────────────
  const Analytics = {
    /**
     * Track a custom event to both GA4 and Meta Pixel.
     */
    track(eventName, params = {}) {
      // Log in dev
      console.log(`[Analytics] ${eventName}`, params);

      // GA4
      if (IS_GA4_LIVE && typeof gtag === 'function') {
        gtag('event', eventName, params);
      }

      // Meta Pixel
      if (IS_META_LIVE && typeof fbq === 'function') {
        fbq('trackCustom', eventName, params);
      }
    },

    // ─── Pre-defined Conversion Events ────────────────

    /** User starts the quiz */
    quizStart() {
      this.track('quiz_start', {
        page: window.location.pathname
      });
      if (IS_META_LIVE && typeof fbq === 'function') {
        fbq('track', 'StartTrial');
      }
    },

    /** User completes a quiz step */
    quizStep(stepNumber, stepName) {
      this.track('quiz_step', {
        step_number: stepNumber,
        step_name: stepName
      });
    },

    /** User completes the quiz and sees results */
    quizComplete(goals) {
      this.track('quiz_complete', {
        goals: goals.join(', '),
        goal_count: goals.length
      });
      if (IS_META_LIVE && typeof fbq === 'function') {
        fbq('track', 'CompleteRegistration', {
          content_name: 'Quiz Completion',
          content_category: goals[0] || 'unknown'
        });
      }
    },

    /** User clicks a primary CTA button */
    ctaClick(ctaText, location) {
      this.track('cta_click', {
        cta_text: ctaText,
        location: location,
        page: window.location.pathname
      });
    },

    /** User views a treatment plan/product */
    planView(planName, price) {
      this.track('plan_view', {
        plan_name: planName,
        price: price,
        page: window.location.pathname
      });
      if (IS_META_LIVE && typeof fbq === 'function') {
        fbq('track', 'ViewContent', {
          content_name: planName,
          content_type: 'product',
          value: parseFloat(price) || 0,
          currency: 'USD'
        });
      }
    },

    /** Email captured (exit intent or form) */
    emailCapture(source) {
      this.track('email_capture', {
        source: source,
        page: window.location.pathname
      });
      if (IS_META_LIVE && typeof fbq === 'function') {
        fbq('track', 'Lead', {
          content_name: source
        });
      }
    },

    /** User shares referral link */
    referralShare() {
      this.track('referral_share', {
        page: window.location.pathname
      });
    },

    /** Scroll depth milestone */
    scrollDepth(percentage) {
      this.track('scroll_depth', {
        depth: percentage,
        page: window.location.pathname
      });
    }
  };

  // ─── Auto-track CTA Clicks ────────────────────────────
  function bindCTATracking() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('a.hero-btn, a.mbs-cta, a.referral-cta, button.quiz-next, a.exit-success-cta, .nav-cta, .sticky-atc a, .plan-cta');
      if (btn) {
        const text = btn.textContent.trim().substring(0, 50);
        const section = btn.closest('section')?.className || 'page';
        Analytics.ctaClick(text, section);
      }

      // Referral specific
      if (e.target.closest('.referral-cta')) {
        Analytics.referralShare();
      }
    });
  }

  // ─── Auto-track Scroll Depth ──────────────────────────
  function bindScrollTracking() {
    const milestones = [25, 50, 75, 100];
    const fired = new Set();

    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percentage = Math.round((scrollTop / docHeight) * 100);

      milestones.forEach(m => {
        if (percentage >= m && !fired.has(m)) {
          fired.add(m);
          Analytics.scrollDepth(m);
        }
      });
    }, { passive: true });
  }

  // ─── Auto-track Quiz Funnel ───────────────────────────
  function bindQuizTracking() {
    // Only on quiz page
    if (!window.location.pathname.includes('quiz')) return;

    // Track quiz start when first option is selected
    let quizStarted = false;
    document.addEventListener('click', (e) => {
      if (e.target.closest('.option-card') && !quizStarted) {
        quizStarted = true;
        Analytics.quizStart();
      }
    });

    // Override the step transition to track each step
    const originalNextStep = window.nextStep;
    if (typeof originalNextStep === 'function') {
      window.nextStep = function(n) {
        const stepNames = {
          1: 'Treatment Goal',
          2: 'Save Progress',
          3: 'Health Profile',
          4: 'Current Symptoms',
          5: 'Medical History',
          6: 'Activity & Preferences'
        };
        Analytics.quizStep(n, stepNames[n] || `Step ${n}`);
        return originalNextStep.call(this, n);
      };
    }

    // Track results screen
    const originalShowResults = window.showResultsActual;
    if (typeof originalShowResults === 'function') {
      window.showResultsActual = function(isRestoring) {
        if (!isRestoring) {
          const goals = Array.from(
            document.querySelectorAll('#step-1 .option-card.selected .option-label')
          ).map(el => el.textContent);
          Analytics.quizComplete(goals);
        }
        return originalShowResults.call(this, isRestoring);
      };
    }
  }

  // ─── Auto-track Plan/Product Views ────────────────────
  function bindProductTracking() {
    // Track when product sections come into view
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const section = entry.target;
          const title = section.querySelector('.product-title, h2')?.textContent || 'Unknown';
          const price = section.querySelector('.current-price')?.textContent || '';
          Analytics.planView(title, price.replace(/[^0-9.]/g, ''));
          observer.unobserve(section);
        }
      });
    }, { threshold: 0.5 });

    document.querySelectorAll('.product-details, #product, .plan-card').forEach(el => {
      observer.observe(el);
    });
  }

  // ─── Init ─────────────────────────────────────────────
  function init() {
    installGA4();
    installMetaPixel();
    bindCTATracking();
    bindScrollTracking();
    bindQuizTracking();
    bindProductTracking();

    console.log(`[Analytics] Initialized — GA4: ${IS_GA4_LIVE ? 'LIVE' : 'PREVIEW'} | Meta: ${IS_META_LIVE ? 'LIVE' : 'PREVIEW'}`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose globally for other scripts
  window.FreeleyAnalytics = Analytics;
})();
