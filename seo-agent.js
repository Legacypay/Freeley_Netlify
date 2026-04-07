const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Fatal Error: Missing OPENAI_API_KEY environment variable. Make sure it is set in GitHub Secrets.');
  process.exit(1);
}

// ── Main Pipeline ──────────────────────────────────────────────

const keywordsFile = path.join(__dirname, 'content', 'seo-keywords.txt');

// Read the keywords
let keywordsTxt = '';
try {
  keywordsTxt = fs.readFileSync(keywordsFile, 'utf8');
} catch (err) {
  console.error(`Could not find keywords file at ${keywordsFile}`);
  process.exit(1);
}

const keywords = keywordsTxt.split('\n').map(k => k.trim()).filter(k => k.length > 0);

if (keywords.length === 0) {
  console.log('No more keywords in the queue! Add more to content/seo-keywords.txt');
  process.exit(0);
}

// Take the first keyword
const targetKeyword = keywords[0];
console.log(`\n📝 Working on keyword: "${targetKeyword}"`);

// The remaining keywords
const remainingKeywords = keywords.slice(1).join('\n');

// The AI writes the article (no image generation)
const prompt = `You are the Chief Medical Officer at Freeley Health. Write an engaging, highly-researched, SEO-optimized medical article about "${targetKeyword}".

Use bolding, H2s, H3s, and format the output STRICTLY in Markdown.

Include YAML frontmatter at the top with EXACTLY these fields:
- "title": A compelling, SEO-friendly article title
- "tag": Choose ONE category from: Weight Loss, Hair Loss, Men's Health, Longevity, Peptides, Telehealth, Medical Education
- "excerpt": A 1-2 sentence compelling summary for search results
- "date": Today's date in ISO format (e.g. "${new Date().toISOString().split('T')[0]}T10:00:00Z")

Conclude with a call to action leading readers to our free medical assessment at freeley.com/quiz.html.

DO NOT wrap the output in markdown block ticks (\`\`\`), output pure raw text.
DO NOT include an H1 heading that duplicates the title — start with H2s.`;

async function run() {
  try {
    // ── Step 1: Generate the article text ─────────────────────
    console.log('📡 Fetching article from OpenAI GPT-4o...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (!data.choices || !data.choices[0]) {
      console.error('Error from OpenAI API:', JSON.stringify(data));
      process.exit(1);
    }

    let markdown = data.choices[0].message.content.trim();

    // Cleanup any lazy formatting from the LLM
    if (markdown.startsWith('```markdown')) {
      markdown = markdown.substring(11).trim();
    }
    if (markdown.startsWith('```')) {
      markdown = markdown.substring(3).trim();
    }
    if (markdown.endsWith('```')) {
      markdown = markdown.slice(0, -3).trim();
    }

    // Extract metadata for logging
    const titleMatch = markdown.match(/^title:\s*"?([^"\n]+)"?/m);
    const tagMatch = markdown.match(/^tag:\s*"?([^"\n]+)"?/m);
    const title = titleMatch ? titleMatch[1].trim() : targetKeyword;
    const tag = tagMatch ? tagMatch[1].trim() : 'Medical Education';
    const slug = targetKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    console.log(`📖 Title: "${title}"`);
    console.log(`🏷️  Tag: "${tag}"`);
    console.log(`🔗 Slug: "${slug}"`);

    // ── Step 2: Save the article ──────────────────────────────
    const outputPath = path.join(__dirname, 'content', 'blog', `${slug}.md`);
    const blogDir = path.dirname(outputPath);
    if (!fs.existsSync(blogDir)) {
      fs.mkdirSync(blogDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, markdown);
    console.log(`\n✅ Article saved: ${outputPath}`);

    // ── Step 3: Update the keyword queue ──────────────────────
    fs.writeFileSync(keywordsFile, remainingKeywords);
    console.log(`✅ Removed "${targetKeyword}" from queue (${keywords.length - 1} remaining)`);

    console.log('\n🎉 Done! Article generated successfully.');

  } catch (error) {
    console.error('Failed to run SEO agent:', error);
    process.exit(1);
  }
}

run();
