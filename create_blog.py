"""
Blog post creator with GPT Image 1 hero image generation.

Usage:
  OPENAI_API_KEY=sk-xxx python3 create_blog.py

Generates:
  - 4 blog HTML pages with hero images
  - Blog hub page (blog.html)
  - All images via GPT Image 1 (gpt-image-1 model)

⚠️  ONLY uses GPT Image 1 for image generation.
    No DALL-E. No Gemini. No Unsplash.
"""

import os
import json
import base64
import urllib.request

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
IMAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "blog")

BRAND_STYLE = """Photorealistic, clean, modern healthcare aesthetic. 
Soft natural lighting, warm neutral tones (cream, sage green, soft white). 
Minimalist composition with shallow depth of field. 
Premium telehealth brand feel — NOT stock photo looking. 
No text, no logos, no watermarks, no faces showing full identity. 
Shot on Canon EOS R5 with RF 85mm f/1.2L USM lens. Natural available light.
True-to-life textures, zero airbrushing. Completely indistinguishable from a real photograph."""

CATEGORY_HINTS = {
    "Weight Loss": "healthy lifestyle, measuring tape, fresh vegetables, fitness, wellness vials, glass injection pen on marble",
    "Medication Comparison": "two medication vials side by side on white marble, comparison layout, clean medical",
    "Longevity": "peptide vials, NAD+ supplements, biohacking devices, longevity science, anti-aging serum",
    "Men's Health": "men's wellness products, supplement bottles, confident male silhouette, premium health packaging",
    "Medical Education": "medical reference books, healthcare education materials, clinical setting",
}


def generate_gpt_image_1(title, tag, slug):
    """Generate a hero image using GPT Image 1 (gpt-image-1) via OpenAI API."""
    if not OPENAI_API_KEY:
        print(f"   ⚠️  No OPENAI_API_KEY — skipping image generation for {slug}")
        return None

    os.makedirs(IMAGES_DIR, exist_ok=True)

    hints = CATEGORY_HINTS.get(tag, CATEGORY_HINTS["Medical Education"])
    prompt = f'A hero image for a medical health blog article titled "{title}". Visual elements: {hints}. {BRAND_STYLE}'

    print(f"   📸 Generating GPT Image 1 hero for: {slug}")

    payload = json.dumps({
        "model": "gpt-image-1",
        "prompt": prompt,
        "n": 1,
        "size": "1536x1024",
        "quality": "high"
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        if not data.get("data") or not data["data"][0]:
            print(f"   ❌ GPT Image 1 error: {data.get('error', 'Unknown')}")
            return None

        b64 = data["data"][0].get("b64_json") or data["data"][0].get("b64")
        image_bytes = base64.b64decode(b64)

        filepath = os.path.join(IMAGES_DIR, f"{slug}.jpg")
        with open(filepath, "wb") as f:
            f.write(image_bytes)

        size_mb = len(image_bytes) / (1024 * 1024)
        print(f"   ✅ Saved: assets/blog/{slug}.jpg ({size_mb:.2f} MB) via GPT Image 1")
        return f"assets/blog/{slug}.jpg"

    except Exception as e:
        print(f"   ❌ Image generation failed: {e}")
        return None


blog_template = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — Freeley Blog</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="shared.css">
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <style>
    .blog-hero {{
      padding: 160px 0 80px;
      text-align: center;
      background-image: url("assets/brand/freeley_pattern_light.jpg");
      background-size: cover;
      background-attachment: fixed;
      background-color: var(--cream);
      border-bottom: 1px solid var(--border);
    }}
    .blog-hero h1 {{
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(38px, 5vw, 64px);
      font-weight: 400;
      color: var(--charcoal);
      margin-bottom: 24px;
      max-width: 800px;
      margin-inline: auto;
      line-height: 1.1;
    }}
    .blog-meta {{
      font-size: 14px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }}
    .blog-hero-img {{
      display: block;
      width: 100%;
      max-width: 760px;
      max-height: 420px;
      object-fit: cover;
      margin: -40px auto 0;
      border-radius: 20px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.08);
    }}
    .blog-content {{
      padding: 80px 0;
      max-width: 760px;
      margin: 0 auto;
      color: var(--charcoal);
      font-size: 18px;
      line-height: 1.8;
      font-weight: 300;
    }}
    .blog-content h2 {{
      font-family: 'Cormorant Garamond', serif;
      font-size: 36px;
      margin: 48px 0 24px;
      line-height: 1.2;
    }}
    .blog-content h3 {{
      font-weight: 600;
      font-size: 22px;
      margin: 32px 0 16px;
    }}
    .blog-cta {{
      margin-top: 60px;
      padding: 40px;
      background: var(--off-white);
      border: 1px solid var(--border);
      border-radius: 20px;
      text-align: center;
    }}
  </style>
</head>
<body>
  <section class="blog-hero">
    <div class="container reveal">
      <div class="blog-meta">{tag} · 4 min read</div>
      <h1>{title}</h1>
    </div>
  </section>
  {hero_image}
  <div class="container blog-content reveal reveal-delay-1">
    {content}
    <div class="blog-cta">
      <h3 style="margin-top:0">Ready to start your journey?</h3>
      <p style="margin-bottom:24px;">Consult directly with a licensed physician to find the right treatment path for you.</p>
      <a href="quiz.html" class="btn btn-primary" style="display:inline-block">Complete Free Assessment →</a>
    </div>
  </div>
  <script src="shared.js"></script>
  <script>initPage('');</script>
</body>
</html>
"""

hub_html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Health & Wellness Blog — Freeley</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="shared.css">
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <style>
    .hub-hero {
      padding: 160px 0 80px;
      text-align: center;
      background-image: url("assets/brand/freeley_pattern_light.jpg");
      background-size: cover;
      background-attachment: fixed;
      background-color: var(--cream);
    }
    .hub-hero h1 {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(48px, 6vw, 72px);
      font-weight: 300;
      color: var(--charcoal);
      margin-bottom: 24px;
    }
    .blog-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 40px;
      padding: 100px 0;
      max-width: 1200px;
      margin: 0 auto;
    }
    .article-card {
      display: block;
      text-decoration: none;
      color: var(--charcoal);
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 20px;
      overflow: hidden;
      transition: all 0.3s;
    }
    .article-card:hover {
      box-shadow: 0 10px 30px rgba(0,0,0,0.05);
      transform: translateY(-4px);
      border-color: rgba(61,140,94,0.3);
    }
    .article-card img {
      width: 100%;
      height: 220px;
      object-fit: cover;
    }
    .article-card-body {
      padding: 32px;
    }
    .ac-tag {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--green-light);
      font-weight: 600;
      margin-bottom: 16px;
      display: block;
    }
    .ac-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 32px;
      line-height: 1.2;
      margin-bottom: 16px;
      color: var(--charcoal);
    }
    .ac-excerpt {
      font-size: 15px;
      color: var(--text-muted);
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <section class="hub-hero">
    <div class="container reveal">
      <h1>Medical <em>Insights</em></h1>
      <p style="color:var(--text-muted); font-size:18px;">Expert guidance on weight management, longevity, and men's health.</p>
    </div>
  </section>
  <div class="container">
    <div class="blog-grid">
      {cards}
    </div>
  </div>
  <script src="shared.js"></script>
  <script>initPage('');</script>
</body>
</html>
"""

cost_content = """
<p>When searching for weight loss medication online, one of the most common questions is about the <strong>compounded semaglutide cost</strong>. With branded medications like Wegovy® and Ozempic® often facing shortages and insurance approval hurdles, compounded options have become a critical access point for patients.</p>
<h2>What is Compounded Semaglutide?</h2>
<p>Compounded semaglutide contains the same active pharmaceutical ingredient as Wegovy® and Ozempic®. It is prepared by state-licensed 503A or 503B compounding pharmacies when a drug is in shortage, allowing patients to access their prescribed therapies without interruption.</p>
<h2>Average Pricing and Hidden Fees</h2>
<p>While branded GLP-1 medications can cost upwards of $1,000 per month out-of-pocket, the <strong>cost of compounded semaglutide</strong> typically ranges from $100 to $400 depending on the provider. However, patients must be cautious of hidden fees.</p>
<ul>
  <li>Monthly subscription fees separate from the medication cost.</li>
  <li>Surge pricing where higher dosages trigger higher monthly bills.</li>
  <li>Shipping charges automatically added at checkout.</li>
</ul>
<p>At Freeley, we believe in radical transparency. Our compounded semaglutide programs feature flat-rate monthly pricing. That means your physician consultation, customized dosage plan, medication, and discreet shipping are all bundled into one straightforward cost—even as you titrate up to higher doses.</p>
"""

tirz_content = """
<p>The landscape of medical weight loss has been revolutionized by two primary medications: semaglutide and tirzepatide. For patients considering <strong>tirzepatide vs semaglutide weight loss</strong> results, understanding the underlying mechanisms of these therapies is crucial.</p>
<h2>The Mechanism: GLP-1 vs Dual Agonist</h2>
<p><strong>Semaglutide</strong> serves as a GLP-1 receptor agonist. It mimics the naturally occurring GLP-1 hormone, signaling the brain that you are full, significantly reducing appetite, and slowing gastric emptying.</p>
<p><strong>Tirzepatide</strong> takes a dual-agonist approach. It activates both GLP-1 and GIP receptors. By incorporating GIP, tirzepatide further enhances the body's ability to clear sugar from the blood and break down fat.</p>
<h2>Clinical Outcomes</h2>
<p>In clinical trials, both medications demonstrated profound efficacy. However, patients evaluating <strong>tirzepatide vs semaglutide</strong> often observe that tirzepatide yields slightly higher average weight loss percentages over a 72-week period (averaging closer to 20% total body weight reduction compared to semaglutide's 15%).</p>
<p>The best medication is the one tailored to your specific metabolic profile. Our board-certified physicians evaluate your medical history to recommend the optimal GLP-1 pathway for your body.</p>
"""

peptide_content = """
<p>As the frontier of preventative medicine expands, many patients are turning to the internet to search for "<strong>peptide therapy near me</strong>". However, modern telehealth means you no longer have to find a localized clinic to access world-class restorative treatments.</p>
<h2>What are Peptides?</h2>
<p>Peptides are short chains of amino acids that act as signaling molecules within the body. They instruct your cells to perform specific functions, ranging from hormone production to tissue repair.</p>
<h2>Key Peptide Protocols</h2>
<p><strong>Sermorelin:</strong> A growth hormone-releasing peptide that stimulates the pituitary gland to naturally produce more HGH. It is highly regarded for improving sleep architecture, restoring skin elasticity, and enhancing recovery times.</p>
<p><strong>NAD+:</strong> While technically a coenzyme rather than a peptide, NAD+ therapy is a cornerstone of longevity. It fuels cellular mitochondria, combating cognitive decline and deep fatigue.</p>
<p>By connecting with Freeley's telehealth network, you receive medical guidance from longevity experts and prescription-grade peptides delivered directly to your home—eliminating the need to search for local "peptide therapy" clinics.</p>
"""

ed_content = """
<p>Navigating the healthcare system for men's wellness can be frustrating, leading many to search for effective <strong>ED treatment without insurance</strong>. Historically, men were forced to choose between expensive out-of-pocket pharmacy bills or unreliable generic substitutes.</p>
<h2>The Telehealth Solution</h2>
<p>Telehealth has dismantled the traditional barriers to entry for men's sexual health. By operating a direct-to-patient model, platforms can connect patients with board-certified physicians online, bypassing the insurance bureaucracy entirely.</p>
<h2>Advanced Sublingual Compounds</h2>
<p>Accessing <strong>ED treatment without insurance</strong> no longer means settling for basic care. Compounding pharmacies can create customized formulations—such as a 3-in-1 ED Troche combining Sildenafil, Tadalafil, and Apomorphine.</p>
<p>These sublingual medications dissolve directly into the bloodstream under the tongue, allowing for onset in as little as 15 minutes, rather than the 60 minutes required by traditional pills. Because these are compounded specifically for you, they are offered at a simple, out-of-pocket flat rate that is often less than standard insurance copays.</p>
"""

pages = {
    "cost-of-compounded-semaglutide": {
        "title": "The True Cost of Compounded Semaglutide",
        "tag": "Weight Loss",
        "content": cost_content,
        "excerpt": "Breaking down the pricing of GLP-1 medications, avoiding hidden fees, and finding high-quality telehealth providers.",
    },
    "tirzepatide-vs-semaglutide-weight-loss": {
        "title": "Tirzepatide vs Semaglutide for Weight Loss",
        "tag": "Medication Comparison",
        "content": tirz_content,
        "excerpt": "A clinical comparison of the two most effective GLP-1 and dual-agonist medications for sustainable weight management.",
    },
    "peptide-therapy-guide": {
        "title": "A Beginner's Guide to Peptide Therapy",
        "tag": "Longevity",
        "content": peptide_content,
        "excerpt": "Exploring the science behind Sermorelin, BPC-157, and standard protocols for cellular repair and metabolic health.",
    },
    "ed-treatment-without-insurance": {
        "title": "ED Treatment Without Insurance",
        "tag": "Men's Health",
        "content": ed_content,
        "excerpt": "How modern telehealth is making fast-acting, customized ED compounds accessible without the traditional pharmacy markup.",
    },
}

# ── GENERATE PAGES ──
cards_html = ""

for slug, info in pages.items():
    title = info["title"]
    tag = info["tag"]
    content = info["content"]
    excerpt = info["excerpt"]

    # Generate hero image via GPT Image 1 if it doesn't exist
    image_path = os.path.join(IMAGES_DIR, f"{slug}.jpg")
    image_src = f"assets/blog/{slug}.jpg"

    if not os.path.exists(image_path):
        generated = generate_gpt_image_1(title, tag, slug)
        if generated:
            image_src = generated
    else:
        print(f"   ✅ Image exists: {image_src}")

    hero_image_html = f'<img src="{image_src}" alt="{title}" class="blog-hero-img">'

    # Write individual blog page
    page_html = blog_template.format(
        title=title,
        tag=tag,
        content=content,
        hero_image=hero_image_html,
    )
    with open(f"{slug}.html", "w") as f:
        f.write(page_html)

    print(f"✅ Built {slug}.html")

    # Build card for hub
    cards_html += f"""
      <a href="{slug}.html" class="article-card reveal">
        <img src="{image_src}" alt="{title}">
        <div class="article-card-body">
          <span class="ac-tag">{tag}</span>
          <h2 class="ac-title">{title}</h2>
          <p class="ac-excerpt">{excerpt}</p>
        </div>
      </a>
    """

# Write blog hub
with open("blog.html", "w") as f:
    f.write(hub_html.format(cards=cards_html))

print("✅ Built blog.html hub page")
print("\n📸 All images generated exclusively via GPT Image 1 (gpt-image-1)")
print("   No DALL-E. No Gemini. No Unsplash.")
