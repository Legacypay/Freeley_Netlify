const modal = document.getElementById('quiz--modal');
const loader = document.getElementById('loader');
const quizContainer = document.getElementById('quiz--container');
let quizIframe = null;

document.querySelectorAll(
    '#start-full-assessment, #start-assessment1, #start-assessment2, #start-assessment3, #start-assessment4, #start-assessment5, #start-assessment6, #start-assesment-header'
).forEach(button => {
    button.addEventListener('click', () => {
        // If iframe exists, remove it first
        if (quizIframe) {
            quizIframe.remove();
            quizIframe = null;
        }

        modal.style.display = 'block';
        loader.style.display = 'block';
        quizContainer.innerHTML = '';

        // Create new iframe
        quizIframe = document.createElement('iframe');
        quizIframe.style.width = '100%';
        quizIframe.style.height = '605px';
        quizIframe.style.border = 'none';
        quizIframe.style.borderRadius = '0';
        quizIframe.style.display = 'none';
        quizIframe.style.background = '#0000004D';

        // Load with cache-busting
        quizIframe.src = '/assessment-quiz?t=' + Date.now();

        quizIframe.onload = function() {
            loader.style.display = 'none';
            quizIframe.style.display = 'block';

            // Apply styles to iframe body (if you have access)
            try {
                const iframeDoc = quizIframe.contentDocument || quizIframe.contentWindow.document;
                if (iframeDoc) {
                    const style = iframeDoc.createElement('style');
                    style.textContent = `
                            body {
                                background: #0000004D !important;
                                border: 0 !important;
                                border-radius: 0 !important;
                                height: 100vh;
                                margin: 0;
                            }
                        `;
                    iframeDoc.head.appendChild(style);
                }
            } catch (e) {
                // Cross-origin restrictions may prevent this
                console.log('Cannot style iframe body due to CORS');
            }
        };

        quizIframe.onerror = function() {
            loader.style.display = 'none';
            quizContainer.innerHTML = '<p>Unable to load quiz.</p>';
        };

        quizContainer.appendChild(quizIframe);
    });
});

function closeQuiz() {
    // Hide modal
    modal.style.display = 'none';

    // Remove iframe completely
    if (quizIframe) {
        // Clear iframe content
        try {
            quizIframe.src = 'about:blank';
            quizIframe.contentWindow.document.write('');
            quizIframe.contentWindow.document.clear();
        } catch (e) {}

        // Remove from DOM
        quizIframe.remove();
        quizIframe = null;
    }

    // Clear container
    quizContainer.innerHTML = '';
    loader.style.display = 'none';
}

document
    .getElementById('close--quiz')
    .addEventListener('click', closeQuiz);

// Close on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.style.display === 'block') {
        closeQuiz();
    }
});

// Close when clicking outside
window.addEventListener('click', function(e) {
    if (e.target === modal) {
        closeQuiz();
    }
});




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
        finasteride: {
            name: "Finasteride",
            title: "Compounded Finasteride + Minoxidil",
            description: "Finasteride is a DHT blocker that helps prevent hair loss and promote regrowth.",
            images: [
                "/assets/hl/product1.png",
                "/assets/hl/product2.png",
                "/assets/hl/product3.png",
                "/assets/hl/product4.png",
                "/assets/hl/product5.png"
            ],
            features: [
                "Synergistic 2-in-1 compounded formula",
                "Choose between Oral Pill or Topical Spray",
                "Precision-dosed by licensed physicians"
            ],
            price: "$39.00",
            originalPrice: "$49.00",
            badge: "Most Popular"
        },
        minoxidil: {
            name: "Minoxidil",
            title: "Compounded Minoxidil",
            description: "Minoxidil is a vasodilator that stimulates hair follicles and promotes growth.",
            images: [
                "/assets/hl/product1.png",
                "/assets/hl/product2.png",
                "/assets/hl/product3.png",
                "/assets/hl/product4.png",
                "/assets/hl/product5.png"
            ],
            features: [
                "Synergistic 2-in-1 compounded formula",
                "Choose between Oral Pill or Topical Spray",
                "Precision-dosed by licensed physicians"
            ],
            price: "$34.00",
            originalPrice: "$44.00",
            badge: "Best Value"
        },
        biotin: {
            name: "Biotin",
            title: "Compounded Biotin",
            description: "Biotin is an essential vitamin that strengthens hair and promotes healthy growth.",
            images: [
                "/assets/hl/product1.png",
                "/assets/hl/product2.png",
                "/assets/hl/product3.png",
                "/assets/hl/product4.png",
                "/assets/hl/product5.png"
            ],
            features: [
                "Synergistic 2-in-1 compounded formula",
                "Choose between Oral Pill or Topical Spray",
                "Precision-dosed by licensed physicians"
            ],
            price: "$29.00",
            originalPrice: "$39.00",
            badge: "Essential Support"
        }
    };

    // =============================================
    // GALLERY STATE
    // =============================================
    let currentHairMedication = 'finasteride';
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
        if (originalPrice) originalPrice.textContent = data.originalPrice;

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
        if (index < 0) index = images.length - 1;
        if (index >= images.length) index = 0;

        mainImgHair.classList.add("fade-out");

        setTimeout(function() {
            currentHairIndex = index;
            mainImgHair.src = images[currentHairIndex];

            const dots = document.querySelectorAll("#dotContainerHair .dot-indicator");
            dots.forEach(function(d, i) {
                d.classList.toggle("active", i === currentHairIndex);
            });

            const thumbs = document.querySelectorAll("#thumbnailsContainerHair .thumb-box");
            thumbs.forEach(function(tb, i) {
                tb.classList.toggle("active", i === currentHairIndex);
            });

            mainImgHair.classList.remove("fade-out");
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
        generateHairThumbnails(images);
        generateHairDots(images.length);
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

            if (medication === 'finasteride' || medication === 'minoxidil' || medication === 'biotin') {
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
        generateHairThumbnails(images);
        generateHairDots(images.length);
        updateHairDetails();
    }

    initHair();

})();