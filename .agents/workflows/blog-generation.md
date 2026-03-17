---
description: How to generate a new daily blog article
---
# Daily Blog Generation Process

1. **Understand the Topic**: Read the prompt or outline for the daily blog piece.
2. **Generate Unique Image**: DO NOT REUSE existing hero images from the `assets/` folder. Instead, use the `generate_image` tool to create a highly specific, unique, and premium aesthetic image that directly relates to the blog post content. 
   - Move the generated image into the `assets/` folder locally.
3. **Write the Content**: Write a comprehensive, SEO-optimized blog post inside the `content/blog/` directory formatted as a markdown file.
   - Mimic the depth of competitors, with well-written prose, bullet points, and an HTML FAQ block at the bottom using `<details>` and `<summary>` tags.
4. **Frontmatter**: Include proper YAML frontmatter in the `.md` file, pointing the `image:` attribute to the newly generated and copied image path (e.g., `assets/blog_hero_name.png`).
5. **Build & Publish**: 
   - Run `node build_blog.js`
   - Test locally if necessary.
   - Commit and push to main.
