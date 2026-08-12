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
// =============================================
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.wl-prod__frame').forEach(function(frame) {
        const zoomImg = frame.querySelector('img');
        if (!zoomImg) return;

        frame.addEventListener('mouseenter', function() {
            frame.classList.add('is-zoomed');
        });

        frame.addEventListener('mousemove', function(e) {
            const rect = zoomImg.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
            const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
            zoomImg.style.transformOrigin = x + '% ' + y + '%';
        });

        frame.addEventListener('mouseleave', function() {
            frame.classList.remove('is-zoomed');
            zoomImg.style.transformOrigin = '50% 50%';
        });
    });
}



