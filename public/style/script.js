const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');

    question.addEventListener('click', () => {
        faqItems.forEach(otherItem => {
            if (otherItem !== item) {
                otherItem.classList.remove('open');
            }
        });

        item.classList.toggle('open');
    });
});


        // Mobile menu toggle
        const mobileMenuButton = document.querySelector('.navbar-toggler-custom');
        const mobileMenu = document.querySelector('.navbar-nav-custom.d-lg-none');

        if (mobileMenuButton) {
            mobileMenuButton.addEventListener('click', () => {
                if (mobileMenu.style.display === 'none') {
                    mobileMenu.style.display = 'flex';
                    mobileMenu.style.flexDirection = 'column';
                } else {
                    mobileMenu.style.display = 'none';
                }
            });
        }



const stickyBar = document.getElementById("start-assessment");

// Guarded: pages that opt out of the pinned mobile bar (e.g. /weight-loss)
// simply don't carry the #start-assessment anchor.
if (stickyBar) {

    const placeholder = document.createElement("div");
    stickyBar.parentNode.insertBefore(placeholder, stickyBar);

    function handleSticky() {

        if (window.innerWidth >= 768) {
            stickyBar.classList.remove("mobile-fixed");
            placeholder.style.display = "none";
            return;
        }

        const rect = stickyBar.getBoundingClientRect();

        if (rect.top <= 0 && !stickyBar.classList.contains("mobile-fixed")) {

            placeholder.style.height = stickyBar.offsetHeight + "px";
            placeholder.style.display = "block";

            stickyBar.classList.add("mobile-fixed");

        } else if (window.scrollY <= placeholder.offsetTop) {

            placeholder.style.display = "none";
            stickyBar.classList.remove("mobile-fixed");

        }
    }

    window.addEventListener("scroll", handleSticky);
    window.addEventListener("resize", handleSticky);
}

// =============================================
// PRODUCT PHOTO HOVER-ZOOM — cursor-following magnify inside the product
// stage, same idea as a marketplace PDP zoom (MercadoLibre-style). Scoped
// to .wl-prod__frame, which /hair-loss, /weight-loss, /sexual-wellness and
// /longevity's product showcase all share (this file is loaded on all
// four); querySelectorAll just finds nothing on pages without it. Desktop
// only — (hover: hover) and (pointer: fine) excludes touch, where a
// persistent hover state doesn't exist and would just get stuck open.
// Reads the <img>'s own live src/position each time rather than caching
// anything, so it keeps working across the gallery's medication-toggle
// image swaps (those only ever change .src, never replace the element).
//
// mousemove is bound to .wl-prod__main (the whole stage: image + arrows +
// dots), NOT .wl-prod__frame alone — #prevBtn/#nextBtn are painted on top
// of the frame (.wl-prod__nav is display:contents, so they're positioned
// absolute over the image) but live outside the frame's DOM subtree.
// Binding only to the frame meant crossing onto/off an arrow on the way to
// click it fired the frame's mouseleave/mouseenter back-to-back, snapping
// the zoom out and back in "de golpe" right in the path to Prev/Next.
// Fix: every stage mousemove checks the cursor against each .wl-navbtn's
// rect (+ NAV_DEAD_ZONE px of margin, so the zoom eases out just *before*
// the cursor reaches the button instead of snapping off exactly at its
// edge) and simply skips turning the zoom on while inside that zone —
// no zoom is meant to happen there at all, not a flicker to smooth over.
// =============================================
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const NAV_DEAD_ZONE = 20; // px of padding around each arrow button

    document.querySelectorAll('.wl-prod__frame').forEach(function(frame) {
        const zoomImg = frame.querySelector('img');
        if (!zoomImg) return;
        const stage = frame.closest('.wl-prod__main') || frame;
        const navBtns = Array.from(stage.querySelectorAll('.wl-navbtn'));

        function nearNavBtn(x, y) {
            return navBtns.some(function(btn) {
                const r = btn.getBoundingClientRect();
                return x >= r.left - NAV_DEAD_ZONE && x <= r.right + NAV_DEAD_ZONE &&
                       y >= r.top - NAV_DEAD_ZONE && y <= r.bottom + NAV_DEAD_ZONE;
            });
        }

        stage.addEventListener('mousemove', function(e) {
            if (nearNavBtn(e.clientX, e.clientY)) {
                frame.classList.remove('is-zoomed');
                return;
            }
            const rect = zoomImg.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
            const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
            zoomImg.style.transformOrigin = x + '% ' + y + '%';
            frame.classList.add('is-zoomed');
        });

        stage.addEventListener('mouseleave', function() {
            frame.classList.remove('is-zoomed');
            zoomImg.style.transformOrigin = '50% 50%';
        });
    });
}



