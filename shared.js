// shared.js - Freeley shared components

const NAV_HTML = (activePage = '') => `
<nav class="nav" id="nav">
  <a href="/" class="nav-logo">Freeley<span>.</span></a>
  <div class="nav-links">
    <a href="/weight-loss" ${activePage === 'weight-loss' ? 'class="active"' : ''}>GLP-1 Weight Loss</a>
    <a href="/hair-loss" ${activePage === 'hair-loss' ? 'class="active"' : ''}>Hair Loss</a>
    <a href="/sexual-wellness" ${activePage === 'sexual-wellness' ? 'class="active"' : ''}>Sexual Wellness</a>
    <a href="/longevity" ${activePage === 'longevity' ? 'class="active"' : ''}>Longevity</a>
    <a href="/how-it-works" ${activePage === 'how' ? 'class="active"' : ''}>How It Works</a>
    <a href="/pricing" ${activePage === 'pricing' ? 'class="active"' : ''}>Pricing</a>
  </div>
  <div class="nav-right">
    <a href="/physicians" class="nav-login">Medical Team</a>
    <a href="/hub" class="nav-login">Sign In</a>
    <a href="/quiz" class="nav-cta">Start My Free Visit →</a>
  </div>
  <button class="nav-mobile-toggle" onclick="toggleMobileNav()" aria-label="Menu">
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M3 6h16M3 11h16M3 16h16" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  </button>
</nav>
<div class="mobile-nav" id="mobileNav">
  <a href="/">Home</a>
  <a href="/weight-loss">GLP-1 Weight Loss</a>
  <a href="/hair-loss">Hair Loss</a>
  <a href="/sexual-wellness">Sexual Wellness</a>
  <a href="/longevity">Longevity</a>
  <a href="/how-it-works">How It Works</a>
  <a href="/physicians">Medical Team</a>
  <a href="/pricing">Pricing</a>
  <a href="/quiz" class="mobile-cta">Start My Free Visit →</a>
</div>
`;

const FOOTER_HTML = `
<footer>
  <div class="footer-grid">
    <div>
      <a href="/" class="footer-brand-logo"><img src="assets/brand/freeley_logo_white.svg" alt="Freeley" height="34"></a>
      <p class="footer-brand-desc">Healthcare technology connecting patients to licensed physicians and compounding pharmacies — on your terms.</p>
      <div class="footer-social">
        <a href="https://www.instagram.com/freeleyhealth" target="_blank" rel="noopener noreferrer" title="Instagram">IG</a>
        <a href="https://www.tiktok.com/@freeley.health" target="_blank" rel="noopener noreferrer" title="TikTok">TT</a>
        <a href="https://x.com/freeley_health" target="_blank" rel="noopener noreferrer" title="X">𝕏</a>
        <a href="#" title="Facebook">FB</a>
      </div>
      <div style="display:flex; gap:16px; margin-top:32px; align-items:center; opacity:0.8;">
        <img src="assets/usa_badge.png" alt="Made in USA" style="height:36px; width:auto; mix-blend-mode: screen;">
        <img src="assets/hipaa_badge.png" alt="HIPAA Compliant" style="height:36px; width:auto; mix-blend-mode: screen;">
      </div>
    </div>
    <div class="footer-col">
      <h4>Treatments</h4>
      <a href="/weight-loss">GLP-1 Weight Loss</a>
      <a href="/hair-loss">Hair Loss</a>
      <a href="/sexual-wellness">Sexual Wellness</a>
      <a href="/longevity">Longevity & Peptides</a>
      <a href="/pricing">Pricing</a>
    </div>
    <div class="footer-col">
      <h4>Company</h4>
      <a href="/how-it-works">How It Works</a>
      <a href="/physicians">Medical Team</a>
      <a href="/about">About Freeley</a>
      <a href="/blog">Blog & Insights</a>
      <a href="/faq">FAQ</a>
      <a href="/contact">Contact Us</a>
    </div>
    <div class="footer-col">
      <h4>Legal</h4>
      <a href="/privacy">Privacy Policy</a>
      <a href="/terms">Terms of Service</a>
      <a href="/hipaa">HIPAA Notice</a>
      <a href="/telehealth">Telehealth Consent</a>
    </div>
  </div>
  <div class="footer-bottom">
    <p class="footer-disclaimer">Freeley is a healthcare technology platform that facilitates connections between patients and independently licensed telemedicine providers and 503A compounding pharmacies. Freeley does not practice medicine, employ physicians, or dispense medications. All treatment decisions are made solely by licensed practitioners. Compounded medications are not FDA-approved. Results vary. Not available in all states. FSA/HSA eligibility varies.</p>
    <div class="footer-copy">© 2025 Freeley Health LLC (DBA Freeley)</div>
  </div>
</footer>
`;

const STICKY_MOBILE_CTA = `
<div class="sticky-mobile-cta" id="stickyMobileCta">
  <div class="sticky-cta-content">
    <div class="sticky-cta-text">
       <span class="sticky-cta-title">GLP-1 Weight Loss</span>
       <span class="sticky-cta-price">Starts at $194/mo</span>
    </div>
    <a href="/quiz" class="btn btn-primary" style="padding: 12px 24px; font-weight: 600;">Start Free Visit</a>
  </div>
</div>
`;

const URGENCY_BANNER = `
<div class="urgency-banner" id="urgencyBanner">
  <div class="container" style="display: flex; justify-content: center; align-items: center; gap: 8px;">
    <span class="pulse-dot"></span>
    <span style="font-size: 12.5px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">High Demand: Accepting new patients for <span id="currentMonthStr"></span>. Next batch ships in <span style="color:#fff;">24 hours</span>.</span>
  </div>
</div>
`;

const MOBILE_NAV_STYLES = `
.mobile-nav {
  display: none; position: fixed; top: 72px; left: 0; right: 0; z-index: 199;
  background: rgba(7,21,16,0.98); backdrop-filter: blur(20px);
  padding: 24px; flex-direction: column; gap: 4px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.mobile-nav.open { display: flex; }
.mobile-nav a { color: rgba(255,255,255,0.7); text-decoration: none; padding: 12px 16px; border-radius: 10px; font-size: 15px; transition: all 0.2s; }
.mobile-nav a:hover { color: #fff; background: rgba(255,255,255,0.06); }
.mobile-nav .mobile-cta { background: var(--green-light); color: #fff !important; text-align: center; margin-top: 8px; font-weight: 500; }
`;

function toggleMobileNav() {
  document.getElementById('mobileNav').classList.toggle('open');
}

function initPage(activePage) {
  // Inject banner, nav + footer
  document.body.insertAdjacentHTML('afterbegin', NAV_HTML(activePage));
  document.body.insertAdjacentHTML('afterbegin', URGENCY_BANNER);
  document.body.insertAdjacentHTML('beforeend', FOOTER_HTML);
  document.body.insertAdjacentHTML('beforeend', STICKY_MOBILE_CTA);
  
  document.getElementById('currentMonthStr').textContent = new Date().toLocaleString('default', { month: 'long' });

  // Mobile nav styles + Urgency/Sticky CSS
  const style = document.createElement('style');
  style.textContent = MOBILE_NAV_STYLES + `
  .urgency-banner {
    position: fixed; top: 0; left: 0; right: 0;
    background: rgba(61, 140, 94, 0.25); backdrop-filter: blur(10px);
    color: var(--green-light); padding: 8px 0; text-align: center;
    border-bottom: 1px solid rgba(61, 140, 94, 0.3); z-index: 201;
  }
  .pulse-dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--green-light);
    box-shadow: 0 0 0 2px rgba(61, 140, 94, 0.3); animation: pulse 2s infinite; display: inline-block;
  }
  @keyframes pulse {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(61, 140, 94, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(61, 140, 94, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(61, 140, 94, 0); }
  }
  #nav { top: 34px !important; } /* Push nav down below urgency banner */
  .mobile-nav { top: 106px !important; }
  
  .sticky-mobile-cta {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: rgba(7, 21, 16, 0.95); backdrop-filter: blur(14px);
    border-top: 1px solid rgba(255,255,255,0.08); padding: 16px 24px;
    z-index: 200; transform: translateY(100%); transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    display: none; padding-bottom: max(16px, env(safe-area-inset-bottom));
  }
  @media (max-width: 768px) {
    .sticky-mobile-cta { display: block; }
    .sticky-mobile-cta.visible { transform: translateY(0); }
  }
  .sticky-cta-content { display: flex; justify-content: space-between; align-items: center; max-width: 480px; margin: 0 auto; }
  .sticky-cta-text { display: flex; flex-direction: column; }
  .sticky-cta-title { font-size: 11px; color: rgba(255,255,255,0.6); margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; font-weight:600;}
  .sticky-cta-price { font-size: 15px; font-weight: 700; color: #fff; }
  `;
  document.head.appendChild(style);

  // Scroll reveal
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // Nav scroll effect & Sticky Mobile CTA visibility
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('nav');
    const stickyCta = document.getElementById('stickyMobileCta');
    if (window.scrollY > 40) {
        nav.style.background = 'rgba(7,21,16,0.98)';
        nav.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    } else {
        nav.style.background = 'rgba(7,21,16,0.94)';
        nav.style.borderBottom = 'none';
    }
    
    // Show sticky cta after scrolling down a bit (mobile only)
    if (stickyCta && window.innerWidth <= 768) {
      if (window.scrollY > 400) {
        stickyCta.classList.add('visible');
      } else {
        stickyCta.classList.remove('visible');
      }
    }
  });
  // Structured Data (MedicalWebPage)
  const schemaScript = document.createElement('script');
  schemaScript.type = 'application/ld+json';
  schemaScript.text = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    "name": "Freeley Health",
    "url": "https://freeley.com",
    "logo": "https://freeley.com/favicon.png",
    "description": "Healthcare technology connecting patients to licensed physicians and compounding pharmacies.",
    "medicalSpecialty": ["Telehealth", "Weight Management", "Sexual Health"]
  });
  document.head.appendChild(schemaScript);

  // Tidio Live Chat Snippet
  const tidioScript = document.createElement('script');
  tidioScript.src = "//code.tidio.co/uoolj1kuzrueusvezow212gd5vlgazas.js"; 
  tidioScript.async = true;
  document.body.appendChild(tidioScript);


}
