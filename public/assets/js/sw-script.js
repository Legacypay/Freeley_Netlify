// Quiz modal is now the shared src/components/QuizModal.astro dialog
// (rendered on sexual-wellness.astro) — its own script binds every
// a[href^="/assessment-quiz"] link, so the old #quiz--modal div-based
// binding that used to live here was removed.

// =============================================
// SEXUAL WELLNESS PRODUCT GALLERY WITH MEDICATION TOGGLE
// =============================================
(function() {
    // =============================================
    // DATA CONFIGURATION - Edit this section only
    // =============================================
    const swProductData = {
        tadalafil: {
            name: "Tadalafil",
            title: "Tadalafil",
            description: "Tadalafil supports sustained blood flow for up to 36 hours — available as a daily 5mg dose or an as-needed 20mg dose.",
            images: [
                "/assets/sw/product1.png",
                "/assets/sw/product2.svg",
                "/assets/sw/product3.png",
                "/assets/sw/product4.png",
                "/assets/sw/product5.png"
            ],
            features: [
                "5mg daily or 20mg as-needed dosing",
                "Dissolves under the tongue (sublingual)",
                "Physician consultation & fast shipping included"
            ],
            price: "$99.00",
            originalPrice: null,
            badge: "Most Popular"
        },
        olympus: {
            name: "Olympus",
            title: "Olympus",
            description: "Oxytocin and Bremelanotide combined with Tadalafil for enhanced arousal and sustained blood flow.",
            images: [
                "/assets/sw/product1.png",
                "/assets/sw/product2.svg",
                "/assets/sw/product3.png",
                "/assets/sw/product4.png",
                "/assets/sw/product5.png"
            ],
            features: [
                "Oxytocin / Bremelanotide with or without Tadalafil",
                "Dissolves under the tongue (sublingual)",
                "Physician consultation & fast shipping included"
            ],
            price: "$139.00",
            originalPrice: null,
            badge: "Premium"
        }
    };

    // =============================================
    // GALLERY STATE
    // =============================================
    let currentSWMedication = 'tadalafil';
    let currentSWIndex = 0;

    // =============================================
    // DOM REFERENCES
    // =============================================
    const mainImgSW = document.getElementById("mainProductImageSW");
    const prevBtnSW = document.getElementById("prevBtnSW");
    const nextBtnSW = document.getElementById("nextBtnSW");
    const dotContainerSW = document.getElementById("dotContainerSW");
    const thumbContainerSW = document.getElementById("thumbnailsContainerSW");
    const featuresContainerSW = document.getElementById("featuresListSW");
    const medicationButtonsSW = document.querySelectorAll('.medication-toggle .btn');

    // =============================================
    // HELPER FUNCTIONS
    // =============================================
    function getCurrentSWData() {
        return swProductData[currentSWMedication];
    }

    // =============================================
    // GENERATE THUMBNAILS FROM MAIN IMAGES
    // =============================================
    function generateSWThumbnails(images) {
        if (!thumbContainerSW) return;
        thumbContainerSW.innerHTML = '';
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
            thumbContainerSW.appendChild(div);

            thumbDiv.addEventListener('click', function() {
                const idx = parseInt(this.getAttribute('data-index'), 10);
                goToSW(idx);
            });
        });
    }

    // =============================================
    // GENERATE DOTS
    // =============================================
    function generateSWDots(count) {
        if (!dotContainerSW) return;
        dotContainerSW.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const dot = document.createElement('span');
            dot.className = `dot-indicator ${i === 0 ? 'active' : ''}`;
            dot.addEventListener('click', function() {
                goToSW(i);
            });
            dotContainerSW.appendChild(dot);
        }
    }

    // =============================================
    // UPDATE PRODUCT DETAILS
    // =============================================
    function updateSWDetails() {
        const data = getCurrentSWData();

        const titleElement = document.querySelector('.product-title');
        if (titleElement) titleElement.textContent = data.title || data.name;

        const currentPrice = document.querySelector('.product-current-price');
        if (currentPrice) currentPrice.textContent = data.price;

        const originalPrice = document.querySelector('.text-decoration-line-through');
        if (originalPrice) originalPrice.textContent = data.originalPrice || '';

        const badge = document.querySelector('.popular-badge');
        if (badge) badge.textContent = data.badge;

        if (featuresContainerSW) {
            featuresContainerSW.innerHTML = '';
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
                featuresContainerSW.appendChild(div);
            });
        }
    }

    // =============================================
    // NAVIGATION FUNCTIONS
    // =============================================
    function goToSW(index) {
        const images = getCurrentSWData().images;
        if (index < 0) index = images.length - 1;
        if (index >= images.length) index = 0;

        if (mainImgSW) {
            mainImgSW.classList.add("fade-out");

            setTimeout(function() {
                currentSWIndex = index;
                mainImgSW.src = images[currentSWIndex];

                const dots = document.querySelectorAll("#dotContainerSW .dot-indicator");
                dots.forEach(function(d, i) {
                    d.classList.toggle("active", i === currentSWIndex);
                });

                const thumbs = document.querySelectorAll("#thumbnailsContainerSW .thumb-box");
                thumbs.forEach(function(tb, i) {
                    tb.classList.toggle("active", i === currentSWIndex);
                });

                mainImgSW.classList.remove("fade-out");
                mainImgSW.classList.add("fade-in");

                setTimeout(function() {
                    mainImgSW.classList.remove("fade-in");
                }, 400);
            }, 200);
        }
    }

    function switchSWMedication(medication) {
        if (medication === currentSWMedication) return;

        currentSWMedication = medication;
        currentSWIndex = 0;

        const data = getCurrentSWData();
        const images = data.images;

        if (mainImgSW) mainImgSW.src = images[0];
        generateSWThumbnails(images);
        generateSWDots(images.length);
        updateSWDetails();

        const thumbs = document.querySelectorAll("#thumbnailsContainerSW .thumb-box");
        thumbs.forEach((tb, i) => {
            tb.classList.toggle("active", i === 0);
        });

        const dots = document.querySelectorAll("#dotContainerSW .dot-indicator");
        dots.forEach((d, i) => {
            d.classList.toggle("active", i === 0);
        });
    }

    // =============================================
    // EVENT LISTENERS
    // =============================================
    if (prevBtnSW) {
        prevBtnSW.addEventListener("click", function() {
            goToSW(currentSWIndex - 1);
        });
    }

    if (nextBtnSW) {
        nextBtnSW.addEventListener("click", function() {
            goToSW(currentSWIndex + 1);
        });
    }

    medicationButtonsSW.forEach(function(button) {
        button.addEventListener("click", function() {
            medicationButtonsSW.forEach(function(btn) {
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

            if (medication === 'tadalafil' || medication === 'olympus') {
                switchSWMedication(medication);
            }
        });
    });

    // =============================================
    // INITIALIZE
    // =============================================
    function initSW() {
        const data = getCurrentSWData();
        const images = data.images;

        if (mainImgSW) {
            mainImgSW.src = images[0];
        }
        generateSWThumbnails(images);
        generateSWDots(images.length);
        updateSWDetails();
    }

    initSW();

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

const brandSwiper = new Swiper(".brand--grid--hero.swiper", {
    slidesPerView: "auto",
    spaceBetween: 20,
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