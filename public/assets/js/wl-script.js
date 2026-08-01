// =============================================
// COMPLETE PRODUCT GALLERY WITH MEDICATION TOGGLE
// =============================================
// Quiz modal is now the shared src/components/QuizModal.astro dialog
// (rendered on weight-loss.astro) — its own script binds every
// a[href^="/assessment-quiz"] link, so the old #quiz--modal div-based
// binding that used to live here was removed.
(function() {
    // =============================================
    // DATA CONFIGURATION - Edit this section only
    // =============================================
    const medicationData = {
        semaglutide: {
            name: "Semaglutide",
            title: "Compounded Semaglutide",
            description: "Semaglutide is a GLP-1 receptor agonist that helps regulate appetite and blood sugar levels.",
            images: [
                "/assets/wl/semag.png",
                "/assets/wl/product2.png",
                "/assets/wl/product3.png",
                "/assets/wl/product4.png",
                "/assets/wl/product5.png"
            ],
            features: [
                "Compounded GLP-1 receptor agonist",
                "Average 15% body weight loss",
                "Starts as low as $99.29 for month one",
            ],
            price: "$199*",
            originalPrice: "$299.00",
            badge: "Most Popular"
        },
        tirzepatide: {
            name: "Tirzepatide",
            title: "Compounded Tirzepatide",
            description: "Tirzepatide is a dual GIP/GLP-1 receptor agonist for enhanced weight loss results.",
            images: [
                "/assets/wl/tirzz.png",
                "/assets/wl/product2.png",
                "/assets/wl/product3.png",
                "/assets/wl/product4.png",
                "/assets/wl/product5.png"
            ],
            features: [
                "Compounded GLP-1 receptor agonist",
                "Average 15% body weight loss",
                "Starts as low as $99.29 for month one",
            ],
            price: "$299*",
            originalPrice: "$399.00",
            badge: "Premium Choice"
        }
    };

    // =============================================
    // GALLERY STATE
    // =============================================
    let currentMedication = 'semaglutide';
    let currentIndex = 0;

    // =============================================
    // DOM REFERENCES
    // =============================================
    const mainImg = document.getElementById("mainProductImage");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const dotContainer = document.getElementById("dotContainer");
    const thumbContainer = document.getElementById("thumbnailsContainer");
    const featuresContainer = document.getElementById("featuresList");
    const medicationButtons = document.querySelectorAll('.medication-toggle .btn');

    // =============================================
    // HELPER FUNCTIONS
    // =============================================
    function getCurrentData() {
        return medicationData[currentMedication];
    }

    function getImagePaths() {
        return getCurrentData().images;
    }

    // =============================================
    // GENERATE THUMBNAILS FROM MAIN IMAGES
    // =============================================
    function generateThumbnails(images) {
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
        if (originalPrice) originalPrice.textContent = data.originalPrice;

        const badge = document.querySelector('.popular-badge');
        if (badge) badge.textContent = data.badge;

        featuresContainer.innerHTML = '';
        data.features.forEach(feature => {
            const div = document.createElement('div');
            div.className = 'feature-item mb-2';
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

    // =============================================
    // NAVIGATION FUNCTIONS
    // =============================================
    function goTo(index) {
        const images = getImagePaths();
        if (index < 0) index = images.length - 1;
        if (index >= images.length) index = 0;

        mainImg.classList.add("fade-out");

        setTimeout(function() {
            currentIndex = index;
            mainImg.src = images[currentIndex];

            const dots = document.querySelectorAll("#dotContainer .dot-indicator");
            dots.forEach(function(d, i) {
                d.classList.toggle("active", i === currentIndex);
            });

            const thumbs = document.querySelectorAll(".thumb-box");
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

    function switchMedication(medication) {
        if (medication === currentMedication) return;

        currentMedication = medication;
        currentIndex = 0;

        const data = getCurrentData();
        const images = data.images;

        mainImg.src = images[0];
        generateThumbnails(images);
        generateDots(images.length);
        updateDetails();

        const thumbs = document.querySelectorAll(".thumb-box");
        thumbs.forEach((tb, i) => {
            tb.classList.toggle("active", i === 0);
        });

        const dots = document.querySelectorAll("#dotContainer .dot-indicator");
        dots.forEach((d, i) => {
            d.classList.toggle("active", i === 0);
        });
    }

    // =============================================
    // EVENT LISTENERS
    // =============================================
    prevBtn.addEventListener("click", function() {
        goTo(currentIndex - 1);
    });

    nextBtn.addEventListener("click", function() {
        goTo(currentIndex + 1);
    });

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

            if (medication === 'semaglutide' || medication === 'tirzepatide') {
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

        mainImg.src = images[0];
        generateThumbnails(images);
        generateDots(images.length);
        updateDetails();
    }

    init();

})();

// =============================================
// Swiper Init
// =============================================

const okSwiper = new Swiper(".ok--section.swiper", {
    slidesPerView: "auto",
    spaceBetween: 20,
    autoplay: {
        delay: 5000,
    },
    direction: 'horizontal',
    loop: true,
    freeMode: false,
    grabCursor: true,
    mousewheel: false,
    centeredSlides: false,
});

const brandSwiper = new Swiper(".brand--grid--hero.swiper", {
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

const transformSwiper = new Swiper(".transformSwiper.swiper", {
    slidesPerView: "auto",
    autoplay: {
        delay: 5000,
    },
    direction: 'horizontal',
    loop: true,
    spaceBetween: 24,
    freeMode: false,
    grabCursor: true,
});

// Tawk.to Script
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




//   /***----------------------------------
//    * Quiz Modal Js Script
//    * *----------------------------------*/
//     const modal = document.getElementById('quiz--modal');
//     const loader = document.getElementById('loader');
//     const quizContainer = document.getElementById('quiz--container');
//     let quizIframe = null;

//     document.querySelectorAll(
//         '#start-assessment-header,#start-full-assessment, #start-assessment1, #start-assessment2, #start-assessment3, #start-assessment4, #start-assessment5, #start-assessment6'
//     ).forEach(button => {
//         button.addEventListener('click', () => {
//             // If iframe exists, remove it first
//             if (quizIframe) {
//                 quizIframe.remove();
//                 quizIframe = null;
//             }

//             modal.style.display = 'block';
//             loader.style.display = 'block';
//             quizContainer.innerHTML = '';

//             // Create new iframe
//             quizIframe = document.createElement('iframe');
//             quizIframe.style.width = '100%';
//             quizIframe.style.height = '605px';
//             quizIframe.style.border = 'none';
//             quizIframe.style.borderRadius = '0';
//             quizIframe.style.display = 'none';
//             quizIframe.style.background = '#0000004D';

//             // Load with cache-busting
//             quizIframe.src = './assessment-quiz.html?t=' + Date.now();

//             quizIframe.onload = function() {
//                 loader.style.display = 'none';
//                 quizIframe.style.display = 'block';

//                 // Apply styles to iframe body (if you have access)
//                 try {
//                     const iframeDoc = quizIframe.contentDocument || quizIframe.contentWindow.document;
//                     if (iframeDoc) {
//                         const style = iframeDoc.createElement('style');
//                         style.textContent = `
//                             body {
//                                 background: #0000004D !important;
//                                 border: 0 !important;
//                                 border-radius: 0 !important;
//                                 height: 100vh;
//                                 margin: 0;
//                             }
//                         `;
//                         iframeDoc.head.appendChild(style);
//                     }
//                 } catch(e) {
//                     // Cross-origin restrictions may prevent this
//                     console.log('Cannot style iframe body due to CORS');
//                 }
//             };

//             quizIframe.onerror = function() {
//                 loader.style.display = 'none';
//                 quizContainer.innerHTML = '<p>Unable to load quiz.</p>';
//             };

//             quizContainer.appendChild(quizIframe);
//         });
//     });

//     function closeQuiz() {
//         // Hide modal
//         modal.style.display = 'none';

//         // Remove iframe completely
//         if (quizIframe) {
//             // Clear iframe content
//             try {
//                 quizIframe.src = 'about:blank';
//                 quizIframe.contentWindow.document.write('');
//                 quizIframe.contentWindow.document.clear();
//             } catch(e) {}

//             // Remove from DOM
//             quizIframe.remove();
//             quizIframe = null;
//         }

//         // Clear container
//         quizContainer.innerHTML = '';
//         loader.style.display = 'none';
//     }

//     document
//         .getElementById('close--quiz')
//         .addEventListener('click', closeQuiz);

//     // Close on Escape key
//     document.addEventListener('keydown', function(e) {
//         if (e.key === 'Escape' && modal.style.display === 'block') {
//             closeQuiz();
//         }
//     });

//     // Close when clicking outside
//     window.addEventListener('click', function(e) {
//         if (e.target === modal) {
//             closeQuiz();
//         }
//     });

// // =============================================
// // COMPLETE PRODUCT GALLERY WITH MEDICATION TOGGLE
// // =============================================
// (function () {
//   // =============================================
//   // DATA CONFIGURATION - Edit this section only
//   // =============================================
//   const medicationData = {
//     semaglutide: {
//       name: "Semaglutide",
//       title: "Compounded Semaglutide",
//       description: "Semaglutide is a GLP-1 receptor agonist that helps regulate appetite and blood sugar levels.",
//       images: [
//         "/assets/wl/semag.png",
//         "/assets/wl/product2.png",
//         "/assets/wl/product3.png",
//         "/assets/wl/product4.png",
//         "/assets/wl/product5.png"
//       ],
//       features: [
//         "Compounded GLP-1 receptor agonist",
//         "Average 15% body weight loss",
//         "Starts as low as $99.29 for month one",
//         "Once-weekly injection",
//         "Proven appetite suppression"
//       ],
//       price: "$99*",
//       originalPrice: "$249.00",
//       badge: "Most Popular"
//     },
//     tirzepatide: {
//       name: "Tirzepatide",
//       title: "Compounded Tirzepatide",
//       description: "Tirzepatide is a dual GIP/GLP-1 receptor agonist for enhanced weight loss results.",
//       images: [
//         "/assets/wl/tirz.png",
//         "/assets/wl/tirz2.png",
//         "/assets/wl/tirz3.png",
//         "/assets/wl/tirz4.png",
//         "/assets/wl/tirz5.png"
//       ],
//       features: [
//         "Dual GIP/GLP-1 receptor agonist",
//         "Average 20% body weight loss",
//         "Starts as low as $129.29 for month one",
//         "Once-weekly injection",
//         "Superior appetite control"
//       ],
//       price: "$129*",
//       originalPrice: "$349.00",
//       badge: "Premium Choice"
//     }
//   };

//   // =============================================
//   // GALLERY STATE
//   // =============================================
//   let currentMedication = 'semaglutide';
//   let currentIndex = 0;

//   // =============================================
//   // DOM REFERENCES
//   // =============================================
//   const mainImg = document.getElementById("mainProductImage");
//   const prevBtn = document.getElementById("prevBtn");
//   const nextBtn = document.getElementById("nextBtn");
//   const dotContainer = document.getElementById("dotContainer");
//   const thumbContainer = document.getElementById("thumbnailsContainer");
//   const detailsContainer = document.getElementById("medicationDetails");
//   const featuresContainer = document.getElementById("featuresList");
//   const medicationButtons = document.querySelectorAll('.medication-toggle .btn');

//   // =============================================
//   // HELPER FUNCTIONS
//   // =============================================
//   function getCurrentData() {
//     return medicationData[currentMedication];
//   }

//   function getImagePaths() {
//     return getCurrentData().images;
//   }

//   // =============================================
//   // GENERATE THUMBNAILS FROM MAIN IMAGES
//   // =============================================
//   function generateThumbnails(images) {
//     thumbContainer.innerHTML = '';
//     images.forEach((imgPath, index) => {
//       const div = document.createElement('div');
//       const thumbDiv = document.createElement('div');
//       thumbDiv.className = `thumb-box text-center ${index === 0 ? 'active' : ''}`;
//       thumbDiv.setAttribute('data-index', index);

//       const img = document.createElement('img');
//       img.src = imgPath; // Using same image as thumbnail
//       img.alt = `Thumb ${index + 1}`;
//       img.className = 'img-fluid';
//       img.style.width = '60px';
//       img.style.height = '60px';
//       img.style.objectFit = 'contain';

//       thumbDiv.appendChild(img);
//       div.appendChild(thumbDiv);
//       thumbContainer.appendChild(div);

//       // Add click event
//       thumbDiv.addEventListener('click', function() {
//         const idx = parseInt(this.getAttribute('data-index'), 10);
//         goTo(idx);
//       });
//     });
//   }

//   // =============================================
//   // GENERATE DOTS
//   // =============================================
//   function generateDots(count) {
//     dotContainer.innerHTML = '';
//     for (let i = 0; i < count; i++) {
//       const dot = document.createElement('span');
//       dot.className = `dot-indicator ${i === 0 ? 'active' : ''}`;
//       dot.addEventListener('click', function() {
//         goTo(i);
//       });
//       dotContainer.appendChild(dot);
//     }
//   }

//   // =============================================
//   // UPDATE PRODUCT DETAILS
//   // =============================================
//   function updateDetails() {
//     const data = getCurrentData();

//     // Update title
//     const titleElement = document.querySelector('.product-title');
//     if (titleElement) titleElement.textContent = data.title || data.name;

//     // Update description
//     const descElement = document.querySelector('.product-details-content .text-14-inter');
//     if (descElement && !descElement.closest('.medication-toggle')) {
//       // Only update if it's not the toggle description
//     }

//     // Update price
//     const currentPrice = document.querySelector('.product-current-price');
//     if (currentPrice) currentPrice.textContent = data.price;

//     const originalPrice = document.querySelector('.text-decoration-line-through');
//     if (originalPrice) originalPrice.textContent = data.originalPrice;

//     // Update badge
//     const badge = document.querySelector('.popular-badge');
//     if (badge) badge.textContent = data.badge;

//     // Update features
//     featuresContainer.innerHTML = '';
//     data.features.forEach(feature => {
//       const div = document.createElement('div');
//       div.className = 'feature-item mb-3';
//       div.innerHTML = `
//         <div class="feature-icon">
//           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
//             <path d="M20.3 7.3L9 18.6L3.7 13.3" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
//           </svg>
//         </div>
//         <span class="feature-text">${feature}</span>
//       `;
//       featuresContainer.appendChild(div);
//     });
//   }

//   // =============================================
//   // NAVIGATION FUNCTIONS
//   // =============================================
//   function goTo(index) {
//     const images = getImagePaths();
//     if (index < 0) index = images.length - 1;
//     if (index >= images.length) index = 0;

//     mainImg.classList.add("fade-out");

//     setTimeout(function () {
//       currentIndex = index;
//       mainImg.src = images[currentIndex];

//       // Update dots
//       const dots = document.querySelectorAll("#dotContainer .dot-indicator");
//       dots.forEach(function (d, i) {
//         d.classList.toggle("active", i === currentIndex);
//       });

//       // Update thumbnails
//       const thumbs = document.querySelectorAll(".thumb-box");
//       thumbs.forEach(function (tb, i) {
//         tb.classList.toggle("active", i === currentIndex);
//       });

//       mainImg.classList.remove("fade-out");
//       mainImg.classList.add("fade-in");

//       setTimeout(function () {
//         mainImg.classList.remove("fade-in");
//       }, 400);
//     }, 200);
//   }

//   function switchMedication(medication) {
//     if (medication === currentMedication) return;

//     currentMedication = medication;
//     currentIndex = 0;

//     const data = getCurrentData();
//     const images = data.images;

//     // Update main image
//     mainImg.src = images[0];

//     // Regenerate thumbnails
//     generateThumbnails(images);

//     // Regenerate dots
//     generateDots(images.length);

//     // Update details
//     updateDetails();

//     // Reset active states
//     const thumbs = document.querySelectorAll(".thumb-box");
//     thumbs.forEach((tb, i) => {
//       tb.classList.toggle("active", i === 0);
//     });

//     const dots = document.querySelectorAll("#dotContainer .dot-indicator");
//     dots.forEach((d, i) => {
//       d.classList.toggle("active", i === 0);
//     });
//   }

//   // =============================================
//   // EVENT LISTENERS
//   // =============================================

//   // Navigation buttons
//   prevBtn.addEventListener("click", function () {
//     goTo(currentIndex - 1);
//   });

//   nextBtn.addEventListener("click", function () {
//     goTo(currentIndex + 1);
//   });

//   // Medication toggle buttons
//   medicationButtons.forEach(function (button) {
//     button.addEventListener("click", function () {
//       medicationButtons.forEach(function (btn) {
//         btn.classList.remove("active-medication");
//         btn.classList.remove("text-white");
//         btn.classList.add("text-success");
//         btn.style.backgroundColor = 'transparent';
//       });

//       this.classList.add("active-medication");
//       this.classList.remove("text-success");
//       this.classList.add("text-white");
//       this.style.backgroundColor = '';

//       const medication = this.getAttribute('data-medication') || 
//                         this.textContent.trim().toLowerCase();

//       if (medication === 'semaglutide' || medication === 'tirzepatide') {
//         switchMedication(medication);
//       }
//     });
//   });

//   // =============================================
//   // INITIALIZE
//   // =============================================
//   function init() {
//     const data = getCurrentData();
//     const images = data.images;

//     // Set initial main image
//     mainImg.src = images[0];

//     // Generate thumbnails
//     generateThumbnails(images);

//     // Generate dots
//     generateDots(images.length);

//     // Update details
//     updateDetails();
//   }

//   init();

// })();

//       // =============================================
//       // WOW.js Init
//       // =============================================
//     //   new WOW({
//     //     boxClass: "wow",
//     //     animateClass: "animate__animated",
//     //     offset: 80, // px from bottom of viewport before animation fires
//     //     mobile: true, // animate on mobile too
//     //     live: true,
//     //   }).init();

//       // =============================================
//       // Swiper Init
//       // =============================================
//       const okSwiper = new Swiper(".ok--section.swiper", {
//         slidesPerView: "auto",
//         spaceBetween: 20,
//         autoplay: {
//           delay: 5000,
//         },
//         direction: 'horizontal',
//         loop: true,
//         freeMode: false,
//         grabCursor: true,
//         mousewheel: false,
//         centeredSlides: false,
//       });

//       const brandSwiper = new Swiper(".brand--grid--hero.swiper", {
//         slidesPerView: "auto",
//         spaceBetween: 20,
//         freeMode: false,
//         autoplay: {
//           delay: 5000,
//         },
//         direction: 'horizontal',
//         loop: true,
//         grabCursor: true,
//         mousewheel: false,
//         centeredSlides: false,
//       });

//       const transformSwiper = new Swiper(".transformSwiper.swiper", {
//         slidesPerView: "auto",
//         autoplay: {
//           delay: 5000,
//         },
//         direction: 'horizontal',
//         loop: true,
//         spaceBetween: 24,
//         freeMode: false,
//         grabCursor: true,
//       });

// // =============================================
// // PRODUCT GALLERY - With Medication Toggle
// // =============================================
// (function () {
//   // Product data for both medications
//   const productData = {
//     semaglutide: {
//       mainImages: [
//         "/assets/wl/semag.png",
//         "/assets/wl/product2.png",
//         "/assets/wl/product3.png",
//         "/assets/wl/product4.png",
//         "/assets/wl/product5.png"
//       ],
//       thumbImages: [
//         "/assets/wl/thumb.svg",
//         "/assets/wl/thumb-1.png",
//         "/assets/wl/thumb.svg",
//         "/assets/wl/thumb.svg",
//         "/assets/wl/thumb.svg"
//       ]
//     },
//     tirzepatide: {
//       mainImages: [
//         "/assets/wl/tirz.png",
//         "/assets/wl/tirz2.png",
//         "/assets/wl/tirz3.png",
//         "/assets/wl/tirz4.png",
//         "/assets/wl/tirz5.png"
//       ],
//       thumbImages: [
//         "/assets/wl/thumb.svg",
//         "/assets/wl/thumb-1.png",
//         "/assets/wl/thumb.svg",
//         "/assets/wl/thumb.svg",
//         "/assets/wl/thumb.svg"
//       ]
//     }
//   };

//   let currentMedication = 'semaglutide';
//   let currentIndex = 0;

//   const mainImg = document.getElementById("mainProductImage");
//   const prevBtn = document.getElementById("prevBtn");
//   const nextBtn = document.getElementById("nextBtn");
//   const dots = document.querySelectorAll("#dotContainer .dot-indicator");
//   const thumbBoxes = document.querySelectorAll(".thumb-box");
//   const medicationButtons = document.querySelectorAll('.medication-toggle .btn');

//   function getCurrentData() {
//     return productData[currentMedication];
//   }

//   function goTo(index) {
//     const data = getCurrentData();
//     if (index < 0) index = data.mainImages.length - 1;
//     if (index >= data.mainImages.length) index = 0;

//     mainImg.classList.add("fade-out");

//     setTimeout(function () {
//       currentIndex = index;
//       mainImg.src = data.mainImages[currentIndex];

//       dots.forEach(function (d, i) {
//         d.classList.toggle("active", i === currentIndex);
//       });

//       thumbBoxes.forEach(function (tb, i) {
//         tb.classList.toggle("active", i === currentIndex);
//         const thumbImg = tb.querySelector("img");
//         if (thumbImg && data.thumbImages[i]) {
//           thumbImg.src = data.thumbImages[i];
//         }
//       });

//       mainImg.classList.remove("fade-out");
//       mainImg.classList.add("fade-in");

//       setTimeout(function () {
//         mainImg.classList.remove("fade-in");
//       }, 400);
//     }, 200);
//   }

//   function switchMedication(medication) {
//     if (medication === currentMedication) return;

//     currentMedication = medication;
//     currentIndex = 0;

//     const data = getCurrentData();

//     mainImg.src = data.mainImages[0];

//     thumbBoxes.forEach(function (tb, i) {
//       tb.classList.toggle("active", i === 0);
//       const thumbImg = tb.querySelector("img");
//       if (thumbImg && data.thumbImages[i]) {
//         thumbImg.src = data.thumbImages[i];
//       }
//     });

//     dots.forEach(function (d, i) {
//       d.classList.toggle("active", i === 0);
//     });
//   }

//   // Event Listeners
//   prevBtn.addEventListener("click", function () {
//     goTo(currentIndex - 1);
//   });

//   nextBtn.addEventListener("click", function () {
//     goTo(currentIndex + 1);
//   });

//   thumbBoxes.forEach(function (tb) {
//     tb.addEventListener("click", function () {
//       var idx = parseInt(tb.getAttribute("data-index"), 10);
//       goTo(idx);
//     });
//   });

//   dots.forEach(function (dot, i) {
//     dot.addEventListener("click", function () {
//       goTo(i);
//     });
//   });

//   // Medication toggle
//   medicationButtons.forEach(function (button) {
//     button.addEventListener("click", function () {
//       medicationButtons.forEach(function (btn) {
//         btn.classList.remove("active-medication");
//       });
//       button.classList.add("active-medication");

//       const medication = button.textContent.trim().toLowerCase();
//       if (medication === 'semaglutide' || medication === 'tirzepatide') {
//         switchMedication(medication);
//       }
//     });
//   });

//   // Initialize with Semaglutide
//   switchMedication('semaglutide');
// })();
//     var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
//     (function(){
//     var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
//     s1.async=true;
//     s1.src='https://embed.tawk.to/6a454f1fb271bd1d477e9990/1jsfbq5mb';
//     s1.charset='UTF-8';
//     s1.setAttribute('crossorigin','*');
//     s0.parentNode.insertBefore(s1,s0);
// })();