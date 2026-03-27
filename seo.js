/**
 * Freeley SEO — OpenGraph, Twitter Cards & Enhanced Schema
 * 
 * Auto-injects social sharing meta tags and structured data
 * based on the current page. Loaded site-wide via social-proof.js.
 */

(function() {
  'use strict';

  const SITE_URL = 'https://freeley.com';
  const SITE_NAME = 'Freeley';
  const DEFAULT_IMAGE = SITE_URL + '/assets/og/freeley-og.jpg';
  const TWITTER_HANDLE = '@freeleyhealth';

  // Page-specific SEO data
  const PAGE_SEO = {
    '/': {
      title: 'Freeley | Online Medical Weight Loss & Wellness',
      description: 'Board-certified physicians. Compounded GLP-1 weight loss, hair loss, ED, and longevity treatments delivered to your door. Start your free visit today.',
      image: DEFAULT_IMAGE
    },
    '/index.html': {
      title: 'Freeley | Online Medical Weight Loss & Wellness',
      description: 'Board-certified physicians. Compounded GLP-1 weight loss, hair loss, ED, and longevity treatments delivered to your door. Start your free visit today.',
      image: DEFAULT_IMAGE
    },
    '/weight-loss.html': {
      title: 'Medical Weight Loss Online — GLP-1 Treatments | Freeley',
      description: 'Clinical-grade compounded semaglutide & tirzepatide prescribed by board-certified physicians. Lose 15-20% body weight. Plans from $199/mo. Free consultation.',
      image: SITE_URL + '/assets/og/og-weight-loss.jpg',
      schema: 'MedicalTherapy',
      schemaName: 'GLP-1 Weight Loss Treatment'
    },
    '/hair-loss.html': {
      title: 'Hair Loss Treatment Online — Finasteride & Minoxidil | Freeley',
      description: 'Clinically proven hair regrowth treatments prescribed online. Oral minoxidil, finasteride, and custom compounded formulas. Results in 3-6 months.',
      image: SITE_URL + '/assets/og/og-hair-loss.jpg',
      schema: 'MedicalTherapy',
      schemaName: 'Hair Loss Treatment'
    },
    '/sexual-wellness.html': {
      title: 'ED Treatment Online — Discreet & Affordable | Freeley',
      description: 'Prescription ED treatments including tadalafil, sildenafil, and custom 3-in-1 troches. Board-certified physicians. Discreet delivery. Plans from $49/mo.',
      image: SITE_URL + '/assets/og/og-ed.jpg',
      schema: 'MedicalTherapy',
      schemaName: 'Erectile Dysfunction Treatment'
    },
    '/longevity.html': {
      title: 'Longevity & Peptide Therapy Online | Freeley',
      description: 'Physician-prescribed peptide therapy including Sermorelin, NAD+, and B12-MIC. Optimize healthspan with cutting-edge wellness treatments.',
      image: SITE_URL + '/assets/og/og-longevity.jpg',
      schema: 'MedicalTherapy',
      schemaName: 'Peptide & Longevity Therapy'
    },
    '/quiz.html': {
      title: 'Start Your Free Visit — Freeley',
      description: 'Take a 2-minute health quiz and get matched with a personalized treatment plan. Board-certified physician review included. No commitment required.',
      image: DEFAULT_IMAGE
    },
    '/pricing.html': {
      title: 'Pricing — Transparent Plans | Freeley',
      description: 'Simple, transparent pricing for all Freeley treatments. No hidden fees, cancel anytime. HSA/FSA accepted. Plans starting at $49/month.',
      image: DEFAULT_IMAGE
    },
    '/promo-weight-loss.html': {
      title: 'Medical Weight Loss — See If You Qualify | Freeley',
      description: 'Compounded GLP-1 treatments from $199/mo. Lose up to 20% body weight with physician-supervised semaglutide or tirzepatide. Start your free visit.',
      image: SITE_URL + '/assets/og/og-weight-loss.jpg'
    },
    '/promo-ed.html': {
      title: 'ED Treatment — Request Treatment Today | Freeley',
      description: 'Discreet erectile dysfunction treatment from $49/mo. Tadalafil, sildenafil, and custom troches prescribed online by board-certified physicians.',
      image: SITE_URL + '/assets/og/og-ed.jpg'
    },
    '/promo-hair-loss.html': {
      title: 'Hair Regrowth Treatment — Clinically Proven | Freeley',
      description: 'Stop hair loss and regrow with prescription finasteride, minoxidil, and custom formulas. Results in 3-6 months. Plans from $29/mo.',
      image: SITE_URL + '/assets/og/og-hair-loss.jpg'
    },
    '/promo-longevity.html': {
      title: 'Peptide Therapy — Anti-Aging & Performance | Freeley',
      description: 'Physician-prescribed peptides including Sermorelin and NAD+. Optimize recovery, energy, and healthspan with research-backed longevity protocols.',
      image: SITE_URL + '/assets/og/og-longevity.jpg'
    },
    '/about.html': {
      title: 'About Freeley — Our Mission & Team',
      description: 'Freeley is a modern telehealth platform making premium medical treatments accessible, affordable, and delivered to your door.',
      image: DEFAULT_IMAGE
    },
    '/faq.html': {
      title: 'Frequently Asked Questions | Freeley',
      description: 'Common questions about Freeley treatments, pricing, shipping, and how our telehealth platform works.',
      image: DEFAULT_IMAGE
    },
    '/blog.html': {
      title: 'Health & Wellness Blog | Freeley',
      description: 'Expert-written articles on weight loss, hair regrowth, ED treatment, peptide therapy, and telehealth. Stay informed with Freeley.',
      image: DEFAULT_IMAGE
    }
  };

  function getPageData() {
    const path = window.location.pathname;
    return PAGE_SEO[path] || {
      title: document.title || 'Freeley | Online Medical Wellness',
      description: document.querySelector('meta[name="description"]')?.content || 'Board-certified physicians prescribing weight loss, hair loss, ED, and longevity treatments online.',
      image: DEFAULT_IMAGE
    };
  }

  function injectMeta(name, content) {
    if (!content) return;
    let el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      if (name.startsWith('og:')) {
        el.setAttribute('property', name);
      } else {
        el.setAttribute('name', name);
      }
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function injectOpenGraph() {
    const data = getPageData();
    const url = window.location.href;

    // OpenGraph
    injectMeta('og:type', 'website');
    injectMeta('og:site_name', SITE_NAME);
    injectMeta('og:title', data.title);
    injectMeta('og:description', data.description);
    injectMeta('og:image', data.image);
    injectMeta('og:url', url);
    injectMeta('og:locale', 'en_US');

    // Twitter Card
    injectMeta('twitter:card', 'summary_large_image');
    injectMeta('twitter:site', TWITTER_HANDLE);
    injectMeta('twitter:title', data.title);
    injectMeta('twitter:description', data.description);
    injectMeta('twitter:image', data.image);

    // Additional SEO meta
    injectMeta('theme-color', '#1a2b22');
    injectMeta('author', 'Freeley Health');

    // Canonical URL
    if (!document.querySelector('link[rel="canonical"]')) {
      const link = document.createElement('link');
      link.rel = 'canonical';
      link.href = SITE_URL + window.location.pathname;
      document.head.appendChild(link);
    }
  }

  function injectServiceSchema() {
    const data = getPageData();
    if (!data.schema) return;

    // Only add if no existing schema for this type
    const existing = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of existing) {
      if (script.textContent.includes(data.schemaName)) return;
    }

    const schema = {
      '@context': 'https://schema.org',
      '@type': data.schema,
      'name': data.schemaName,
      'provider': {
        '@type': 'MedicalClinic',
        'name': 'Freeley Health',
        'url': SITE_URL
      },
      'description': data.description,
      'availableChannel': {
        '@type': 'ServiceChannel',
        'serviceType': 'Online',
        'serviceUrl': SITE_URL + '/quiz.html'
      }
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  // FAQ Schema auto-detection
  function injectFAQSchema() {
    const faqs = document.querySelectorAll('.faq-q');
    if (faqs.length === 0) return;

    const faqItems = [];
    faqs.forEach(q => {
      const answer = q.nextElementSibling;
      if (answer && answer.classList.contains('faq-a')) {
        faqItems.push({
          '@type': 'Question',
          'name': q.textContent.replace(/[+−]/g, '').trim(),
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': answer.textContent.trim()
          }
        });
      }
    });

    if (faqItems.length === 0) return;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': faqItems
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  function init() {
    injectOpenGraph();
    injectServiceSchema();
    injectFAQSchema();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
