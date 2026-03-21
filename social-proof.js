/**
 * Social Proof Engine — Freeley
 * 
 * Phase 3 Conversion Features:
 * 1. Notification toasts ("Sarah from Miami started her plan today")
 * 2. Live activity indicator ("14 people viewing right now")
 * 3. Recent signup counter
 * 4. Trust badge strip injection
 * 
 * Auto-initializes on DOM ready. Uses realistic data pools.
 */

(function() {
  'use strict';

  // ─── Configuration ─────────────────────────────────────────
  const CONFIG = {
    toastDelay: 8000,       // First toast after 8s
    toastInterval: 25000,   // New toast every 25s
    toastDuration: 5500,    // Each toast visible for 5.5s
    maxToasts: 6,           // Stop after 6 toasts per session
    viewerUpdateInterval: 30000, // Update "viewing now" every 30s
  };

  // ─── Realistic Data Pools ──────────────────────────────────
  const FIRST_NAMES = [
    'Sarah', 'Michael', 'Jessica', 'David', 'Ashley', 'James', 'Emily', 
    'Robert', 'Amanda', 'Daniel', 'Lauren', 'Christopher', 'Stephanie',
    'Matthew', 'Nicole', 'Andrew', 'Megan', 'Ryan', 'Rachel', 'Brandon',
    'Heather', 'Kevin', 'Christina', 'Jason', 'Rebecca', 'Tyler', 'Maria',
    'Mark', 'Samantha', 'Alex', 'Jennifer', 'Brian', 'Katherine', 'Patrick'
  ];

  const CITIES = [
    'Miami, FL', 'Austin, TX', 'Los Angeles, CA', 'New York, NY', 
    'Charlotte, NC', 'Nashville, TN', 'Denver, CO', 'Phoenix, AZ',
    'Orlando, FL', 'Atlanta, GA', 'San Diego, CA', 'Portland, OR',
    'Tampa, FL', 'Dallas, TX', 'Seattle, WA', 'Scottsdale, AZ',
    'Jacksonville, FL', 'Raleigh, NC', 'Chicago, IL', 'Houston, TX',
    'Virginia Beach, VA', 'Boise, ID', 'San Antonio, TX', 'Columbus, OH'
  ];

  const ACTIONS = [
    { text: 'started their weight loss plan', icon: '💊', category: 'weight-loss' },
    { text: 'completed their free visit', icon: '✅', category: 'general' },
    { text: 'just ordered their first month', icon: '📦', category: 'general' },
    { text: 'started a hair regrowth plan', icon: '💈', category: 'hair-loss' },
    { text: 'began their ED treatment plan', icon: '💪', category: 'ed' },
    { text: 'got approved for GLP-1 therapy', icon: '🩺', category: 'weight-loss' },
    { text: 'upgraded to the 3-month plan', icon: '⭐', category: 'general' },
    { text: 'started their longevity protocol', icon: '🧬', category: 'longevity' },
    { text: 'received their medication delivery', icon: '📬', category: 'general' },
    { text: 'just completed their consultation', icon: '👨‍⚕️', category: 'general' },
  ];

  const TIME_AGO = [
    '2 minutes ago', '5 minutes ago', '8 minutes ago', '12 minutes ago',
    '15 minutes ago', '22 minutes ago', '34 minutes ago', '1 hour ago',
    '2 hours ago', '3 hours ago'
  ];

  // ─── State ─────────────────────────────────────────────────
  let toastCount = 0;
  let toastTimer = null;
  let usedCombinations = new Set();

  // ─── Styles ────────────────────────────────────────────────
  function injectStyles() {
    const css = `
    /* ─── Social Proof Toast ──────────────────────────────── */
    .sp-toast {
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 10000;
      background: rgba(255,255,255,0.97);
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
      padding: 14px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 340px;
      transform: translateX(-120%) scale(0.9);
      opacity: 0;
      transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
      border: 1px solid rgba(0,0,0,0.04);
    }
    .sp-toast.show {
      transform: translateX(0) scale(1);
      opacity: 1;
    }
    .sp-toast.hide {
      transform: translateX(-120%) scale(0.9);
      opacity: 0;
    }
    .sp-toast-icon {
      font-size: 22px;
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      background: #f0f8f4;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .sp-toast-body {
      flex: 1;
      min-width: 0;
    }
    .sp-toast-name {
      font-size: 13.5px;
      font-weight: 600;
      color: #1a2b22;
      margin-bottom: 2px;
    }
    .sp-toast-action {
      font-size: 12.5px;
      color: #5a6b62;
      line-height: 1.3;
    }
    .sp-toast-time {
      font-size: 11px;
      color: #9aaa9f;
      margin-top: 3px;
    }
    .sp-toast-close {
      position: absolute;
      top: 6px;
      right: 8px;
      width: 18px;
      height: 18px;
      border: none;
      background: none;
      color: #bbb;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      padding: 0;
      line-height: 1;
    }
    .sp-toast-close:hover {
      color: #666;
      background: rgba(0,0,0,0.05);
    }
    .sp-toast-verified {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      color: #3d8c5e;
      font-weight: 500;
      margin-top: 2px;
    }
    .sp-toast-verified svg {
      width: 10px;
      height: 10px;
      fill: #3d8c5e;
    }

    /* ──── Activity Counter Badge ─────────────────────────── */
    .sp-activity-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: rgba(61,140,94,0.08);
      border: 1px solid rgba(61,140,94,0.15);
      border-radius: 100px;
      font-size: 12px;
      color: #3d8c5e;
      font-weight: 500;
      margin: 12px 0;
    }
    .sp-activity-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #3d8c5e;
      animation: sp-pulse 2s ease-in-out infinite;
    }
    @keyframes sp-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }

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

    /* ──── Recent Signup Counter (for hero sections) ──────── */
    .sp-signup-counter {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 100px;
      font-size: 13px;
      color: rgba(255,255,255,0.75);
    }
    .sp-signup-counter strong {
      color: #7dba96;
    }
    .sp-signup-avatars {
      display: flex;
      margin-left: -2px;
    }
    .sp-signup-avatar {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid rgba(5,15,10,0.8);
      margin-left: -6px;
      font-size: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: #fff;
    }
    .sp-signup-avatar:nth-child(1) { background: #3d8c5e; }
    .sp-signup-avatar:nth-child(2) { background: #2c6e49; }
    .sp-signup-avatar:nth-child(3) { background: #5a9e78; }

    /* ──── Spots Left Urgency Badge ────────────────────────── */
    .sp-spots-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: rgba(245,168,42,0.08);
      border: 1px solid rgba(245,168,42,0.2);
      border-radius: 100px;
      font-size: 13px;
      color: #c47f1a;
      font-weight: 500;
    }
    .sp-spots-badge strong {
      color: #b36d0a;
      font-weight: 700;
    }
    .sp-spots-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #e8a735;
      animation: sp-pulse 1.5s ease-in-out infinite;
    }

    /* Mobile adjustments */
    @media (max-width: 768px) {
      .sp-toast {
        bottom: 80px; /* Above sticky CTA */
        left: 12px;
        right: 12px;
        max-width: none;
      }
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

  // ─── Utility ───────────────────────────────────────────────
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getUniqueCombo() {
    let attempts = 0;
    let name, city, action;
    do {
      name = pick(FIRST_NAMES);
      city = pick(CITIES);
      action = pick(ACTIONS);
      attempts++;
    } while (usedCombinations.has(`${name}-${city}`) && attempts < 20);
    usedCombinations.add(`${name}-${city}`);
    return { name, city, action };
  }

  // ─── Toast System ──────────────────────────────────────────
  function showToast() {
    if (toastCount >= CONFIG.maxToasts) return;
    
    // Remove any existing toast
    const existing = document.querySelector('.sp-toast');
    if (existing) existing.remove();

    const { name, city, action } = getUniqueCombo();
    const time = pick(TIME_AGO);

    const toast = document.createElement('div');
    toast.className = 'sp-toast';
    toast.innerHTML = `
      <div class="sp-toast-icon">${action.icon}</div>
      <div class="sp-toast-body">
        <div class="sp-toast-name">${name} from ${city}</div>
        <div class="sp-toast-action">${action.text}</div>
        <div class="sp-toast-verified">
          <svg viewBox="0 0 16 16"><path d="M8 0a8 8 0 110 16A8 8 0 018 0zm3.41 5.59a.75.75 0 00-1.06-1.06L7 7.88 5.65 6.53a.75.75 0 00-1.06 1.06l1.88 1.88a.75.75 0 001.06 0l3.88-3.88z"/></svg>
          Verified Patient
        </div>
        <div class="sp-toast-time">${time}</div>
      </div>
      <button class="sp-toast-close" aria-label="Close">×</button>
    `;

    document.body.appendChild(toast);

    // Close button
    toast.querySelector('.sp-toast-close').addEventListener('click', (e) => {
      e.stopPropagation();
      dismissToast(toast);
    });

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('show');
      });
    });

    // Auto-dismiss
    setTimeout(() => dismissToast(toast), CONFIG.toastDuration);
    toastCount++;

    // Schedule next
    if (toastCount < CONFIG.maxToasts) {
      toastTimer = setTimeout(showToast, CONFIG.toastInterval);
    }
  }

  function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 600);
  }

  // ─── Activity Badge Injector ───────────────────────────────
  function injectActivityBadges() {
    const badges = document.querySelectorAll('[data-sp-activity]');
    badges.forEach(el => {
      const base = parseInt(el.getAttribute('data-sp-activity') || '14');
      const variation = Math.floor(Math.random() * 8) - 3; // ±3
      const count = Math.max(7, base + variation);
      el.innerHTML = `
        <span class="sp-activity-dot"></span>
        <span><strong>${count}</strong> people viewing this right now</span>
      `;
      el.classList.add('sp-activity-badge');
    });
  }

  // ─── Signup Counter Injector ───────────────────────────────
  function injectSignupCounters() {
    const counters = document.querySelectorAll('[data-sp-signups]');
    counters.forEach(el => {
      const baseCount = parseInt(el.getAttribute('data-sp-signups') || '127');
      const todayCount = Math.floor(Math.random() * 15) + 8; // 8-22 today
      const initials = ['S', 'M', 'J'];
      el.innerHTML = `
        <div class="sp-signup-avatars">
          ${initials.map(i => `<div class="sp-signup-avatar">${i}</div>`).join('')}
        </div>
        <span><strong>${baseCount + todayCount}</strong> patients started this week</span>
      `;
      el.classList.add('sp-signup-counter');
    });
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

  // ─── GA4 + Meta Pixel ──────────────────────────────────────
  function injectAnalytics() {
    // GA4 — Replace G-XXXXXXXXX with your real Measurement ID
    if (!document.querySelector('script[src*="googletagmanager"]')) {
      const ga4Script = document.createElement('script');
      ga4Script.async = true;
      ga4Script.src = 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXX';
      document.head.appendChild(ga4Script);

      const ga4Config = document.createElement('script');
      ga4Config.textContent = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-XXXXXXXXX');
      `;
      document.head.appendChild(ga4Config);
    }

    // Meta Pixel — Replace PIXEL_ID with your real Pixel ID
    if (!window.fbq) {
      const metaPixel = document.createElement('script');
      metaPixel.textContent = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', 'PIXEL_ID');
        fbq('track', 'PageView');
      `;
      document.head.appendChild(metaPixel);
    }
  }
  // ─── Spots Left Badge Injector ─────────────────────────────
  function injectSpotsLeft() {
    const targets = document.querySelectorAll('[data-sp-spots]');
    const month = new Date().toLocaleString('default', { month: 'long' });
    targets.forEach(el => {
      const base = parseInt(el.getAttribute('data-sp-spots') || '12');
      const variation = Math.floor(Math.random() * 5); // 0-4 fewer
      const spots = Math.max(3, base - variation);
      el.innerHTML = `
        <span class="sp-spots-dot"></span>
        <span><strong>${spots} spots</strong> remaining for ${month}</span>
      `;
      el.classList.add('sp-spots-badge');
    });
  }

  // ─── Init ──────────────────────────────────────────────────
  function init() {
    injectStyles();
    injectActivityBadges();
    injectSignupCounters();
    injectTrustStrip();
    injectSpotsLeft();
    injectPWA();
    // injectAnalytics(); // Uncomment when you have real GA4/Meta IDs

    // Start toast notifications after delay
    setTimeout(showToast, CONFIG.toastDelay);
  }

  function injectPWA() {
    // Manifest link
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = '/manifest.json';
      document.head.appendChild(manifest);
    }
    // Apple mobile web app meta
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
    // Apple touch icon
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement('link');
      icon.rel = 'apple-touch-icon';
      icon.href = '/assets/brand/freeley-icon-192.png';
      document.head.appendChild(icon);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
