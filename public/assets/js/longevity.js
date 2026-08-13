// Quiz modal is now the shared src/components/QuizModal.astro dialog
// (rendered on longevity.astro) — its own script binds every
// a[href^="/assessment-quiz"] link, so the old #quiz--modal div-based
// binding that used to live here was removed.

// =============================================
// LONGEVITY PRODUCT GALLERY WITH 3 TOGGLE OPTIONS
// =============================================
(function() {
    // =============================================
    // DATA CONFIGURATION - Edit this section only
    // =============================================
    const longevityData = {
        sermorelin: {
            name: "Sermorelin",
            title: "Build Your Peptide Protocol",
            description: "Sermorelin stimulates natural growth hormone release for anti-aging benefits.",
            // OWN labeled bottle only — nad+.png/glutathione.png are the other
            // two products' bottles (wrong ingredients to show a Sermorelin
            // shopper), same bug/fix as hl-script.js's Cedar/Ivy/Willow toggle.
            // wl.png/kb.png (What's Included / Key Benefits infographic
            // slides) now live in the ProductInfoModal popup instead —
            // see longevity.astro.
            // Brello-style gallery (2026-08-12): price-badge hero slide
            // first, real photos, then branded info slides (baked text —
            // regenerate via scripts/image-manifest-product-slides-*.json on
            // any copy change).
            images: [
                "/assets/l/slide-price-sermorelin.webp",
                "/assets/l/sermorelin.png",
                "/assets/l/sermorelin-angle2.webp",
                "/assets/l/slide-included.webp",
                "/assets/l/slide-benefits.webp",
                "/assets/shared/slide-journey.webp",
                "/assets/shared/slide-hub.webp"
            ],
            features: [
                "Sourced from 503A US pharmacies",
                "Customized stack tailored to you",
                "Physician review & expedited cold-shipping"
            ],
            // Default to the 24-month plan rate (matches the plan ladder's
            // pre-selected "best" card) with the 1-month rate struck through,
            // both real tiers from pricing.json's longevity.standard —
            // same convention as hl-script.js's Cedar/Ivy/Willow toggle.
            price: "$79",
            originalPrice: "$129",
            save: "Save 39%",
            badge: "Most Popular"
        },
        nad: {
            name: "NAD+",
            title: "NAD+ Peptide Therapy",
            description: "NAD+ boosts cellular energy and supports healthy aging at the molecular level.",
            // OWN labeled bottle only — see sermorelin's comment above.
            // Brello-style slides — see sermorelin's comment above.
            images: [
                "/assets/l/slide-price-nad.webp",
                "/assets/l/nad+.png",
                "/assets/l/nad-angle2.webp",
                "/assets/l/slide-included.webp",
                "/assets/l/slide-benefits.webp",
                "/assets/shared/slide-journey.webp",
                "/assets/shared/slide-hub.webp"
            ],
            features: [
                "Sourced from 503A US pharmacies",
                "Customized stack tailored to you",
                "Physician review & expedited cold-shipping"
            ],
            // Real tiers from pricing.json's longevity.premium (NAD+'s own
            // tier, distinct from Sermorelin/Glutathione's standard tier).
            price: "$129",
            originalPrice: "$189",
            save: "Save 32%",
            badge: "Premium Choice"
        },
        glutathione: {
            name: "Glutathione",
            title: "Glutathione Peptide Therapy",
            description: "Glutathione is a powerful antioxidant that supports detoxification and immune health.",
            // OWN labeled bottle only — see sermorelin's comment above.
            // Brello-style slides — see sermorelin's comment above.
            images: [
                "/assets/l/slide-price-glutathione.webp",
                "/assets/l/glutathione.png",
                "/assets/l/glutathione-angle2.webp",
                "/assets/l/slide-included.webp",
                "/assets/l/slide-benefits.webp",
                "/assets/shared/slide-journey.webp",
                "/assets/shared/slide-hub.webp"
            ],
            features: [
                "Sourced from 503A US pharmacies",
                "Customized stack tailored to you",
                "Physician review & expedited cold-shipping"
            ],
            // Same standard tier as Sermorelin — see that entry's comment.
            price: "$79",
            originalPrice: "$129",
            save: "Save 39%",
            badge: "Essential Support"
        }
    };

    // =============================================
    // GALLERY STATE
    // =============================================
    let currentMedication = 'sermorelin';
    let currentIndex = 0;

    // =============================================
    // DOM REFERENCES
    // =============================================
    const mainImg = document.getElementById("mainProductImageL");
    const prevBtn = document.getElementById("prevBtnL");
    const nextBtn = document.getElementById("nextBtnL");
    const dotContainer = document.getElementById("dotContainerL");
    const thumbContainer = document.getElementById("thumbnailsContainerL");
    const featuresContainer = document.getElementById("featuresListL");
    const medicationButtons = document.querySelectorAll('.medication-toggle .btn');

    // =============================================
    // HELPER FUNCTIONS
    // =============================================
    function getCurrentData() {
        return longevityData[currentMedication];
    }

    function getImagePaths() {
        return getCurrentData().images;
    }

    function getSlideCount() {
        return getImagePaths().length;
    }

    // =============================================
    // GENERATE THUMBNAILS FROM MAIN IMAGES
    // =============================================
    function generateThumbnails(images) {
        if (!thumbContainer) return;
        thumbContainer.innerHTML = '';
        images.forEach((imgPath, index) => {
            const div = document.createElement('div');
            const thumbDiv = document.createElement('div');
            thumbDiv.className = `thumb-box text-center ${index === 0 ? 'active' : ''}`;
            thumbDiv.setAttribute('data-index', index);

            const img = document.createElement('img');
            img.src = imgPath;
            img.alt = `Thumb ${index + 1}`;
            img.className = 'img-fluid';
            img.style.width = '50px';
            img.style.height = '50px';
            img.style.objectFit = 'contain';

            thumbDiv.appendChild(img);
            div.appendChild(thumbDiv);
            thumbContainer.appendChild(div);

            thumbDiv.addEventListener('click', function() {
                const idx = parseInt(this.getAttribute('data-index'), 10);
                goTo(idx);
            });
        });
    }

    // =============================================
    // GENERATE DOTS
    // =============================================
    function generateDots(count) {
        if (!dotContainer) return;
        dotContainer.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const dot = document.createElement('span');
            dot.className = `dot-indicator ${i === 0 ? 'active' : ''}`;
            dot.addEventListener('click', function() {
                goTo(i);
            });
            dotContainer.appendChild(dot);
        }
    }

    // =============================================
    // UPDATE PRODUCT DETAILS
    // =============================================
    function updateDetails() {
        const data = getCurrentData();

        const titleElement = document.querySelector('.product-title');
        if (titleElement) titleElement.textContent = data.title || data.name;

        const currentPrice = document.querySelector('.product-current-price');
        if (currentPrice) currentPrice.textContent = data.price;

        const originalPrice = document.querySelector('.text-decoration-line-through');
        if (originalPrice) originalPrice.textContent = data.originalPrice || '';

        // Scoped to .wl-pricerow: the plan ladder above also has .wl-plan__save
        // badges (per-tier, not per-product), which a plain document-wide
        // querySelector would hit first instead of the purchase panel's own.
        const saveBadge = document.querySelector('.wl-pricerow .wl-plan__save');
        if (saveBadge) saveBadge.textContent = data.save || '';

        const badge = document.querySelector('.popular-badge');
        if (badge) badge.textContent = data.badge;

        if (featuresContainer) {
            featuresContainer.innerHTML = '';
            data.features.forEach(feature => {
                const div = document.createElement('div');
                div.className = 'feature-item mb-3';
                div.innerHTML = `
          <div class="feature-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20.3 7.3L9 18.6L3.7 13.3" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="feature-text">${feature}</span>
        `;
                featuresContainer.appendChild(div);
            });
        }
    }

    // =============================================
    // NAVIGATION FUNCTIONS
    // =============================================
    function goTo(index) {
        const images = getImagePaths();
        const total = getSlideCount();
        if (index < 0) index = total - 1;
        if (index >= total) index = 0;

        if (mainImg) {
            mainImg.classList.add("fade-out");

            setTimeout(function() {
                currentIndex = index;

                mainImg.classList.remove("fade-out", "fade-in");
                mainImg.src = images[currentIndex];

                const dots = document.querySelectorAll("#dotContainerL .dot-indicator");
                dots.forEach(function(d, i) {
                    d.classList.toggle("active", i === currentIndex);
                });

                const thumbs = document.querySelectorAll("#thumbnailsContainerL .thumb-box");
                thumbs.forEach(function(tb, i) {
                    tb.classList.toggle("active", i === currentIndex);
                });

                mainImg.classList.add("fade-in");
                setTimeout(function() {
                    mainImg.classList.remove("fade-in");
                }, 400);
            }, 200);
        }
    }

    function switchMedication(medication) {
        if (medication === currentMedication) return;

        currentMedication = medication;
        currentIndex = 0;

        const data = getCurrentData();
        const images = data.images;

        if (mainImg) {
            mainImg.src = images[0];
            mainImg.classList.remove("fade-out", "fade-in");
        }
        generateThumbnails(images);
        generateDots(getSlideCount());
        updateDetails();

        const thumbs = document.querySelectorAll("#thumbnailsContainerL .thumb-box");
        thumbs.forEach((tb, i) => {
            tb.classList.toggle("active", i === 0);
        });

        const dots = document.querySelectorAll("#dotContainerL .dot-indicator");
        dots.forEach((d, i) => {
            d.classList.toggle("active", i === 0);
        });
    }

    // =============================================
    // EVENT LISTENERS
    // =============================================
    if (prevBtn) {
        prevBtn.addEventListener("click", function() {
            goTo(currentIndex - 1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", function() {
            goTo(currentIndex + 1);
        });
    }

    medicationButtons.forEach(function(button) {
        button.addEventListener("click", function() {
            medicationButtons.forEach(function(btn) {
                btn.classList.remove("active-medication");
                btn.classList.remove("text-white");
                btn.classList.add("text-success");
                btn.style.backgroundColor = 'transparent';
            });

            this.classList.add("active-medication");
            this.classList.remove("text-success");
            this.classList.add("text-white");
            this.style.backgroundColor = '';

            const medication = this.getAttribute('data-medication') ||
                this.textContent.trim().toLowerCase();

            if (medication === 'sermorelin' || medication === 'nad' || medication === 'glutathione') {
                switchMedication(medication);
            }
        });
    });

    // =============================================
    // INITIALIZE
    // =============================================
    function init() {
        const data = getCurrentData();
        const images = data.images;

        if (mainImg) {
            mainImg.src = images[0];
            mainImg.classList.remove("fade-out", "fade-in");
        }
        generateThumbnails(images);
        generateDots(getSlideCount());
        updateDetails();
    }

    init();

})();

// =============================================
// PLAN LADDER SELECT — single-select radio group, same active/inactive
// class-swap pattern as the medication-toggle buttons above.
// =============================================
(function () {
    const planButtons = document.querySelectorAll('.wl-plans .wl-plans__item');
    planButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            planButtons.forEach(function (b) { b.classList.remove('is-selected'); });
            btn.classList.add('is-selected');
        });
    });
})();

// =============================================
// Swiper Inits
// =============================================
new Swiper(".patient-results .swiper", {
    slidesPerView: "auto",
    spaceBetween: 24,
    freeMode: false,
    grabCursor: true,
    mousewheel: false,
    centeredSlides: false,
});

new Swiper(".transformation-slider.swiper", {
    slidesPerView: 2.2,
    spaceBetween: 24,
    freeMode: false,
    grabCursor: true,
    mousewheel: false,
    centeredSlides: false,
});

new Swiper(".brand--grid--hero.swiper", {
    slidesPerView: 3.3,
    spaceBetween: 24,
    freeMode: false,
    grabCursor: true,
    mousewheel: false,
    centeredSlides: false,
});

// =============================================
// Tawk.to Script
// =============================================
var Tawk_API = Tawk_API || {},
    Tawk_LoadStart = new Date();
(function() {
    var s1 = document.createElement("script"),
        s0 = document.getElementsByTagName("script")[0];
    s1.async = true;
    s1.src = 'https://embed.tawk.to/6a454f1fb271bd1d477e9990/1jsfbq5mb';
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    s0.parentNode.insertBefore(s1, s0);
})();