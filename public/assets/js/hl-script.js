// Quiz modal is now the shared src/components/QuizModal.astro dialog
// (rendered on hair-loss.astro) — its own script binds every
// a[href^="/assessment-quiz"] link, so the old #quiz--modal div-based
// binding that used to live here was removed.




// const medicationButtons = document.querySelectorAll('.medication-toggle .btn');

// medicationButtons.forEach(button => {
//     button.addEventListener('click', () => {
//         medicationButtons.forEach(btn => {
//             btn.classList.remove('active-medication');
//         });

//         button.classList.add('active-medication');
//     });
// });


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

const transformSwiper = new Swiper(".transformSwiper.swiper", {
    slidesPerView: "auto",
    spaceBetween: 20,
    freeMode: false,
    autoplay: {
        delay: 5000,
    },
    direction: 'horizontal',
    loop: true,
    grabCursor: true,
    mousewheel: false,
    centeredSlides: false,
});


// product carousel next/back image change functionality
const productImages = [
    "/assets/hl/product.svg",
    "/assets/hl/product.svg",
    "/assets/hl/product.svg",
    "/assets/hl/product.svg",
];
let currentIdx = 0;
const mainProductImg = document.getElementById("dynamicProductImg");
const dotsContainerDiv = document.getElementById("dotsContainer");
const thumbsContainerDiv = document.getElementById("thumbnailsContainer");

function updateProductCarousel(index) {
    if (mainProductImg) mainProductImg.src = productImages[index];
    if (dotsContainerDiv) {
        const dots = dotsContainerDiv.querySelectorAll(".dot-indicator");
        dots.forEach((d, i) => {
            if (i === index) d.classList.add("active");
            else d.classList.remove("active");
        });
    }
    if (thumbsContainerDiv) {
        const thumbs = thumbsContainerDiv.querySelectorAll(".thumb-box");
        thumbs.forEach((th, i) => {
            if (i === index) th.classList.add("active");
            else th.classList.remove("active");
        });
    }
}

function buildCarouselUI() {
    if (dotsContainerDiv) {
        dotsContainerDiv.innerHTML = "";
        productImages.forEach((_, idx) => {
            const dot = document.createElement("span");
            dot.classList.add("dot-indicator");
            if (idx === currentIdx) dot.classList.add("active");
            dot.addEventListener("click", () => {
                currentIdx = idx;
                updateProductCarousel(currentIdx);
            });
            dotsContainerDiv.appendChild(dot);
        });
    }
    if (thumbsContainerDiv) {
        thumbsContainerDiv.innerHTML = "";
        productImages.forEach((src, idx) => {
            const thumbDiv = document.createElement("div");
            thumbDiv.className = "thumb-box text-center";
            if (idx === currentIdx) thumbDiv.classList.add("active");
            const img = document.createElement("img");
            img.src = src;
            img.alt = `thumb ${idx + 1}`;
            img.className = "img-fluid";
            img.style.maxWidth = "70px";
            thumbDiv.appendChild(img);
            thumbDiv.addEventListener("click", () => {
                currentIdx = idx;
                updateProductCarousel(currentIdx);
            });
            thumbsContainerDiv.appendChild(thumbDiv);
        });
    }
}
document.getElementById("prevImageBtn")?.addEventListener("click", () => {
    currentIdx =
        (currentIdx - 1 + productImages.length) % productImages.length;
    updateProductCarousel(currentIdx);
});
document.getElementById("nextImageBtn")?.addEventListener("click", () => {
    currentIdx = (currentIdx + 1) % productImages.length;
    updateProductCarousel(currentIdx);
});
buildCarouselUI();
updateProductCarousel(0);

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



// =============================================
// HAIR LOSS PRODUCT GALLERY WITH 3 TOGGLE OPTIONS
// =============================================
(function() {
    // =============================================
    // DATA CONFIGURATION - Edit this section only
    // =============================================
    const hairMedicationData = {
        cedar: {
            name: "Cedar",
            title: "Cedar Hair Growth Tablet",
            description: "Biotin, Finasteride, and Minoxidil combined in one daily tablet — DHT-blocking and follicle-stimulating action together.",
            // Straight bottle -> pills -> tilted bottle. product2.png turned
            // out to already be at a slight tilt (not truly straight-on),
            // which paired with the new tilted shot left Cedar with two
            // tilted-looking bottles — generated product-cedar-straight.png
            // as a genuinely straight replacement instead (2026-08-04).
            // product1.png (Willow's OWN labeled bottle — wrong ingredients
            // to show a Cedar shopper) is no longer used here.
            // product4/product5 (old "What's Included"/"Expected Results"
            // infographic slides) live in the ProductInfoModal popup
            // instead — see hair-loss.astro.
            images: [
                "/assets/hl/product-cedar-straight.png",
                "/assets/hl/product3.png",
                "/assets/hl/product-cedar-tilted.png"
            ],
            features: [
                "Biotin 5mg / Finasteride 1mg / Minoxidil 2.5mg",
                "One tablet by mouth, once daily",
                "Precision-dosed by licensed physicians"
            ],
            // Default to the 24-month plan rate (matches the plan ladder's
            // pre-selected "best" card) with the 1-month rate struck through,
            // instead of a fake "was" price — both numbers are real tiers
            // from the same `plans` ladder, not invented for the discount look.
            price: "$49.00",
            originalPrice: "$89.00",
            badge: "Most Popular"
        },
        ivy: {
            name: "Ivy",
            title: "Ivy Hair Tablet (Women 45+)",
            description: "Minoxidil and Dutasteride with Biotin, formulated for women 45 and older.",
            // product-ivy.png generated 2026-08-04 (Gemini 3.1 Flash Image), matching
            // Cedar/Willow's bottle style with the correct "Dutasteride, Minoxidil,
            // Biotin" label — replaces the old workaround that had to avoid showing
            // any bottle at all because product1/product2 are Willow's and Cedar's
            // OWN labeled bottles (wrong ingredients for an Ivy shopper to see).
            // Straight bottle -> pills -> tilted bottle, same sequence as
            // Cedar/Willow. product4/product5 (old "What's Included"/
            // "Expected Results" infographic slides) live in the
            // ProductInfoModal popup instead — see hair-loss.astro.
            images: [
                "/assets/hl/product-ivy.png",
                "/assets/hl/product3.png",
                "/assets/hl/product-ivy-tilted.png"
            ],
            features: [
                "Minoxidil 1mg / Dutasteride 0.4mg with Biotin",
                "One tablet by mouth, once daily",
                "Precision-dosed by licensed physicians"
            ],
            // Default to the 24-month plan rate (matches the plan ladder's
            // pre-selected "best" card) with the 1-month rate struck through,
            // instead of a fake "was" price — both numbers are real tiers
            // from the same `plans` ladder, not invented for the discount look.
            price: "$49.00",
            originalPrice: "$89.00",
            badge: "For Women 45+"
        },
        willow: {
            name: "Willow",
            title: "Willow Hair Tablet (Women Under 45)",
            description: "Minoxidil and Spironolactone with Biotin, formulated for women under 45.",
            // Straight bottle -> pills -> tilted bottle. product2.png (was
            // here as image 2) is Cedar's OWN labeled bottle — wrong
            // ingredients to show a Willow shopper — swapped for Willow's
            // own tilted shot (generated 2026-08-04, matches product1.png's
            // label). product4/product5 (old "What's Included"/"Expected
            // Results" infographic slides) live in the ProductInfoModal
            // popup instead — see hair-loss.astro.
            images: [
                "/assets/hl/product1.png",
                "/assets/hl/product3.png",
                "/assets/hl/product-willow-tilted.png"
            ],
            features: [
                "Minoxidil 1mg / Spironolactone 60mg with Biotin",
                "One tablet by mouth, once daily",
                "Precision-dosed by licensed physicians"
            ],
            // Default to the 24-month plan rate (matches the plan ladder's
            // pre-selected "best" card) with the 1-month rate struck through,
            // instead of a fake "was" price — both numbers are real tiers
            // from the same `plans` ladder, not invented for the discount look.
            price: "$49.00",
            originalPrice: "$89.00",
            badge: "For Women Under 45"
        }
    };

    // =============================================
    // GALLERY STATE
    // =============================================
    let currentHairMedication = 'cedar';
    let currentHairIndex = 0;

    // =============================================
    // DOM REFERENCES
    // =============================================
    const mainImgHair = document.getElementById("mainProductImageHair");
    const prevBtnHair = document.getElementById("prevBtnHair");
    const nextBtnHair = document.getElementById("nextBtnHair");
    const dotContainerHair = document.getElementById("dotContainerHair");
    const thumbContainerHair = document.getElementById("thumbnailsContainerHair");
    const featuresContainerHair = document.getElementById("featuresListHair");
    const medicationButtonsHair = document.querySelectorAll('.medication-toggle .btn');

    // =============================================
    // HELPER FUNCTIONS
    // =============================================
    function getCurrentHairData() {
        return hairMedicationData[currentHairMedication];
    }

    function getHairImagePaths() {
        return getCurrentHairData().images;
    }

    function getHairSlideCount() {
        return getHairImagePaths().length;
    }

    // =============================================
    // GENERATE THUMBNAILS FROM MAIN IMAGES
    // =============================================
    function generateHairThumbnails(images) {
        thumbContainerHair.innerHTML = '';
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
            thumbContainerHair.appendChild(div);

            thumbDiv.addEventListener('click', function() {
                const idx = parseInt(this.getAttribute('data-index'), 10);
                goToHair(idx);
            });
        });
    }

    // =============================================
    // GENERATE DOTS
    // =============================================
    function generateHairDots(count) {
        dotContainerHair.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const dot = document.createElement('span');
            dot.className = `dot-indicator ${i === 0 ? 'active' : ''}`;
            dot.addEventListener('click', function() {
                goToHair(i);
            });
            dotContainerHair.appendChild(dot);
        }
    }

    // =============================================
    // UPDATE PRODUCT DETAILS
    // =============================================
    function updateHairDetails() {
        const data = getCurrentHairData();

        const titleElement = document.querySelector('.product-title');
        if (titleElement) titleElement.textContent = data.title || data.name;

        const currentPrice = document.querySelector('.product-current-price');
        if (currentPrice) currentPrice.textContent = data.price;

        const originalPrice = document.querySelector('.text-decoration-line-through');
        if (originalPrice) originalPrice.textContent = data.originalPrice || '';

        const badge = document.querySelector('.popular-badge');
        if (badge) badge.textContent = data.badge;

        featuresContainerHair.innerHTML = '';
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
            featuresContainerHair.appendChild(div);
        });
    }

    // =============================================
    // NAVIGATION FUNCTIONS
    // =============================================
    function goToHair(index) {
        const images = getHairImagePaths();
        const total = getHairSlideCount();
        if (index < 0) index = total - 1;
        if (index >= total) index = 0;

        mainImgHair.classList.add("fade-out");

        setTimeout(function() {
            currentHairIndex = index;

            mainImgHair.classList.remove("fade-out", "fade-in");
            mainImgHair.src = images[currentHairIndex];

            const dots = document.querySelectorAll("#dotContainerHair .dot-indicator");
            dots.forEach(function(d, i) {
                d.classList.toggle("active", i === currentHairIndex);
            });

            const thumbs = document.querySelectorAll("#thumbnailsContainerHair .thumb-box");
            thumbs.forEach(function(tb, i) {
                tb.classList.toggle("active", i === currentHairIndex);
            });

            mainImgHair.classList.add("fade-in");
            setTimeout(function() {
                mainImgHair.classList.remove("fade-in");
            }, 400);
        }, 200);
    }

    function switchHairMedication(medication) {
        if (medication === currentHairMedication) return;

        currentHairMedication = medication;
        currentHairIndex = 0;

        const data = getCurrentHairData();
        const images = data.images;

        mainImgHair.src = images[0];
        mainImgHair.classList.remove("fade-out", "fade-in");
        generateHairThumbnails(images);
        generateHairDots(getHairSlideCount());
        updateHairDetails();

        const thumbs = document.querySelectorAll("#thumbnailsContainerHair .thumb-box");
        thumbs.forEach((tb, i) => {
            tb.classList.toggle("active", i === 0);
        });

        const dots = document.querySelectorAll("#dotContainerHair .dot-indicator");
        dots.forEach((d, i) => {
            d.classList.toggle("active", i === 0);
        });
    }

    // =============================================
    // EVENT LISTENERS
    // =============================================
    prevBtnHair.addEventListener("click", function() {
        goToHair(currentHairIndex - 1);
    });

    nextBtnHair.addEventListener("click", function() {
        goToHair(currentHairIndex + 1);
    });

    medicationButtonsHair.forEach(function(button) {
        button.addEventListener("click", function() {
            medicationButtonsHair.forEach(function(btn) {
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

            if (medication === 'cedar' || medication === 'ivy' || medication === 'willow') {
                switchHairMedication(medication);
            }
        });
    });

    // =============================================
    // INITIALIZE
    // =============================================
    function initHair() {
        const data = getCurrentHairData();
        const images = data.images;

        mainImgHair.src = images[0];
        mainImgHair.classList.remove("fade-out", "fade-in");
        generateHairThumbnails(images);
        generateHairDots(getHairSlideCount());
        updateHairDetails();
    }

    initHair();

})();

// =============================================
// PLAN LADDER SELECT — single-select radio group, same active/inactive
// class-swap pattern as the medication-toggle buttons above.
// =============================================
(function () {
    const planButtons = document.querySelectorAll('.wl-plans .wl-plan');
    planButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            planButtons.forEach(function (b) { b.classList.remove('is-selected'); });
            btn.classList.add('is-selected');
        });
    });
})();