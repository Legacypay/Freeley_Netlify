/**
 * Freeley A/B Testing Framework
 * 
 * Lightweight client-side split testing. Uses localStorage to persist
 * experiment assignments. Fires events to GA4 when configured.
 * 
 * Usage:
 *   <div data-ab="hero-headline" data-variant-a="Lose Weight for Life" data-variant-b="Your Weight Loss Journey Starts Here">
 *     Default headline
 *   </div>
 * 
 * Or in JS:
 *   const variant = ABTest.assign('cta-color', ['green', 'orange']);
 *   if (variant === 'orange') { button.style.background = '#e8a735'; }
 */

(function() {
  'use strict';

  const STORAGE_PREFIX = 'freeley_ab_';

  const ABTest = {
    /**
     * Assign a user to a variant for a given experiment.
     * Persists in localStorage so the user always sees the same variant.
     */
    assign(experimentId, variants = ['a', 'b']) {
      const key = STORAGE_PREFIX + experimentId;
      let assigned = localStorage.getItem(key);

      if (!assigned || !variants.includes(assigned)) {
        // Random assignment
        assigned = variants[Math.floor(Math.random() * variants.length)];
        localStorage.setItem(key, assigned);
      }

      // Fire GA4 event if available
      if (typeof gtag === 'function') {
        gtag('event', 'ab_test_assignment', {
          experiment_id: experimentId,
          variant: assigned
        });
      }

      return assigned;
    },

    /**
     * Track a conversion event for an experiment.
     */
    convert(experimentId, conversionAction = 'click') {
      const key = STORAGE_PREFIX + experimentId;
      const variant = localStorage.getItem(key);

      if (!variant) return;

      if (typeof gtag === 'function') {
        gtag('event', 'ab_test_conversion', {
          experiment_id: experimentId,
          variant: variant,
          action: conversionAction
        });
      }

      // Also log to console in dev
      console.log(`[AB] ${experimentId}: variant "${variant}" converted (${conversionAction})`);
    },

    /**
     * Get the current assignment for an experiment without re-assigning.
     */
    getVariant(experimentId) {
      return localStorage.getItem(STORAGE_PREFIX + experimentId);
    },

    /**
     * Reset a specific experiment (useful for testing).
     */
    reset(experimentId) {
      localStorage.removeItem(STORAGE_PREFIX + experimentId);
    },

    /**
     * Reset all experiments.
     */
    resetAll() {
      Object.keys(localStorage)
        .filter(k => k.startsWith(STORAGE_PREFIX))
        .forEach(k => localStorage.removeItem(k));
    }
  };

  // ─── Auto-apply data-ab attributes ──────────────────────
  function autoApply() {
    document.querySelectorAll('[data-ab]').forEach(el => {
      const experimentId = el.getAttribute('data-ab');
      const variantA = el.getAttribute('data-variant-a');
      const variantB = el.getAttribute('data-variant-b');

      if (!variantA || !variantB) return;

      const assigned = ABTest.assign(experimentId, ['a', 'b']);

      if (assigned === 'a') {
        el.textContent = variantA;
      } else {
        el.textContent = variantB;
      }

      el.setAttribute('data-ab-active', assigned);
    });
  }

  // ─── Init ──────────────────────────────────────────────────
  function init() {
    autoApply();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose globally
  window.ABTest = ABTest;
})();
