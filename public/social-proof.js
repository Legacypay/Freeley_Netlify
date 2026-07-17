/**
 * Freeley — Site Utilities
 * 
 * LegitScript-compliant version. All simulated social proof,
 * fake activity badges, toast notifications, and artificial
 * scarcity ("spots remaining") have been PERMANENTLY REMOVED.
 * 
 * Retained features:
 * 1. Trust badge strip injection (factual statements only)
 * 2. PWA manifest + service worker registration
 */

(function() {
  'use strict';

  // ─── Styles ────────────────────────────────────────────────
  function injectStyles() {
    const css = `
    /* ──── Trust Badge Strip ──────────────────────────────── */
    .sp-trust-strip {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 16px 24px;
      background: rgba(61,140,94,0.06);
      border-top: 1px solid rgba(61,140,94,0.12);
      border-bottom: 1px solid rgba(61,140,94,0.12);
      flex-wrap: wrap;
    }
    .sp-trust-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11.5px;
      color: #3d6b52;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .sp-trust-item svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      color: #3d8c5e;
    }

    /* Mobile adjustments */
    @media (max-width: 768px) {
      .sp-trust-strip {
        gap: 16px;
        padding: 12px 16px;
      }
      .sp-trust-item { font-size: 10px; }
    }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Trust Badge Strip ─────────────────────────────────────
  function injectTrustStrip() {
    const targets = document.querySelectorAll('[data-sp-trust-strip]');
    const checkIcon = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 110 16A8 8 0 018 0zm3.41 5.59a.75.75 0 00-1.06-1.06L7 7.88 5.65 6.53a.75.75 0 00-1.06 1.06l1.88 1.88a.75.75 0 001.06 0l3.88-3.88z"/></svg>';
    const shieldIcon = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0l8 3v5c0 4.17-3.36 6.73-8 8C3.36 14.73 0 12.17 0 8V3l8-3zm3.41 5.59L7 9.88 4.65 7.53a.75.75 0 00-1.06 1.06l2.88 2.88a.75.75 0 001.06 0l4.88-4.88a.75.75 0 00-1.06-1.06l.06.06z"/></svg>';

    targets.forEach(el => {
      el.innerHTML = `
        <div class="sp-trust-item">${shieldIcon} Board-Certified Physicians</div>
        <div class="sp-trust-item">${shieldIcon} 503A Licensed Pharmacy</div>
        <div class="sp-trust-item">${checkIcon} HIPAA Compliant</div>
        <div class="sp-trust-item">${checkIcon} HSA/FSA Accepted</div>
        <div class="sp-trust-item">${checkIcon} Free Shipping</div>
        <div class="sp-trust-item">${checkIcon} Cancel Anytime</div>
      `;
      el.classList.add('sp-trust-strip');
    });
  }

  // ─── PWA Support ───────────────────────────────────────────
  function injectPWA() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = '/manifest.json';
      document.head.appendChild(manifest);
    }
    const metas = [
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: 'Freeley' },
      { name: 'theme-color', content: '#3d8c5e' }
    ];
    metas.forEach(m => {
      if (!document.querySelector(`meta[name="${m.name}"]`)) {
        const meta = document.createElement('meta');
        meta.name = m.name;
        meta.content = m.content;
        document.head.appendChild(meta);
      }
    });
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement('link');
      icon.rel = 'apple-touch-icon';
      icon.href = '/assets/brand/freeley-icon-192.png';
      document.head.appendChild(icon);
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }

  // ─── Init ──────────────────────────────────────────────────
  function init() {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) return;
    injectStyles();
    injectTrustStrip();
    injectPWA();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
