/**
 * Mobile Bottom Sheet & Referral Banner — Freeley
 * 
 * 1. Bottom Sheet CTA — Native-app-style slide-up sheet on mobile
 *    replaces the generic sticky CTA with a richer experience
 * 2. Referral Banner — "Give $25, Get $25" viral loop
 * 
 * Auto-initializes on mobile viewports.
 */

(function() {
  'use strict';

  // ─── Bottom Sheet ──────────────────────────────────────────
  function initBottomSheet() {
    return; // Disabled sticky bottom CTA as requested

    const css = `
    .mobile-bottom-sheet {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 9998;
      background: #fff;
      border-radius: 20px 20px 0 0;
      box-shadow: 0 -4px 32px rgba(0,0,0,0.12);
      padding: 16px 20px calc(16px + env(safe-area-inset-bottom));
      transform: translateY(100%);
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .mobile-bottom-sheet.visible {
      transform: translateY(0);
    }
    .mbs-handle {
      width: 36px;
      height: 4px;
      background: #d4d4d4;
      border-radius: 4px;
      margin: 0 auto 12px;
    }
    .mbs-content {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .mbs-info {
      flex: 1;
      min-width: 0;
    }
    .mbs-price {
      font-size: 20px;
      font-weight: 700;
      color: #1a2b22;
    }
    .mbs-price-old {
      font-size: 13px;
      color: #999;
      text-decoration: line-through;
      margin-left: 6px;
      font-weight: 400;
    }
    .mbs-label {
      font-size: 11px;
      color: #7a8a80;
      margin-top: 2px;
    }
    .mbs-cta {
      background: #3d8c5e;
      color: #fff;
      border: none;
      padding: 14px 28px;
      border-radius: 50px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      box-shadow: 0 4px 16px rgba(61,140,94,0.35);
      transition: all 0.2s;
      text-decoration: none;
      display: inline-block;
    }
    .mbs-cta:hover, .mbs-cta:active {
      background: #2c6e49;
      transform: translateY(-1px);
    }
    .mbs-trust {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 10px;
      font-size: 10px;
      color: #9aaa9f;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .mbs-trust-item {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .mbs-trust-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #3d8c5e;
    }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // Determine page context for pricing
    const path = window.location.pathname;
    let price = '$99/mo';
    let oldPrice = '$249';
    let label = 'Starting price • Cancel anytime';
    
    if (path.includes('ed') || path.includes('sexual')) {
      price = '$89/mo';
      oldPrice = '$179';
      label = 'ED treatment • Free shipping';
    } else if (path.includes('hair')) {
      price = '$39/mo';
      oldPrice = '$89';
      label = 'Hair regrowth • Free shipping';
    } else if (path.includes('longevity')) {
      price = '$149/mo';
      oldPrice = '$299';
      label = 'Peptide protocol • Free shipping';
    }

    const sheet = document.createElement('div');
    sheet.className = 'mobile-bottom-sheet';
    sheet.innerHTML = `
      <div class="mbs-handle"></div>
      <div class="mbs-content">
        <div class="mbs-info">
          <div class="mbs-price">${price} <span class="mbs-price-old">${oldPrice}</span></div>
          <div class="mbs-label">${label}</div>
        </div>
        <a href="/quiz.html" class="mbs-cta">Get Started</a>
      </div>
      <div class="mbs-trust">
        <div class="mbs-trust-item"><span class="mbs-trust-dot"></span> HIPAA</div>
        <div class="mbs-trust-item"><span class="mbs-trust-dot"></span> Free Shipping</div>
        <div class="mbs-trust-item"><span class="mbs-trust-dot"></span> Cancel Anytime</div>
        <div class="mbs-trust-item"><span class="mbs-trust-dot"></span> HSA/FSA</div>
      </div>
    `;

    document.body.appendChild(sheet);

    // Show after 1.5s scroll
    let shown = false;
    window.addEventListener('scroll', () => {
      if (!shown && window.scrollY > 400) {
        sheet.classList.add('visible');
        shown = true;
      }
    }, { passive: true });

    // Also show after 3s if not scrolling
    setTimeout(() => {
      if (!shown) {
        sheet.classList.add('visible');
        shown = true;
      }
    }, 3000);

    // Hide existing sticky CTA if present (avoid double)
    const existingSticky = document.querySelector('.sticky-mobile-cta');
    if (existingSticky) existingSticky.style.display = 'none';
  }

  // ─── Referral Banner ───────────────────────────────────────
  function initReferralBanner() {
    const targets = document.querySelectorAll('[data-referral-banner]');
    if (targets.length === 0) return;

    const css = `
    .referral-banner {
      background: linear-gradient(135deg, #1a2b22, #2c4a35);
      border-radius: 16px;
      padding: 28px 32px;
      display: flex;
      align-items: center;
      gap: 24px;
      margin: 32px 0;
      position: relative;
      overflow: hidden;
    }
    .referral-banner::before {
      content: '';
      position: absolute;
      top: -40px;
      right: -40px;
      width: 160px;
      height: 160px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(125,186,150,0.15), transparent 65%);
    }
    .referral-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: rgba(61,140,94,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      flex-shrink: 0;
    }
    .referral-body { flex: 1; position: relative; z-index: 1; }
    .referral-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 22px;
      font-weight: 400;
      color: #fff;
      margin-bottom: 4px;
    }
    .referral-title strong {
      color: #7dba96;
      font-weight: 600;
    }
    .referral-desc {
      font-size: 13px;
      color: rgba(255,255,255,0.55);
      line-height: 1.5;
    }
    .referral-cta {
      background: #3d8c5e;
      color: #fff;
      border: none;
      padding: 12px 24px;
      border-radius: 50px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      text-decoration: none;
      display: inline-block;
      transition: all 0.2s;
      flex-shrink: 0;
      position: relative;
      z-index: 1;
    }
    .referral-cta:hover {
      background: #2c6e49;
      transform: translateY(-1px);
    }
    @media (max-width: 768px) {
      .referral-banner {
        flex-direction: column;
        text-align: center;
        padding: 24px 20px;
      }
      .referral-icon { margin: 0 auto; }
    }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    targets.forEach(el => {
      el.innerHTML = `
        <div class="referral-icon">🎁</div>
        <div class="referral-body">
          <div class="referral-title">Give <strong>$25</strong>, Get <strong>$25</strong></div>
          <div class="referral-desc">Share Freeley with a friend. When they start their plan, you both save $25 on your next month.</div>
        </div>
        <a href="/quiz.html?ref=share" class="referral-cta">Share & Save →</a>
      `;
      el.classList.add('referral-banner');
    });
  }

  // ─── Init ──────────────────────────────────────────────────
  function init() {
    initBottomSheet();
    initReferralBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
