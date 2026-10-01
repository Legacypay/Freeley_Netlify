// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Whop conversion pixel (docs.whop.com/developer/guides/pixel), company
// biz_2i0xjR1QwIvijR. Vendor snippet, verbatim — do not reformat.
// SCOPE: Astro pages only. The legacy public/*.html pages passed through into
// the same deploy are deliberately NOT tagged — do not add it to shared.js.
// Whop wants it in <head> on every page it covers, so it is injected here
// rather than added to Layout.astro: six pages (checkout, waitlist, compare,
// prototype, assessment-quiz, assessment-design-2) declare their own <head>
// and never touch the layout. `head-inline` is the one stage Astro applies to
// all of them, unbundled.
// Requires https://t.whop.tw in the netlify.toml CSP (script-src + connect-src).
// PERFORMANCE (2026-10-01, FRLY-9): the vendor stub (window.whop + its queue) is
// unchanged and still runs first, so whop.track(...) calls anywhere are queued
// as before. Only the download of s.js (which pulls fingerprint.js) waits for
// the first interaction or 5 s after load: on a mid-range phone it blocked the
// main thread ~3.5 s during first paint (Lighthouse home perf 41). Trade-off
// accepted by Samuel 2026-10-01: Whop's "page" event is lost for a visitor who
// leaves within ~5 s without touching or scrolling. The waitlist lead is safe
// (typing the email starts the download long before submit).
const WHOP_PIXEL = `
!function(w,d,s,u,n,a){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};
var E=["pointerdown","keydown","scroll","touchstart"],o={passive:true},l=0;
function L(){if(l)return;l=1;E.forEach(function(e){w.removeEventListener(e,L,o)});var b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.head.appendChild(b)}
E.forEach(function(e){w.addEventListener(e,L,o)});w.addEventListener("load",function(){setTimeout(L,5000)})}(window,document,"script","https://t.whop.tw","whop");
whop.setScope("biz_2i0xjR1QwIvijR");
whop.track("page");
`;

// GA4 + Meta Pixel + Clarity (public/analytics.js) and first-touch attribution
// capture (public/attribution.js) previously only got loaded by the
// pre-Astro-migration legacy .html pages — zero live Astro page (including
// this one, /prototype-turned-index.astro) ever loaded either script, so
// GA4/Clarity sat fully configured but dark and attribution was never
// captured for the Stripe-webhook CAPI path to use later. Same six-page
// blind spot as the Whop pixel above, same fix: inject via head-inline
// instead of Layout.astro. analytics.js self-gates HIPAA-sensitive paths
// (quiz/checkout/hub) internally; attribution.js is designed to run
// everywhere, including those, so neither needs a path check here.
// PERFORMANCE (FRLY-9): analytics.js (GA4/Clarity/Meta setup) loads after the
// window load event so it stays out of the first paint. attribution.js keeps
// loading deferred, as before: it is tiny, and first-touch UTM/click-id capture
// must not wait for load (a visitor who taps a CTA first would be recorded as
// landing on the quiz). Its live_ids (_ga, _fbp) refresh on every later page.
const LOAD_TRACKING_SCRIPTS = `
(function (w, d) {
  function add(src, defer) {
    var s = d.createElement('script');
    s.src = src;
    if (defer) s.defer = true;
    d.head.appendChild(s);
  }
  add('/attribution.js', true);
  if (d.readyState === 'complete') add('/analytics.js'); else w.addEventListener('load', function () { add('/analytics.js'); });
})(window, document);
`;

// Campaign emails A13/A15 link to /assessment-quiz?promo=WELCOME10, but the
// visitor doesn't reach the promo field until /checkout — several steps and a
// redirect later, by which point the query param is long gone, so the code was
// decorative and the reader had to remember and re-type it. Stashing it the
// moment it arrives (on whichever page the link pointed at) lets
// checkout.astro apply it through its existing promo form. sessionStorage is
// the same handoff channel the quiz already uses for selected_product etc.
// Injected here rather than in Layout.astro because six pages — index,
// compare, checkout, assessment-quiz, assessment-design-2, waitlist — render
// their own <html> and never load the layout.
const CAPTURE_PROMO_PARAM = `
(function (w) {
  try {
    var code = new URLSearchParams(w.location.search).get('promo');
    if (code) w.sessionStorage.setItem('freeley_promo_code', code.trim().toUpperCase());
  } catch (e) { /* private mode / storage disabled — the field still works by hand */ }
})(window);
`;

// https://astro.build/config
export default defineConfig({
  integrations: [
    {
      name: 'whop-pixel',
      hooks: {
        'astro:config:setup': ({ injectScript }) => injectScript('head-inline', WHOP_PIXEL),
      },
    },
    {
      name: 'tracking-scripts',
      hooks: {
        'astro:config:setup': ({ injectScript }) => injectScript('head-inline', LOAD_TRACKING_SCRIPTS),
      },
    },
    {
      name: 'promo-param-capture',
      hooks: {
        'astro:config:setup': ({ injectScript }) => injectScript('head-inline', CAPTURE_PROMO_PARAM),
      },
    },
  ],
  // Fonts are self-hosted at build time instead of linked from Google. Two
  // reasons, both visible: the stylesheet was a render-blocking request to a
  // third-party origin, and the fallback that painted while it travelled had
  // different metrics from the real face — that is the "bold flash then swap"
  // on a hard refresh. Astro emits metric-matched fallbacks (size-adjust,
  // ascent-override) so the placeholder occupies the same space, and preloads
  // the files from our own origin. Build-time note: this fetches from Google
  // during `astro build`, so the Netlify builder needs network (it has it).
  // Only pages that render <Font /> are affected; the other 16 are untouched.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Source Serif 4',
      cssVariable: '--font-display',
      weights: ['400 700'],
      styles: ['normal', 'italic'],
      fallbacks: ['Charter', 'Georgia', 'serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Archivo',
      cssVariable: '--font-text',
      weights: ['400 700'],
      styles: ['normal'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    // The compliance register. Astro's font API does not expose a width axis,
    // so a self-hosted Archivo carries no font-stretch range and `font-stretch:
    // 79%` would clamp to 100% and silently do nothing. Archivo Narrow is the
    // real narrow cut rather than an interpolation — better drawn, and it works.
    {
      provider: fontProviders.google(),
      name: 'Archivo Narrow',
      cssVariable: '--font-condensed',
      weights: ['400 700'],
      styles: ['normal'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
