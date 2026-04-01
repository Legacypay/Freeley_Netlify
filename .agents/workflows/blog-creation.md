---
description: How to create new blog posts for the Freeley Health website.
---

# Freeley Blog Creation Workflow

When tasked with generating or publishing new SEO blog content for the Freeley platform, you must strictly adhere to the following rules:

## 1. Cadence (Schedule)
- We publish **one new blog post every other day**. 
- Do not batch-publish multiple posts at once unless explicitly overridden by the User. Maintain a steady drip of high-quality content.

## 2. The "No Images" Rule (Strict)
- **DO NOT** generate or inject any header or thumbnail images (`<img>` tags) into the blog cards or the blog articles themselves.
- The Freeley blog aesthetic is currently a **premium, typography-centric, image-free layout**.
- Rely instead on clean spacing, `Cormorant Garamond` for headings, and `DM Sans` for body copy.

## 3. Categorization & DOM
- When creating a new blog article, its URL slug **must** contain at least one of the major keyword triggers so the JavaScript auto-categorizer works seamlessly.
  - **Weight Loss:** `semaglutide`, `tirzepatide`, `weight`, `mounjaro`
  - **Longevity:** `peptides`, `longevity`, `semantics`
  - **Men's Health:** `ed-troche`, `finasteride`, `sildenafil`, `minoxidil`
- Add the new article to the `<div class="blog-grid">` inside `blog.html` as a plain `<a class="blog-card">` with a nested `<div class="bc-content">`. The javascript will automatically inject the `<span class="bc-category">` tag for you. Do **not** hardcode the `bc-category` tag in the HTML.

## 4. Medical Compliance
- Never make specific, guaranteed medical claims (e.g. "This will cure your ED in 10 minutes").
- Always note that prescriptions require a consultation with a licensed medical provider and are fulfilled through 503A compounding pharmacies.
