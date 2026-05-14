/**
 * Video Hero Component
 *
 * Embeds Sora-generated MP4 videos as hero section backgrounds.
 * Falls back to a static image if the video fails to load.
 *
 * Usage in HTML:
 *   <section class="video-hero"
 *            data-video="assets/videos/hero-weight-loss.mp4"
 *            data-fallback="assets/promo/weight-loss-hero.jpg">
 *     <div class="video-hero-overlay"></div>
 *     <div class="video-hero-content container">
 *       <h1>Your heading here</h1>
 *     </div>
 *   </section>
 *
 *   <script src="video-hero.js"></script>
 */

(function() {
  'use strict';

  function initOne(hero) {
    if (hero.dataset.videoInit === '1') return;
    hero.dataset.videoInit = '1';

    var videoSrc = hero.getAttribute('data-video');
    var fallback = hero.getAttribute('data-fallback');
    if (!videoSrc) return;

    var video = document.createElement('video');
    video.className = 'video-hero-bg';
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    // Inline initial state so the CSS transition can run reliably.
    video.style.opacity = '0';
    if (fallback) video.poster = fallback;

    var source = document.createElement('source');
    source.src = videoSrc;
    source.type = 'video/mp4';
    video.appendChild(source);

    function reveal(reason) {
      if (video.dataset.revealed === '1') return;
      video.dataset.revealed = '1';
      video.style.opacity = '1';
      hero.classList.add('video-loaded');
      // Helpful breadcrumb in case we need to diagnose later.
      try { console.log('[video-hero] revealed:', videoSrc, 'via', reason); } catch (e) {}
    }

    function tryPlay(reason) {
      var p = video.play();
      if (p && typeof p.then === 'function') {
        p.then(function() {
          try { console.log('[video-hero] play() OK via ' + reason + ' | readyState=' + video.readyState + ' paused=' + video.paused); } catch (e) {}
        }).catch(function(err) {
          // Autoplay blocked is normal on first interaction; muted+playsinline
          // usually wins, but if not, the poster image will keep the hero alive.
          try { console.log('[video-hero] play() REJECTED via ' + reason + ' | ' + (err && err.name) + ': ' + (err && err.message)); } catch (e) {}
        });
      }
    }

    // High-signal events for diagnosing "is it actually playing?"
    video.addEventListener('playing', function() {
      try { console.log('[video-hero] PLAYING | readyState=' + video.readyState + ' videoWidth=' + video.videoWidth + ' videoHeight=' + video.videoHeight); } catch (e) {}
    });
    video.addEventListener('stalled', function() {
      try { console.log('[video-hero] stalled (network/buffer issue)'); } catch (e) {}
    });
    video.addEventListener('suspend', function() {
      try { console.log('[video-hero] suspend (browser paused fetching data)'); } catch (e) {}
    });
    video.addEventListener('waiting', function() {
      try { console.log('[video-hero] waiting (buffering)'); } catch (e) {}
    });

    // Reveal on ANY of these — first one to fire wins. loadeddata alone is
    // unreliable for cached videos and Safari.
    ['loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'playing'].forEach(function(ev) {
      video.addEventListener(ev, function() { reveal(ev); }, { once: true });
    });

    // On error → drop to static background and remove the video element.
    video.addEventListener('error', function() {
      try { console.warn('[video-hero] error loading', videoSrc); } catch (e) {}
      if (fallback) {
        hero.style.backgroundImage = "url(" + fallback + ")";
        hero.style.backgroundSize = 'cover';
        hero.style.backgroundPosition = 'center';
      }
      try { video.remove(); } catch (e) {}
    });

    // Pause when offscreen for perf; play when back in view.
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) tryPlay('intersect');
          else { try { video.pause(); } catch (e) {} }
        });
      }, { threshold: 0.1 });
      io.observe(hero);
    }

    // Insert into DOM as first child so overlay/content stay on top.
    hero.insertBefore(video, hero.firstChild);

    // If the browser already cached this video, no event will fire. Check
    // readyState now and on the next tick.
    if (video.readyState >= 2) reveal('readyState');
    setTimeout(function() {
      if (video.readyState >= 2) reveal('readyState-tick');
      tryPlay('initial');
    }, 0);

    // Belt-and-suspenders: if nothing has fired in 1.2s, force-reveal so the
    // user never sees an empty black hero. The poster (data-fallback) acts as
    // visual filler even if the video itself never plays.
    setTimeout(function() { reveal('timeout'); }, 1200);
  }

  function initVideoHeroes() {
    var heroes = document.querySelectorAll('.video-hero[data-video]');
    try { console.log('[video-hero] init — found ' + heroes.length + ' hero(es)'); } catch (e) {}
    Array.prototype.forEach.call(heroes, initOne);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVideoHeroes);
  } else {
    initVideoHeroes();
  }
})();
