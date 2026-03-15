const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Fatal Error: Missing OPENAI_API_KEY environment variable. Make sure it is set in GitHub Secrets.');
  process.exit(1);
}

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
console.log(`Working on keyword: ${targetKeyword}`);

// The remaining keywords
const remainingKeywords = keywords.slice(1).join('\n');

const prompt = `You are the Chief Medical Officer at Freeley Health. Write an engaging, highly-researched, SEO-optimized medical article about "${targetKeyword}". Use bolding, H2s, H3s, and format the output STRICTLY in Markdown so it can be deployed directly to our Netlify CMS infrastructure. Include YAML frontmatter at the top with "title", "tag", "excerpt", and "date". Conclude with a call to action leading readers to our free medical assessment at freeley.com/quiz.html. DO NOT wrap the output in markdown block ticks (\`\`\`), output pure raw text.`;

async function run() {
  try {
    console.log('Fetching from OpenAI...');
    
    // Using native node fetch (available in Node 18+)
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
      if (markdown.endsWith('```')) {
        markdown = markdown.slice(0, -3).trim();
      }
    }

    // Create the clean filename slug
    const slug = targetKeyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const outputPath = path.join(__dirname, 'content', 'blog', `${slug}.md`);

    // Ensure directory exists
    const blogDir = path.dirname(outputPath);
    if (!fs.existsSync(blogDir)) {
      fs.mkdirSync(blogDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, markdown);
    console.log(`✅ SEO Article written to ${outputPath}`);

    // Update the keywords list queue
    fs.writeFileSync(keywordsFile, remainingKeywords);
    console.log(`✅ Removed "${targetKeyword}" from the queue. File updated successfully.`);

  } catch (error) {
    console.error('Failed to run SEO agent Engine:', error);
    process.exit(1);
  }
}

run();
