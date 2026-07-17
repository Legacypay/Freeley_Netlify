// ============================================================
// PRODUCT DATA
// ============================================================

const PRODUCTS = {
  'weight loss': {
    id: 'weight-loss',
    group: 1,
    title: 'GLP-1 Weight Loss Program',
    image: '/assets/quiz/weight-lose.png',
    price: '$194.00',
    duration: 'Month',
    description: 'Semaglutide + B12 compounded',
    benefits: [
      'Physician-supervised titration',
      'Free monthly check-ins',
      'Nutrition coaching included',
      'Discreet doorstep delivery'
    ],
    testimonial: {
      text: '"Lost 22 lbs in 3 months. The physician check-ins kept me accountable and the injections were easier than I expected."',
      author: 'Sarah M., verified patient - Lost 22 lbs'
    },
    approvalNote: false
  },

  'sexual wellness': {
    id: 'sexual-wellness',
    group: 1,
    title: '3-in-1 ED Troche',
    image: '/assets/quiz/sexual-welness.png',
    price: '$89.00',
    duration: 'Month',
    description: '',
    benefits: [
      'Dissolves under the tongue (Sublingual)',
      'Sildenafil + Tadalafil + Apomorphine',
      'Physician consultation & fast shipping included'
    ],
    testimonial: {
      text: '"Lost 22 lbs in 3 months. The physician check-ins kept me accountable and the injections were easier than I expected."',
      author: 'Sarah M., verified patient - Lost 22 lbs'
    },
    approvalNote: false
  },

  'hair loss': {
    id: 'hair-loss',
    group: 2,
    title: 'Hair Restoration Protocol',
    image: '/assets/quiz/hair-lose.png',
    price: '$29.00',
    duration: 'Month',
    description: 'Finasteride, Minoxidil, or Dutasteride — prescribed based on your pattern and stage. DHT-blocking compounds stop loss and stimulate regrowth.',
    benefits: [],
    testimonial: {
      text: '"Noticed visible regrowth in 8 weeks. My hair feels thicker and healthier."',
      author: 'James K., verified patient'
    },
    approvalNote: false
  },

  'longevity & performance': {
    id: 'longevity',
    group: 2,
    title: 'Longevity & Performance Plan',
    image: '/assets/quiz/longevity.png',
    price: '$99.00',
    duration: 'Month',
    description: 'Sermorelin + NAD+ peptide protocol for cellular repair and energy optimization. Custom-formulated for your activity and goals.',
    benefits: [],
    testimonial: {
      text: '"More energy, better focus, and I feel years younger. This has been life-changing."',
      author: 'Lisa T., verified patient'
    },
    approvalNote: false
  }
};

const DEFAULT_PRODUCT = PRODUCTS['weight loss'];

// ============================================================
// MULTI-SELECT VARIABLES
// ============================================================

let isTransitioning = false;
let selectedProducts = [];

// ============================================================
// GROUP-SPECIFIC RENDER FUNCTIONS
// ============================================================

function renderGroupSpecificContent(product) {
  if (!product) return;

  if (product.group === 1) {
    renderGroup1Content(product);
  } else if (product.group === 2) {
    renderGroup2Content(product);
  } else {
    renderGroup1Content(product);
  }
}

function renderGroup1Content(product) {
  const actionContainer = document.getElementById('actionContainer');
  const testimonialContainer = document.getElementById('testimonialContainer');

  if (!actionContainer || !testimonialContainer) return;

  actionContainer.innerHTML = getGroup1ActionHTML(product);
  testimonialContainer.innerHTML = getGroup1TestimonialHTML(product);
}

function renderGroup2Content(product) {
  const actionContainer = document.getElementById('actionContainer');
  const testimonialContainer = document.getElementById('testimonialContainer');

  if (!actionContainer || !testimonialContainer) return;

  actionContainer.innerHTML = getGroup2ActionHTML(product);
  testimonialContainer.innerHTML = getGroup2TestimonialHTML(product);
}

function getGroup1ActionHTML(product) {
  // Check if approvalNote is true - only show approval note, no button
  if (product && product.approvalNote === true) {
    return `
      <div class="approval-note mt-3">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8.0026 14.6693C11.6693 14.6693 14.6693 11.6693 14.6693 8.0026C14.6693 4.33594 11.6693 1.33594 8.0026 1.33594C4.33594 1.33594 1.33594 4.33594 1.33594 8.0026C1.33594 11.6693 4.33594 14.6693 8.0026 14.6693Z" stroke="#A57C00" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 5.33594V8.66927" stroke="#A57C00" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M7.99609 10.6641H8.00208" stroke="#A57C00" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Prescription subject to physician approval.
      </div>
    `;
  }

  // approvalNote is false - show button only
  return `
    <a href="javascript:void(0);" class="cta--global my-3 bg--green text-center d-none">
      <span>Start your Assessment</span> &nbsp; &nbsp; 
      <span class="arrow--right">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10.8242 4.44922L15.3767 9.00172L10.8242 13.5542" stroke="#FAF8F4" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M2.625 9H15.2475" stroke="#FAF8F4" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      </span>
    </a>
  `;
}

function getGroup1TestimonialHTML(product) {
  if (!product || !product.testimonial) return '';
  return `
    <div class="testimonial-box">
      <p>${product.testimonial.text}</p>
      <span>${product.testimonial.author}</span>
    </div>
  `;
}

function getGroup2ActionHTML(product) {
  // Check if approvalNote is true - only show approval note, no button
  if (product && product.approvalNote === true) {
    return `
      <div class="approval-note mt-3">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8.0026 14.6693C11.6693 14.6693 14.6693 11.6693 14.6693 8.0026C14.6693 4.33594 11.6693 1.33594 8.0026 1.33594C4.33594 1.33594 1.33594 4.33594 1.33594 8.0026C1.33594 11.6693 4.33594 14.6693 8.0026 14.6693Z" stroke="#A57C00" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 5.33594V8.66927" stroke="#A57C00" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M7.99609 10.6641H8.00208" stroke="#A57C00" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Prescription subject to physician approval.
      </div>
    `;
  }

  // approvalNote is false - show button only
  return `
    <a href="javascript:void(0);" class="cta--global my-3 bg--green text-center d-none">
      <span>Start your Assessment</span> &nbsp; &nbsp; 
      <span class="arrow--right">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10.8242 4.44922L15.3767 9.00172L10.8242 13.5542" stroke="#FAF8F4" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M2.625 9H15.2475" stroke="#FAF8F4" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      </span>
    </a>
  `;
}

function getGroup2TestimonialHTML(product) {
  let reasons = [];
  let title = 'Why this was chosen for you';

  if (product.id === 'hair-loss') {
    reasons = [
      'You indicated hair loss as a concern',
      'DHT blockers prevent further loss while stimulating new follicle growth',
      'Early intervention maximizes regrowth potential.'
    ];
  } else if (product.id === 'longevity') {
    reasons = [
      'You selected longevity and performance optimization',
      'Peptide protocols support recovery, immune function, and biological age reversal'
    ];
  } else {
    reasons = [
      'Your responses indicated this treatment is right for you',
      'Clinically-proven ingredients for optimal results',
      'Personalized to your specific health goals'
    ];
  }

  let colClass = 'col-md-4';
  if (reasons.length === 1) colClass = 'col-md-12';
  else if (reasons.length === 2) colClass = 'col-md-6';

  return `
    <div class="row g-3 m-0">
      <p class="text-14-inter col-md-12 mb-0"><em>${title}</em></p>
      ${reasons.map(reason => `
        <div class="${colClass} mt-0">
          <div class="testimonial-box">
            <div class="small">${reason}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================
// MULTI-SELECT PRODUCT FUNCTIONS
// ============================================================

function validateMultiSelectAndGo(currentStep, nextStep) {
  const stepElement = document.querySelector(`.quiz-step[data-step="${currentStep}"]`);
  if (!stepElement) return;

  const optionsContainer = stepElement.querySelector('.options[data-required="true"]');
  if (optionsContainer) {
    const selected = optionsContainer.querySelectorAll('.option--item.active');
    const errorMsg = optionsContainer.closest('.step-body')?.querySelector('.error-message');

    if (selected.length === 0) {
      if (errorMsg) {
        errorMsg.classList.add('show');
        optionsContainer.querySelectorAll('.option--item').forEach(opt => {
          opt.classList.add('required-error');
          setTimeout(() => opt.classList.remove('required-error'), 1500);
        });
      }
      return;
    } else {
      if (errorMsg) errorMsg.classList.remove('show');

      // Store all selected products
      selectedProducts = [];
      selected.forEach(opt => {
        const productKey = opt.dataset.product || opt.querySelector('.option--title')?.textContent.trim().toLowerCase();
        if (productKey && PRODUCTS[productKey]) {
          selectedProducts.push(productKey);
        }
      });

      // Store in session
      sessionStorage.setItem('selected_products', JSON.stringify(selectedProducts));

      // For backward compatibility, also store first as primary
      if (selectedProducts.length > 0) {
        sessionStorage.setItem('selected_product', selectedProducts[0]);
      }
    }
  }

  goToStep(nextStep);
}

function getSelectedProducts() {
  // Try to get from session storage first
  const savedProducts = sessionStorage.getItem('selected_products');
  if (savedProducts) {
    try {
      const parsed = JSON.parse(savedProducts);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) { }
  }

  // Fallback to selectedProducts array
  if (selectedProducts.length > 0) {
    return selectedProducts;
  }

  // Final fallback - check if we have a single product
  const singleProduct = sessionStorage.getItem('selected_product');
  if (singleProduct && PRODUCTS[singleProduct]) {
    return [singleProduct];
  }

  return ['weight loss'];
}

function getSelectedProduct() {
  const products = getSelectedProducts();
  if (products.length > 0 && PRODUCTS[products[0]]) {
    return PRODUCTS[products[0]];
  }
  return DEFAULT_PRODUCT;
}

function getAllSelectedProducts() {
  const productKeys = getSelectedProducts();
  return productKeys.map(key => PRODUCTS[key]).filter(p => p);
}

// ============================================================
// PRODUCT RENDERING
// ============================================================

function renderSelectedProduct() {
  const products = getAllSelectedProducts();
  const resultStep = document.querySelector('.quiz-step[data-step="13"]');
  if (!resultStep || products.length === 0) return;

  const treatmentCard = resultStep.querySelector('.treatment-card');
  if (!treatmentCard) return;

  // Clear existing content but keep the structure
  const cardBody = treatmentCard.querySelector('.row.align-items-center.m-0.g-4');
  if (!cardBody) return;

  // If single product, render normally
  if (products.length === 1) {
    renderSingleProductCard(resultStep, products[0]);
    return;
  }

  // For multiple products, render multiple cards
  renderMultipleProductCards(resultStep, products);
}

function renderSingleProductCard(resultStep, product) {
  const treatmentCard = resultStep.querySelector('.treatment-card');
  const cardBody = treatmentCard.querySelector('.row.align-items-center.m-0.g-4');

  // Update product image
  const productImage = cardBody.querySelector('.product-image-box img');
  if (productImage) {
    productImage.src = product.image || '/assets/quiz/default.png';
    productImage.alt = product.title || 'Product';
  }

  // Update recommended tag
  const tag = cardBody.querySelector('.recommended-tag');
  if (tag) tag.textContent = 'Recommended Plan';

  // Update title
  const title = cardBody.querySelector('.product-title');
  if (title) title.textContent = product.title || 'Treatment Plan';

  // Update description
  const description = cardBody.querySelector('.text-14-inter.mb-2.text-black');
  if (description) description.textContent = product.description || '';

  // Update price
  const price = cardBody.querySelector('.price');
  if (price) price.textContent = product.price || '$299.00';

  const duration = cardBody.querySelector('.month');
  if (duration) duration.textContent = product.duration || '3 Months';

  // Update benefits
  const benefitsContainer = cardBody.querySelector('.processing-list');
  if (benefitsContainer && product.benefits) {
    benefitsContainer.innerHTML = product.benefits.map(benefit => `
      <div class="processing-item">
        <span class="icon-check"></span>
        <span>${benefit}</span>
      </div>
    `).join('');
  }

  // Update group styling
  treatmentCard.classList.remove('group-1', 'group-2');
  treatmentCard.classList.add(product.group === 1 ? 'group-1' : 'group-2');

  // Render group specific content (testimonial + action)
  renderGroupSpecificContent(product);

  // Update order summary
  const summaryTreatment = document.getElementById('summary-treatment');
  if (summaryTreatment) summaryTreatment.textContent = product.title || 'Treatment Plan';

  const summaryPrice = document.getElementById('summary-total-price');
  if (summaryPrice) summaryPrice.textContent = product.price || '$299.00';

  sessionStorage.setItem('selected_product', product.id);
}

function renderMultipleProductCards(resultStep, products) {
  const treatmentCard = resultStep.querySelector('.treatment-card');
  const cardBody = treatmentCard.querySelector('.row.align-items-center.m-0.g-4');

  // Clear the card body
  cardBody.innerHTML = '';

  // Render each product as a separate card with the same layout
  products.forEach((product, index) => {
    const productCard = createProductCard(product, index, products.length);
    cardBody.appendChild(productCard);
  });

  // Render testimonials for the first product (or first product with testimonial)
  const productWithTestimonial = products.find(p => p.testimonial) || products[0];
  renderGroupSpecificContent(productWithTestimonial);

  // Update order summary with total
  let totalPrice = 0;
  products.forEach(p => {
    const priceNum = parseFloat(p.price.replace(/[$,]/g, ''));
    if (!isNaN(priceNum)) totalPrice += priceNum;
  });

  const summaryTreatment = document.getElementById('summary-treatment');
  if (summaryTreatment) summaryTreatment.textContent = `${products.length} Treatments Bundle`;

  const summaryPrice = document.getElementById('summary-total-price');
  if (summaryPrice) summaryPrice.textContent = `$${totalPrice.toFixed(2)}`;
}

function createProductCard(product, index, total) {
  const card = document.createElement('div');
  card.className = 'row align-items-center m-0 g-3 product-card-item px-0';

  // Check if product has approvalNote true
  const hasApprovalNote = product.approvalNote === true;

  card.innerHTML = `
    <div class="col-lg-6 m-0 px-0">
      <div class="product-image-box">
        <span class="recommended-tag">${index === 0 ? 'Recommended Plan' : 'Additional Plan'}</span>
        <img src="${product.image || '/assets/quiz/default.png'}" alt="${product.title}" class="img-fluid" />
      </div>
    </div>
    <div class="col-md-6 m-0 d-flex flex-column justify-content-start justify-content-md-center px-0 ps-2 ps-md-3 pt-3 pt-md-0">
      <h3 class="product-title mb-4 text-start">${product.title || 'Treatment Plan'}</h3>
      <div class="text-14-inter mb-2 text-black">${product.description || ''}</div>
      <div class="price-row">
        <span class="price">${product.price || '$299.00'}</span>
        <span class="month">${product.duration || 'Month'}</span>
      </div>
      <div class="processing-list">
        ${product.benefits && product.benefits.length > 0 ?
      product.benefits.map(benefit => `
            <div class="processing-item">
              <span class="icon-check"></span>
              <span>${benefit}</span>
            </div>
          `).join('') :
      '<div class="processing-item"><span>Includes physician-supervised care</span></div>'
    }
      </div>
      ${hasApprovalNote ? `
        <div class="approval-note mt-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8.0026 14.6693C11.6693 14.6693 14.6693 11.6693 14.6693 8.0026C14.6693 4.33594 11.6693 1.33594 8.0026 1.33594C4.33594 1.33594 1.33594 4.33594 1.33594 8.0026C1.33594 11.6693 4.33594 14.6693 8.0026 14.6693Z" stroke="#A57C00" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 5.33594V8.66927" stroke="#A57C00" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7.99609 10.6641H8.00208" stroke="#A57C00" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Prescription subject to physician approval.
        </div>
      ` : `
        <a href="javascript:void(0);" class="cta--global my-3 bg--green text-center d-none">
          <span>Start your Assessment</span> &nbsp; 
          <span class="arrow--right">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.8242 4.44922L15.3767 9.00172L10.8242 13.5542" stroke="#FAF8F4" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path>
              <path d="M2.625 9H15.2475" stroke="#FAF8F4" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </span>
        </a>
      `}
    </div>
  `;

  return card;
}

// ============================================================
// NAVIGATION FUNCTIONS
// ============================================================

function goToStep(stepNumber) {
  if (isTransitioning) return;

  const currentActive = document.querySelector('.quiz-step.active');
  const targetStep = document.querySelector(`.quiz-step[data-step="${stepNumber}"]`);

  if (!targetStep) return;
  if (currentActive === targetStep) return;

  isTransitioning = true;

  if (currentActive) {
    currentActive.classList.add('slide-out');
    setTimeout(() => {
      currentActive.classList.remove('active', 'slide-out');
    }, 300);
  }

  setTimeout(() => {
    targetStep.classList.add('active');
    targetStep.style.animation = 'none';
    targetStep.offsetHeight;
    targetStep.style.animation = '';

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (stepNumber === 12) {
      setTimeout(() => {
        document.querySelectorAll('.quiz-step').forEach(step => {
          step.classList.remove('active', 'slide-out');
        });
        const resultStep = document.querySelector('.quiz-step[data-step="13"]');
        if (resultStep) {
          resultStep.classList.add('active');
          resultStep.style.animation = 'none';
          resultStep.offsetHeight;
          resultStep.style.animation = '';
          window.scrollTo({ top: 0, behavior: 'smooth' });
          renderSelectedProduct();
        }
        isTransitioning = false;
      }, 2500);
    } else {
      setTimeout(() => {
        isTransitioning = false;
      }, 400);
    }
  }, 150);
}

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

function validateSelectionAndGo(currentStep, nextStep) {
  const stepElement = document.querySelector(`.quiz-step[data-step="${currentStep}"]`);
  if (!stepElement) return;

  let isValid = true;

  const optionsContainer = stepElement.querySelector('.options[data-required="true"]');
  if (optionsContainer) {
    const selected = optionsContainer.querySelectorAll('.option--item.active');
    const errorMsg = optionsContainer.closest('.step-body')?.querySelector('.error-message');

    if (selected.length === 0) {
      isValid = false;
      if (errorMsg) {
        errorMsg.classList.add('show');
        optionsContainer.querySelectorAll('.option--item').forEach(opt => {
          opt.classList.add('required-error');
          setTimeout(() => opt.classList.remove('required-error'), 1500);
        });
      }
    } else {
      if (errorMsg) errorMsg.classList.remove('show');
    }
  }

  if (isValid) {
    goToStep(nextStep);
  }
}

function validateStep2AndGo() {
  const email = document.getElementById('email');
  const phone = document.getElementById('phoneInput');
  const consent = document.getElementById('consent-check-step2');
  const error = document.getElementById('step2Error');

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
  const phoneOk = phone.value.replace(/\D/g, '').length >= 10;

  if (!emailOk || !phoneOk || !consent.checked) {
    error.classList.add('show');
    if (!emailOk) email.classList.add('validation-error');
    if (!phoneOk) phone.classList.add('validation-error');
    return;
  }
  error.classList.remove('show');
  email.classList.remove('validation-error');
  phone.classList.remove('validation-error');
  goToStep(3);
}

function validateStep3AndGo() {
  const ageInput = document.getElementById('ageInput');
  const heightFeet = document.getElementById('heightFeet');
  const heightInches = document.getElementById('heightInches');
  const weightInput = document.getElementById('goalWeightInput');
  const stateSelect = document.getElementById('stateSelect');
  const sexOptions = document.getElementById('sexOptions');
  const sexSelected = sexOptions.querySelector('.option--item.active');

  let valid = true;

  const ageVal = parseInt(ageInput.value);
  const ageError = document.getElementById('ageError');
  if (!ageInput.value.trim() || isNaN(ageVal) || ageVal < 18 || ageVal > 100) {
    ageInput.classList.add('validation-error');
    ageError.classList.add('show');
    valid = false;
  } else {
    ageInput.classList.remove('validation-error');
    ageError.classList.remove('show');
  }

  const sexError = document.getElementById('sexError');
  if (!sexSelected) {
    sexError.classList.add('show');
    sexOptions.querySelectorAll('.option--item').forEach(opt => {
      opt.classList.add('required-error');
      setTimeout(() => opt.classList.remove('required-error'), 1500);
    });
    valid = false;
  } else {
    sexError.classList.remove('show');
  }

  const feetVal = parseInt(heightFeet.value);
  const inchesVal = parseInt(heightInches.value);
  const heightError = document.getElementById('heightError');

  if (!heightFeet.value.trim() || isNaN(feetVal) || feetVal < 3 || feetVal > 10) {
    heightFeet.classList.add('validation-error');
    heightError.classList.add('show');
    valid = false;
  } else if (!heightInches.value.trim() || isNaN(inchesVal) || inchesVal < 0 || inchesVal > 11) {
    heightInches.classList.add('validation-error');
    heightError.classList.add('show');
    valid = false;
  } else {
    heightFeet.classList.remove('validation-error');
    heightInches.classList.remove('validation-error');
    heightError.classList.remove('show');
    const totalInches = (feetVal * 12) + inchesVal;
    document.getElementById('heightFeet').dataset.totalInches = totalInches;
  }

  const weightVal = parseInt(weightInput.value);
  const weightError = document.getElementById('goalWeightError');
  if (!weightInput.value.trim() || isNaN(weightVal) || weightVal < 80 || weightVal > 800) {
    weightInput.classList.add('validation-error');
    weightError.classList.add('show');
    valid = false;
  } else {
    weightInput.classList.remove('validation-error');
    weightError.classList.remove('show');
  }

  const stateError = document.getElementById('stateError');
  if (!stateSelect.value) {
    stateSelect.style.borderColor = '#dc3545';
    stateError.classList.add('show');
    valid = false;
  } else {
    stateSelect.style.borderColor = '';
    stateError.classList.remove('show');
  }

  if (valid) {
    document.getElementById('step3Error').classList.remove('show');
    goToStep(4);
  } else {
    document.getElementById('step3Error').classList.add('show');
  }
}

// ============================================================
// CHECKOUT FUNCTIONS - CORRECTED
// ============================================================

function collectCheckoutProductData() {
  const products = getAllSelectedProducts();

  if (products.length === 0) {
    return {
      treatmentType: 'weight-loss',
      name: 'Weight Loss Program',
      desc: 'Physician-supervised GLP-1 treatment',
      image: '/assets/quiz/weight-lose.png',
      monthlyPrice: 194,
      planMonths: 3,
      totalPrice: 582,
      planName: 'Weight Loss Program',
      isBundle: false,
      allProducts: []
    };
  }

  // If multiple products, create a bundle
  if (products.length > 1) {
    // Calculate total price
    let totalPrice = 0;
    let productNames = [];
    let productImages = [];
    let productDescriptions = [];
    let allProductData = [];

    products.forEach(p => {
      const priceNum = parseFloat(p.price.replace(/[$,]/g, ''));
      if (!isNaN(priceNum)) totalPrice += priceNum;
      productNames.push(p.title);
      productImages.push(p.image);
      productDescriptions.push(p.description || 'Compounded medication');
      allProductData.push({
        id: p.id,
        title: p.title,
        price: p.price,
        image: p.image,
        description: p.description,
        benefits: p.benefits || []
      });
    });

    // Use the first product's treatment type as primary
    const primaryProduct = products[0];
    const treatmentTypeMap = {
      'weight-loss': 'weight-loss',
      'sexual-wellness': 'sexual-wellness',
      'hair-loss': 'hair-loss',
      'longevity': 'longevity'
    };

    return {
      treatmentType: treatmentTypeMap[primaryProduct.id] || 'weight-loss',
      name: `${products.length} Treatments Bundle`,
      desc: productDescriptions.join(' | '),
      image: productImages[0], // Use first product image as primary
      monthlyPrice: totalPrice / 3, // Average monthly price
      planMonths: 3,
      totalPrice: totalPrice.toFixed(2),
      planName: `${products.length} Treatment Bundle`,
      isBundle: true,
      allProducts: allProductData,
      productNames: productNames
    };
  }

  // Single product (existing logic)
  const primaryProduct = products[0];
  const treatmentTypeMap = {
    'weight-loss': 'weight-loss',
    'sexual-wellness': 'sexual-wellness',
    'hair-loss': 'hair-loss',
    'longevity': 'longevity'
  };

  const priceNum = parseFloat(primaryProduct.price.replace(/[$,]/g, ''));
  const monthlyPrice = isNaN(priceNum) ? 99 : priceNum;
  const planMonths = 3;
  const totalPrice = monthlyPrice * planMonths;

  return {
    treatmentType: treatmentTypeMap[primaryProduct.id] || 'weight-loss',
    name: primaryProduct.title || 'Treatment Plan',
    desc: primaryProduct.description || 'Compounded medication',
    image: primaryProduct.image || '/assets/checkout/semag_transparent.png',
    monthlyPrice: monthlyPrice,
    planMonths: planMonths,
    totalPrice: totalPrice.toFixed(2),
    planName: primaryProduct.title + ' Plan',
    isBundle: false,
    allProducts: [{
      id: primaryProduct.id,
      title: primaryProduct.title,
      price: primaryProduct.price,
      image: primaryProduct.image,
      description: primaryProduct.description,
      benefits: primaryProduct.benefits || []
    }]
  };
}

// ── SAVE QUIZ DATA (global function) ──
function saveQuizData() {
  try {
    const quizData = collectAllQuizData();
    sessionStorage.setItem('freeley_quiz_data', JSON.stringify(quizData));

    const quizAnswersArray = convertToQuizAnswersArray(quizData);
    sessionStorage.setItem('quiz_answers', JSON.stringify(quizAnswersArray));

    const products = getSelectedProducts();
    if (products.length > 0) {
      sessionStorage.setItem('selected_products', JSON.stringify(products));
      sessionStorage.setItem('selected_product', products[0]);
    }

    console.log('✅ Quiz data saved');
  } catch (error) {
    console.error('Error saving quiz data:', error);
  }
}

function convertToQuizAnswersArray(quizData) {
  const mapping = [
    { key: 'primaryGoal', question: 'Primary health goals' },
    { key: 'email', question: 'Email' },
    { key: 'phone', question: 'Phone' },
    { key: 'age', question: 'Age' },
    { key: 'sex', question: 'Biological sex' },
    { key: 'height', question: 'Height' },
    { key: 'heightInInches', question: 'Height (inches)' },
    { key: 'goalWeight', question: 'Goal weight' },
    { key: 'state', question: 'Location' },
    { key: 'symptoms', question: 'Experiencing symptoms' },
    { key: 'allergies', question: 'Known Allergies' },
    { key: 'medications', question: 'Current Medications' },
    { key: 'conditions', question: 'Medical Conditions' },
    { key: 'surgeries', question: 'Past Surgeries' },
    { key: 'activityLevel', question: 'Activity level' },
    { key: 'treatmentFormat', question: 'Preferred treatment format' },
    { key: 'physicianNotes', question: 'Physician notes' },
    { key: 'selectedProducts', question: 'Selected Treatments' },
    { key: 'productGroup', question: 'Product Group' }
  ];

  const answers = [];
  mapping.forEach(item => {
    let value = quizData[item.key];
    if (Array.isArray(value)) {
      value = value.join(', ');
    }
    if (value && value !== '') {
      answers.push({
        question: item.question,
        answer: String(value)
      });
    }
  });

  return answers;
}

function collectAllQuizData() {
  const email = document.getElementById('email')?.value?.trim() || '';
  const phone = document.getElementById('phoneInput')?.value?.trim() || '';
  const age = document.getElementById('ageInput')?.value?.trim() || '';
  const sexEl = document.querySelector('#sexOptions .option--item.active');
  const sex = sexEl ? sexEl.querySelector('.option--title')?.textContent?.trim() || '' : '';

  const heightFeet = document.getElementById('heightFeet')?.value?.trim() || '';
  const heightInches = document.getElementById('heightInches')?.value?.trim() || '';
  const heightDisplay = heightFeet && heightInches ? heightFeet + "'" + heightInches + '"' : '';
  const feetVal = parseInt(heightFeet) || 0;
  const inchesVal = parseInt(heightInches) || 0;
  const heightInInches = (feetVal * 12) + inchesVal;

  const goalWeight = document.getElementById('goalWeightInput')?.value?.trim() || '';
  const state = document.getElementById('stateSelect')?.value || '';

  const allProducts = getAllSelectedProducts();
  const productNames = allProducts.map(p => p.title);

  return {
    primaryGoal: getSelectedOptionText(1),
    email: email,
    phone: phone,
    age: age,
    sex: sex,
    height: heightDisplay,
    heightInInches: heightInInches,
    goalWeight: goalWeight,
    state: state,
    symptoms: getSelectedOptionsTexts(4),
    allergies: getTextareaValueByStep(5),
    medications: getTextareaValueByStep(6),
    conditions: getTextareaValueByStep(7),
    surgeries: getTextareaValueByStep(8),
    activityLevel: getSelectedOptionText(9),
    treatmentFormat: getSelectedOptionText(10),
    physicianNotes: getTextareaValueByStep(11),
    selectedProducts: productNames,
    selectedProduct: productNames[0] || '',
    productGroup: allProducts.length > 0 ? allProducts[0].group || 1 : 1,
    completedAt: new Date().toISOString()
  };
}

function getSelectedOptionText(stepNumber) {
  const step = document.querySelector(`.quiz-step[data-step="${stepNumber}"]`);
  if (!step) return '';
  const activeOption = step.querySelector('.option--item.active');
  if (!activeOption) return '';
  const title = activeOption.querySelector('.option--title');
  return title ? title.textContent.trim() : '';
}

function getSelectedOptionsTexts(stepNumber) {
  const step = document.querySelector(`.quiz-step[data-step="${stepNumber}"]`);
  if (!step) return [];
  const activeOptions = step.querySelectorAll('.option--item.active');
  return Array.from(activeOptions).map(opt => {
    const title = opt.querySelector('.option--title');
    return title ? title.textContent.trim() : '';
  });
}

function getTextareaValueByStep(stepNumber) {
  const step = document.querySelector(`.quiz-step[data-step="${stepNumber}"]`);
  if (!step) return '';
  const textarea = step.querySelector('.text--box');
  return textarea ? textarea.value.trim() : '';
}

function populateOrderSummary() {
  const products = getAllSelectedProducts();

  if (products.length === 0) return;

  if (products.length === 1) {
    const product = products[0];
    const treatmentEl = document.getElementById('summary-treatment');
    const durationEl = document.getElementById('summary-duration');
    const priceEl = document.getElementById('summary-total-price');

    if (treatmentEl) treatmentEl.textContent = product.title || 'Treatment Plan';
    if (durationEl) durationEl.textContent = product.duration || '3 Months';
    if (priceEl) priceEl.textContent = product.price || '$299.00';
  } else {
    // Multiple products - show bundle
    let totalPrice = 0;
    const productNames = [];
    products.forEach(p => {
      const priceNum = parseFloat(p.price.replace(/[$,]/g, ''));
      if (!isNaN(priceNum)) totalPrice += priceNum;
      productNames.push(p.title);
    });

    const treatmentEl = document.getElementById('summary-treatment');
    const durationEl = document.getElementById('summary-duration');
    const priceEl = document.getElementById('summary-total-price');

    if (treatmentEl) treatmentEl.textContent = `${products.length} Treatments Bundle: ${productNames.join(' + ')}`;
    if (durationEl) durationEl.textContent = 'Bundle';
    if (priceEl) priceEl.textContent = `$${totalPrice.toFixed(2)}`;
  }
}

function processPayment() {
  const btn = document.getElementById('checkout-btn');
  const spinner = document.getElementById('checkout-spinner');
  const btnText = btn.querySelector('.btn-text');
  const errorsEl = document.getElementById('payment-errors');
  const successEl = document.getElementById('payment-success');

  if (!validateCheckoutForm()) {
    errorsEl.textContent = 'Please fill in all required fields.';
    errorsEl.classList.add('show');
    return;
  }

  btn.disabled = true;
  btnText.classList.add('hide');
  spinner.classList.add('show');
  errorsEl.classList.remove('show');
  successEl.classList.remove('show');

  setTimeout(() => {
    spinner.classList.remove('show');
    btnText.classList.remove('hide');
    btn.disabled = false;

    successEl.classList.add('show');
    successEl.innerHTML = '<i class="fas fa-check-circle"></i> Payment successful! Your order is being processed.';

    const products = getAllSelectedProducts();
    const productNames = products.map(p => p.title).join(', ');
    let totalPrice = 0;
    products.forEach(p => {
      const priceNum = parseFloat(p.price.replace(/[$,]/g, ''));
      if (!isNaN(priceNum)) totalPrice += priceNum;
    });

    const orderData = {
      transactionId: 'TXN-' + Date.now(),
      amount: `$${totalPrice.toFixed(2)}`,
      treatment: productNames,
      productIds: products.map(p => p.id),
      productGroups: products.map(p => p.group),
      timestamp: new Date().toISOString()
    };
    sessionStorage.setItem('freeley_transaction', JSON.stringify(orderData));

    setTimeout(() => {
      // ponytail: /hub.html never existed in any version of this site —
      // home is the only honest landing until a real order-confirmation
      // page ships with the payment integration.
      window.location.href = '/?payment=success&pi=' + orderData.transactionId;
    }, 3000);

  }, 2000);
}

function validateCheckoutForm() {
  const required = [
    'pt-first-name', 'pt-last-name', 'pt-email', 'pt-phone',
    'pt-address', 'pt-city', 'pt-state', 'pt-zip',
    'an-card-name', 'an-card-number', 'an-exp', 'an-cvc', 'an-zip'
  ];

  let valid = true;
  required.forEach(id => {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) {
      valid = false;
      if (el) el.style.borderColor = '#dc3545';
    } else {
      if (el) el.style.borderColor = '';
    }
  });

  const consent = document.getElementById('consent-check');
  if (!consent || !consent.checked) valid = false;

  return valid;
}

// ============================================================
// SETUP CHECKOUT - CORRECTED
// ============================================================

function setupCheckout() {
  const checkoutBtn = document.getElementById('checkout-btn');
  const consentCheck = document.getElementById('consent-check');

  if (consentCheck && checkoutBtn) {
    consentCheck.addEventListener('change', function () {
      checkoutBtn.disabled = !this.checked;
    });
  }

  // ── GO TO CHECKOUT BUTTON ──
  const goToCheckoutBtn = document.getElementById('goToCheckoutBtn');
  if (goToCheckoutBtn) {
    goToCheckoutBtn.addEventListener('click', function (e) {
      e.preventDefault();

      // Save quiz data
      saveQuizData();

      // Collect product data
      const productData = collectCheckoutProductData();

      // Store in sessionStorage
      sessionStorage.setItem('checkout_product_data', JSON.stringify(productData));

      // Store selected products
      const products = getSelectedProducts();
      sessionStorage.setItem('selected_products', JSON.stringify(products));

      // Redirect to checkout. Must be the extensionless route: the old
      // ./checkout.html only resolves on the legacy static site and in
      // astro dev's lenient routing — production serves checkout/index.html.
      window.location.href = '/checkout?treatment=' + encodeURIComponent(productData.treatmentType);
    });
  }

  // ── CHECKOUT BUTTON ──
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      processPayment();
    });
  }
}

// ============================================================
// OPTION CLICK HANDLERS
// ============================================================

document.querySelectorAll('.option--item').forEach(item => {
  item.addEventListener('click', function () {
    const parentOptions = this.closest('.options');
    if (!parentOptions) return;

    const isMultiSelect = parentOptions.dataset.multiSelect === 'true';

    if (isMultiSelect) {
      this.classList.toggle('active');
      const selected = parentOptions.querySelectorAll('.option--item.active');
      const errorMsg = parentOptions.closest('.step-body')?.querySelector('.error-message');
      if (selected.length > 0 && errorMsg) {
        errorMsg.classList.remove('show');
      }
    } else {
      parentOptions.querySelectorAll('.option--item').forEach(opt => {
        opt.classList.remove('active');
      });
      this.classList.add('active');
      const errorMsg = parentOptions.closest('.step-body')?.querySelector('.error-message');
      if (errorMsg) errorMsg.classList.remove('show');
    }
  });
});

// ============================================================
// INPUT VALIDATION
// ============================================================

document.getElementById('heightFeet')?.addEventListener('input', function () {
  this.classList.remove('validation-error');
  document.getElementById('heightError')?.classList.remove('show');
});

document.getElementById('heightInches')?.addEventListener('input', function () {
  this.classList.remove('validation-error');
  document.getElementById('heightError')?.classList.remove('show');
});

document.getElementById('stateSelect')?.addEventListener('change', function () {
  this.style.borderColor = '';
  document.getElementById('stateError')?.classList.remove('show');
});

document.querySelectorAll('.text--input input').forEach(input => {
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const step = this.closest('.quiz-step');
      if (step) {
        const nextBtn = step.querySelector('.quiz-btn-primary');
        if (nextBtn) nextBtn.click();
      }
    }
  });
  input.addEventListener('input', function () {
    this.classList.remove('validation-error');
    const errorMsgId = this.id + 'Error';
    const errorMsg = document.getElementById(errorMsgId);
    if (errorMsg) errorMsg.classList.remove('show');
  });
});

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.quiz-step').forEach(step => {
    step.classList.remove('active', 'slide-out');
  });

  const heroStep = document.querySelector('.quiz-step[data-step="0"]');
  if (heroStep) heroStep.classList.add('active');

  // ── CALL SETUP CHECKOUT ──
  setupCheckout();

  const savedProducts = sessionStorage.getItem('selected_products');
  if (savedProducts) {
    try {
      const parsed = JSON.parse(savedProducts);
      if (Array.isArray(parsed) && parsed.length > 0) {
        selectedProducts = parsed;

        const step1Options = document.querySelector('.quiz-step[data-step="1"] .options');
        if (step1Options) {
          step1Options.querySelectorAll('.option--item').forEach(opt => {
            const productKey = opt.dataset.product || opt.querySelector('.option--title')?.textContent.trim().toLowerCase();
            if (productKey && selectedProducts.includes(productKey)) {
              opt.classList.add('active');
            }
          });
        }
      }
    } catch (e) { }
  }
});