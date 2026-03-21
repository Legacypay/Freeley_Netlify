/**
 * Exit Intent Email Capture — Freeley
 * 
 * Triggers a premium email capture modal when the user's mouse
 * leaves the viewport (desktop) or presses back button (mobile).
 * Captures email for abandoned visit recovery via Netlify Function.
 * Only shows once per session.
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'freeley_exit_shown';
  const MIN_TIME = 8000; // Don't show before 8s on page
  let shown = false;
  let loaded = Date.now();

  // ─── CSS ──────────────────────────────────────────────────
  function injectStyles() {
    const css = `
    .exit-overlay {
      position: fixed;
      inset: 0;
      background: rgba(5, 15, 10, 0.65);
      backdrop-filter: blur(4px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    }
    .exit-overlay.active {
      opacity: 1;
      visibility: visible;
    }
    .exit-modal {
      background: #fff;
      border-radius: 20px;
      max-width: 440px;
      width: 90%;
      padding: 40px 36px;
      text-align: center;
      position: relative;
      transform: translateY(20px) scale(0.96);
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 24px 64px rgba(0,0,0,0.18);
    }
    .exit-overlay.active .exit-modal {
      transform: translateY(0) scale(1);
    }
    .exit-close {
      position: absolute;
      top: 14px;
      right: 18px;
      width: 32px;
      height: 32px;
      border: none;
      background: #f5f5f5;
      border-radius: 50%;
      cursor: pointer;
      font-size: 15px;
      color: #666;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .exit-close:hover { background: #eee; }
    .exit-emoji {
      font-size: 44px;
      margin-bottom: 14px;
    }
    .exit-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 28px;
      font-weight: 400;
      color: #1a2b22;
      margin-bottom: 8px;
      line-height: 1.2;
    }
    .exit-title em {
      font-style: italic;
      color: #3d8c5e;
    }
    .exit-sub {
      font-size: 14px;
      color: #7a8a80;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .exit-form {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .exit-input {
      flex: 1;
      padding: 14px 18px;
      border: 2px solid #e5e8e6;
      border-radius: 12px;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .exit-input:focus {
      border-color: #3d8c5e;
    }
    .exit-submit {
      background: #3d8c5e;
      color: #fff;
      border: none;
      padding: 14px 24px;
      border-radius: 12px;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .exit-submit:hover {
      background: #2c6e49;
    }
    .exit-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .exit-privacy {
      font-size: 11px;
      color: #aab5ae;
    }
    .exit-success {
      display: none;
    }
    .exit-success.show {
      display: block;
    }
    .exit-success .exit-emoji { font-size: 48px; }
    .exit-success-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 24px;
      color: #1a2b22;
      margin-bottom: 8px;
    }
    .exit-success-sub {
      font-size: 14px;
      color: #7a8a80;
      margin-bottom: 20px;
    }
    .exit-success-cta {
      display: inline-block;
      background: #3d8c5e;
      color: #fff;
      padding: 14px 32px;
      border-radius: 50px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s;
    }
    .exit-success-cta:hover {
      background: #2c6e49;
      transform: translateY(-1px);
    }
    @media (max-width: 480px) {
      .exit-modal { padding: 28px 24px; }
      .exit-form { flex-direction: column; }
      .exit-title { font-size: 24px; }
    }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Modal ────────────────────────────────────────────────
  function createModal() {
    const overlay = document.createElement('div');
    overlay.className = 'exit-overlay';
    overlay.id = 'exit-overlay';
    overlay.innerHTML = `
      <div class="exit-modal">
        <button class="exit-close" id="exit-close">✕</button>
        
        <div class="exit-form-view" id="exit-form-view">
          <div class="exit-emoji">💊</div>
          <h2 class="exit-title">Wait — don't miss your <em>free consultation</em></h2>
          <p class="exit-sub">Enter your email and we'll save your progress. Plus, get $15 off your first month.</p>
          <form class="exit-form" id="exit-form">
            <input type="email" class="exit-input" placeholder="your@email.com" required id="exit-email" />
            <button type="submit" class="exit-submit" id="exit-btn">Get $15 Off</button>
          </form>
          <p class="exit-privacy">No spam • Unsubscribe anytime • HIPAA compliant</p>
        </div>

        <div class="exit-success" id="exit-success">
          <div class="exit-emoji">🎉</div>
          <h3 class="exit-success-title">You're all set!</h3>
          <p class="exit-success-sub">Check your inbox for your $15 code. Ready to start now?</p>
          <a href="/quiz.html" class="exit-success-cta">Start My Free Visit →</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Close handlers
    document.getElementById('exit-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Form submit
    document.getElementById('exit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('exit-email').value;
      const btn = document.getElementById('exit-btn');
      
      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        await fetch('/.netlify/functions/captureLead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, source: 'exit-intent', discount: 'WELCOME15' })
        });
      } catch (err) {
        console.warn('Exit capture failed (silent):', err);
      }

      // Show success
      document.getElementById('exit-form-view').style.display = 'none';
      document.getElementById('exit-success').classList.add('show');
      sessionStorage.setItem(STORAGE_KEY, 'captured');

      // Fire analytics
      if (window.FreeleyAnalytics) {
        window.FreeleyAnalytics.emailCapture('exit-intent');
      }
    });
  }

  function showModal() {
    if (shown) return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    if (Date.now() - loaded < MIN_TIME) return;
    // Don't show on quiz page (they're already engaged)
    if (window.location.pathname.includes('quiz')) return;

    shown = true;
    sessionStorage.setItem(STORAGE_KEY, 'shown');
    document.getElementById('exit-overlay').classList.add('active');
  }

  function closeModal() {
    document.getElementById('exit-overlay').classList.remove('active');
  }

  // ─── Triggers ─────────────────────────────────────────────
  function bindTriggers() {
    // Desktop: mouse leaves viewport at top
    document.addEventListener('mouseout', (e) => {
      if (e.clientY <= 0 && e.relatedTarget === null) {
        showModal();
      }
    });

    // Mobile: after 45s on page without action
    if (window.innerWidth <= 768) {
      setTimeout(showModal, 45000);
    }
  }

  // ─── Init ─────────────────────────────────────────────────
  function init() {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    injectStyles();
    createModal();
    bindTriggers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
