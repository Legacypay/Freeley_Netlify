/**
 * Video Hero Component
 * 
 * Embeds Sora-generated MP4 videos as hero section backgrounds.
 * Falls back to a static image if the video fails to load.
 * 
 * Usage in HTML:
 *   <section class="video-hero" data-video="assets/videos/hero-weight-loss.mp4" data-fallback="assets/hero-weight-loss.jpg">
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

  function initVideoHeroes() {
    const heroes = document.querySelectorAll('.video-hero[data-video]');
    
    heroes.forEach(hero => {
      const videoSrc = hero.getAttribute('data-video');
      const fallback = hero.getAttribute('data-fallback');
      
      // Check if video exists before loading
      const video = document.createElement('video');
      video.className = 'video-hero-bg';
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');

      const source = document.createElement('source');
      source.src = videoSrc;
      source.type = 'video/mp4';
      video.appendChild(source);

      // On successful load
      video.addEventListener('loadeddata', () => {
        video.style.opacity = '1';
        hero.classList.add('video-loaded');
      });

      // On error — fallback to image
      video.addEventListener('error', () => {
        if (fallback) {
          hero.style.backgroundImage = `url(${fallback})`;
          hero.style.backgroundSize = 'cover';
          hero.style.backgroundPosition = 'center';
        }
        video.remove();
      });

      // Pause video when not in viewport (performance)
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      }, { threshold: 0.1 });

      observer.observe(hero);

      // Insert as first child
      hero.insertBefore(video, hero.firstChild);
    });
  }

  // Init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVideoHeroes);
  } else {
    initVideoHeroes();
  }
})();
