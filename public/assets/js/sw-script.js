// =============================================
// QUIZ MODAL SCRIPT
// =============================================
const modal = document.getElementById('quiz--modal');
const loader = document.getElementById('loader');
const quizContainer = document.getElementById('quiz--container');
let quizIframe = null;

document.querySelectorAll(
    '#start-full-assessment, #start-assessment1, #start-assessment2, #start-assessment3, #start-assessment4, #start-assessment5, #start-assessment6, #start-assesment-header'
).forEach(button => {
    button.addEventListener('click', () => {
        if (quizIframe) {
            quizIframe.remove();
            quizIframe = null;
        }

        modal.style.display = 'block';
        loader.style.display = 'block';
        quizContainer.innerHTML = '';

        quizIframe = document.createElement('iframe');
        quizIframe.style.width = '100%';
        quizIframe.style.height = '605px';
        quizIframe.style.border = 'none';
        quizIframe.style.borderRadius = '0';
        quizIframe.style.display = 'none';
        quizIframe.style.background = '#0000004D';

        quizIframe.src = '/assessment-quiz?t=' + Date.now();

        quizIframe.onload = function() {
            loader.style.display = 'none';
            quizIframe.style.display = 'block';

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
    modal.style.display = 'none';

    if (quizIframe) {
        try {
            quizIframe.src = 'about:blank';
            quizIframe.contentWindow.document.write('');
            quizIframe.contentWindow.document.clear();
        } catch (e) {}

        quizIframe.remove();
        quizIframe = null;
    }

    quizContainer.innerHTML = '';
    loader.style.display = 'none';
}

document.getElementById('close--quiz').addEventListener('click', closeQuiz);

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.style.display === 'block') {
        closeQuiz();
    }
});

window.addEventListener('click', function(e) {
    if (e.target === modal) {
        closeQuiz();
    }
});

// =============================================
// SEXUAL WELLNESS PRODUCT GALLERY - Single Product
// =============================================
(function() {
    // =============================================
    // DATA CONFIGURATION - Edit this section only
    // =============================================
    const swProductData = {
        name: "3-in-1 ED Troche",
        title: "3-in-1 ED Troche",
        description: "Clinically-formulated treatments for enhanced wellness.",
        images: [
            "/assets/sw/product1.png",
            "/assets/sw/product2.svg",
            "/assets/sw/product3.png",
            "/assets/sw/product4.png",
            "/assets/sw/product5.png"
        ],
        features: [
            "Dissolves under the tongue (Sublingual)",
            "Sildenafil + Tadalafil + Apomorphine",
            "Physician consultation & fast shipping included"
        ],
        price: "$89.00",
        originalPrice: "$49.00",
        badge: "Most Popular"
    };

    // =============================================
    // GALLERY STATE
    // =============================================
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
        const data = swProductData;

        const titleElement = document.querySelector('.product-title');
        if (titleElement) titleElement.textContent = data.title || data.name;

        const currentPrice = document.querySelector('.product-current-price');
        if (currentPrice) currentPrice.textContent = data.price;

        const originalPrice = document.querySelector('.text-decoration-line-through');
        if (originalPrice) originalPrice.textContent = data.originalPrice;

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
        const images = swProductData.images;
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

    // =============================================
    // INITIALIZE
    // =============================================
    function initSW() {
        const data = swProductData;
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