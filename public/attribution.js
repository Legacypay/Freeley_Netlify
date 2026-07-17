/**
 * First-touch attribution capture (HIPAA-safe).
 *
 * Runs on every public page load. Captures marketing attribution data
 * (UTMs, fbclid, gclid, referrer, _ga / _fbp / _fbc cookies) and stores
 * it in localStorage so it survives the user crossing into the HIPAA
 * funnel pages (/quiz, /checkout, /hub) where analytics scripts are
 * intentionally disabled.
 *
 * The data is then submitted to the backend during create-payment-intent
 * so it ends up in the Stripe PaymentIntent.metadata. The Stripe webhook
 * reads it back and fires server-side conversion events to GA4
 * (via Measurement Protocol) and Meta CAPI — none of which carry PHI,
 * only hashed PII + generic conversion value.
 *
 * Storage TTL: 90 days (covers typical telehealth consideration window).
 * First-touch wins: existing attribution within TTL is NOT overwritten.
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'freeley_attribution';
  var TTL_DAYS = 90;
  var TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

  function readCookie(name) {
    try {
      var m = document.cookie.match('(^|;)\\s*' + name + '=([^;]+)');
      return m ? decodeURIComponent(m[2]) : null;
    } catch (e) { return null; }
  }

  function loadStored() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.captured_at) return null;
      if (Date.now() - parsed.captured_at > TTL_MS) return null;
      return parsed;
    } catch (e) { return null; }
  }

  function persist(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* localStorage may be disabled — silently skip */ }
  }

  function hasAnyMarketingParam(params) {
    return [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'ttclid'
    ].some(function (k) { return params.has(k); });
  }

  function capture() {
    var url;
    try { url = new URL(window.location.href); } catch (e) { return; }
    var params = url.searchParams;

    // Always refresh the live tracking IDs from cookies (these may update
    // independently of marketing params — e.g., _ga only exists after GA4
    // has fired its first page-view).
    var liveIds = {
      _ga: readCookie('_ga'),
      _fbp: readCookie('_fbp'),
      _fbc: readCookie('_fbc')
    };

    var existing = loadStored();

    // First-touch rule: if we already have attribution within TTL, only
    // refresh the live cookies. Do NOT overwrite the original source.
    if (existing) {
      existing.last_seen_at = Date.now();
      existing.live_ids = liveIds;
      persist(existing);
      return;
    }

    // New session — capture full attribution.
    var captured = {
      captured_at: Date.now(),
      last_seen_at: Date.now(),
      landing_url: url.origin + url.pathname,
      landing_path: url.pathname,
      referrer: document.referrer || null,
      utm: {
        source: params.get('utm_source'),
        medium: params.get('utm_medium'),
        campaign: params.get('utm_campaign'),
        term: params.get('utm_term'),
        content: params.get('utm_content')
      },
      click_ids: {
        fbclid: params.get('fbclid'),
        gclid: params.get('gclid'),
        msclkid: params.get('msclkid'),
        ttclid: params.get('ttclid')
      },
      live_ids: liveIds
    };

    // If there are no marketing params AND no referrer, it's a direct
    // visit — still record so the funnel can attribute to "direct".
    if (!hasAnyMarketingParam(params) && !document.referrer) {
      captured.source_class = 'direct';
    } else if (hasAnyMarketingParam(params)) {
      captured.source_class = 'paid';
    } else {
      captured.source_class = 'organic_or_referral';
    }

    persist(captured);
  }

  // Public API — used by checkout/quiz to attach attribution to API calls.
  window.FreeleyAttribution = {
    get: function () { return loadStored(); },
    flatten: function () {
      // Flattens nested object into a flat metadata-friendly map of strings.
      // Stripe PaymentIntent.metadata only accepts ~50 string keys.
      var a = loadStored();
      if (!a) return {};
      var out = {};
      if (a.landing_path) out.attr_landing = String(a.landing_path).slice(0, 100);
      if (a.referrer) out.attr_referrer = String(a.referrer).slice(0, 200);
      if (a.source_class) out.attr_class = a.source_class;
      var u = a.utm || {};
      if (u.source)   out.attr_utm_source = String(u.source).slice(0, 100);
      if (u.medium)   out.attr_utm_medium = String(u.medium).slice(0, 100);
      if (u.campaign) out.attr_utm_campaign = String(u.campaign).slice(0, 100);
      if (u.term)     out.attr_utm_term = String(u.term).slice(0, 100);
      if (u.content)  out.attr_utm_content = String(u.content).slice(0, 100);
      var c = a.click_ids || {};
      if (c.fbclid)  out.attr_fbclid = String(c.fbclid).slice(0, 200);
      if (c.gclid)   out.attr_gclid = String(c.gclid).slice(0, 200);
      if (c.msclkid) out.attr_msclkid = String(c.msclkid).slice(0, 200);
      if (c.ttclid)  out.attr_ttclid = String(c.ttclid).slice(0, 200);
      var l = a.live_ids || {};
      if (l._ga)   out.attr_ga_client = String(l._ga).slice(0, 200);
      if (l._fbp)  out.attr_fbp = String(l._fbp).slice(0, 200);
      if (l._fbc)  out.attr_fbc = String(l._fbc).slice(0, 200);
      return out;
    },
    clear: function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }
  };

  // Fire on next tick so analytics.js (which sets _ga / _fbp cookies via
  // GA4 + Meta Pixel) has a chance to populate cookies before we read them.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(capture, 50); });
  } else {
    setTimeout(capture, 50);
  }
})();
