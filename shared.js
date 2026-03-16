// shared.js - Freeley shared components

const NAV_HTML = (activePage = '') => `
<nav class="nav" id="nav">
  <a href="index.html" class="nav-logo">Freeley<span>.</span></a>
  <div class="nav-links">
    <a href="weight-loss.html" ${activePage === 'weight-loss' ? 'class="active"' : ''}>GLP-1 Weight Loss</a>
    <a href="hair-loss.html" ${activePage === 'hair-loss' ? 'class="active"' : ''}>Hair Loss</a>
    <a href="sexual-wellness.html" ${activePage === 'sexual-wellness' ? 'class="active"' : ''}>Sexual Wellness</a>
    <a href="longevity.html" ${activePage === 'longevity' ? 'class="active"' : ''}>Longevity</a>
    <a href="how-it-works.html" ${activePage === 'how' ? 'class="active"' : ''}>How It Works</a>
    <a href="pricing.html" ${activePage === 'pricing' ? 'class="active"' : ''}>Pricing</a>
  </div>
  <div class="nav-right">
    <a href="physicians.html" class="nav-login">Medical Team</a>
    <a href="hub.html" class="nav-login">Sign In</a>
    <a href="quiz.html" class="nav-cta">Start My Free Visit →</a>
  </div>
  <button class="nav-mobile-toggle" onclick="toggleMobileNav()" aria-label="Menu">
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M3 6h16M3 11h16M3 16h16" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  </button>
</nav>
<div class="mobile-nav" id="mobileNav">
  <a href="index.html">Home</a>
  <a href="weight-loss.html">GLP-1 Weight Loss</a>
  <a href="hair-loss.html">Hair Loss</a>
  <a href="sexual-wellness.html">Sexual Wellness</a>
  <a href="longevity.html">Longevity</a>
  <a href="how-it-works.html">How It Works</a>
  <a href="physicians.html">Medical Team</a>
  <a href="pricing.html">Pricing</a>
  <a href="quiz.html" class="mobile-cta">Start My Free Visit →</a>
</div>
`;

const FOOTER_HTML = `
<footer>
  <div class="footer-grid">
    <div>
      <a href="index.html" class="footer-brand-logo"><img src="assets/brand/freeley_logo_white.svg" alt="Freeley" height="34"></a>
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
      <a href="weight-loss.html">GLP-1 Weight Loss</a>
      <a href="hair-loss.html">Hair Loss</a>
      <a href="sexual-wellness.html">Sexual Wellness</a>
      <a href="longevity.html">Longevity & Peptides</a>
      <a href="pricing.html">Pricing</a>
    </div>
    <div class="footer-col">
      <h4>Company</h4>
      <a href="how-it-works.html">How It Works</a>
      <a href="physicians.html">Medical Team</a>
      <a href="about.html">About Freeley</a>
      <a href="blog.html">Blog & Insights</a>
      <a href="faq.html">FAQ</a>
      <a href="contact.html">Contact Us</a>
    </div>
    <div class="footer-col">
      <h4>Legal</h4>
      <a href="privacy.html">Privacy Policy</a>
      <a href="terms.html">Terms of Service</a>
      <a href="hipaa.html">HIPAA Notice</a>
      <a href="telehealth.html">Telehealth Consent</a>
    </div>
  </div>
  <div class="footer-bottom">
    <p class="footer-disclaimer">Freeley is a healthcare technology platform that facilitates connections between patients and independently licensed telemedicine providers and 503A compounding pharmacies. Freeley does not practice medicine, employ physicians, or dispense medications. All treatment decisions are made solely by licensed practitioners. Compounded medications are not FDA-approved. Results vary. Not available in all states. FSA/HSA eligibility varies.</p>
    <div class="footer-copy">© 2025 Freeley Health LLC (DBA Freeley)</div>
  </div>
</footer>
`;

const FLOATING_MOBILE_CTA = `
<div class="floating-mobile-cta">
  <a href="quiz.html" class="btn btn-primary btn-lg" style="width: 100%; justify-content: center; box-shadow: 0 4px 14px rgba(61,140,94,0.4);">
    Start My Free Visit →
  </a>
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
  // Inject nav + footer
  document.body.insertAdjacentHTML('afterbegin', NAV_HTML(activePage));
  document.body.insertAdjacentHTML('beforeend', FOOTER_HTML);
  document.body.insertAdjacentHTML('beforeend', FLOATING_MOBILE_CTA);

  // Mobile nav styles
  const style = document.createElement('style');
  style.textContent = MOBILE_NAV_STYLES;
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

  // Nav scroll effect
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('nav');
    if (window.scrollY > 40) nav.style.background = 'rgba(7,21,16,0.98)';
    else nav.style.background = 'rgba(7,21,16,0.94)';
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
