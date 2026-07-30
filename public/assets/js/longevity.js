// =============================================
// QUIZ MODAL SCRIPT
// =============================================
const modal = document.getElementById('quiz--modal');
const loader = document.getElementById('loader');
const quizContainer = document.getElementById('quiz--container');
let quizIframe = null;

document.querySelectorAll(
    '#start-full-assessment, #start-assessment1, #start-assessment2, #start-assessment3, #start-assessment4, #start-assessment5, #start-assessment6, #start-assessment-header'
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
        // Same frame metrics as /prototype's QuizModal: the quiz's first
        // step is ~810px tall — shorter frames cut the Start button below
        // the fold. White ground, no dark tint injected into the quiz body.
        quizIframe.style.height = 'min(780px, calc(100vh - 56px))';
        quizIframe.style.border = 'none';
        quizIframe.style.display = 'none';
        quizIframe.style.background = '#fff';

        quizIframe.src = '/assessment-quiz?t=' + Date.now();

        quizIframe.onload = function() {
            loader.style.display = 'none';
            quizIframe.style.display = 'block';
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
            images: [
                "/assets/l/sermorelin.jpeg",
                "/assets/l/nad+.png",
                "/assets/l/glutathione.jpeg",
                "/assets/l/wl.png",
                "/assets/l/kb.png"
            ],
            features: [
                "Sourced from 503A US pharmacies",
                "Customized stack tailored to you",
                "Physician review & expedited cold-shipping"
            ],
            price: "$129",
            originalPrice: null,
            badge: "Most Popular"
        },
        nad: {
            name: "NAD+",
            title: "NAD+ Peptide Therapy",
            description: "NAD+ boosts cellular energy and supports healthy aging at the molecular level.",
            images: [
                "/assets/l/nad+.png",
                "/assets/l/sermorelin.jpeg",
                "/assets/l/glutathione.jpeg",
                "/assets/l/wl.png",
                "/assets/l/kb.png"
            ],
            features: [
                "Sourced from 503A US pharmacies",
                "Customized stack tailored to you",
                "Physician review & expedited cold-shipping"
            ],
            price: "$189",
            originalPrice: null,
            badge: "Premium Choice"
        },
        glutathione: {
            name: "Glutathione",
            title: "Glutathione Peptide Therapy",
            description: "Glutathione is a powerful antioxidant that supports detoxification and immune health.",
            images: [
                "/assets/l/glutathione.jpeg",
                "/assets/l/sermorelin.jpeg",
                "/assets/l/nad+.png",
                "/assets/l/wl.png",
                "/assets/l/kb.png"
            ],
            features: [
                "Sourced from 503A US pharmacies",
                "Customized stack tailored to you",
                "Physician review & expedited cold-shipping"
            ],
            price: "$129",
            originalPrice: null,
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
        if (index < 0) index = images.length - 1;
        if (index >= images.length) index = 0;

        if (mainImg) {
            mainImg.classList.add("fade-out");

            setTimeout(function() {
                currentIndex = index;
                mainImg.src = images[currentIndex];

                const dots = document.querySelectorAll("#dotContainerL .dot-indicator");
                dots.forEach(function(d, i) {
                    d.classList.toggle("active", i === currentIndex);
                });

                const thumbs = document.querySelectorAll("#thumbnailsContainerL .thumb-box");
                thumbs.forEach(function(tb, i) {
                    tb.classList.toggle("active", i === currentIndex);
                });

                mainImg.classList.remove("fade-out");
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
        }
        generateThumbnails(images);
        generateDots(images.length);
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
        }
        generateThumbnails(images);
        generateDots(images.length);
        updateDetails();
    }

    init();

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