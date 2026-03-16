const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Fatal Error: Missing OPENAI_API_KEY environment variable. Make sure it is set in GitHub Secrets.');
  process.exit(1);
}

const keywordsFile = path.join(__dirname, 'content', 'seo-keywords.txt');

// Read existing keywords
let keywordsTxt = '';
try {
  if (fs.existsSync(keywordsFile)) {
    keywordsTxt = fs.readFileSync(keywordsFile, 'utf8');
  }
} catch (err) {
  console.error(`Could not read keywords file at ${keywordsFile}`);
}

const existingKeywords = keywordsTxt.split('\n').map(k => k.trim()).filter(k => k.length > 0);

// Only refill if we are running low (e.g. less than 10 keywords left)
if (existingKeywords.length >= 10) {
  console.log(`Keyword Queue has ${existingKeywords.length} items. No refill needed right now.`);
  process.exit(0);
}

console.log(`Queue is running low (${existingKeywords.length} items left). Generating 20 new high-converting SEO keywords...`);

// Ask OpenAI to generate more based on what we do
const prompt = `You are a world-class Medical SEO Strategist working for Freeley Health (a direct-to-patient telehealth platform focused on longevity, medical weight loss, GLP-1s like Compounded Semaglutide/Tirzepatide, Hair Loss, Sexual Wellness/ED, and Peptide Therapy in Florida and nationwide).

We need exactly 20 new, highly-converting, long-tail SEO keywords. 
Format requirements:
- Just the raw keywords, one per line.
- Do NOT include numbering, bullet points, or quotes.
- Make them specific questions, search queries, or intent-driven phrases patients actually search (e.g., "how to get compounded semaglutide online fast", "cost of telehealth TRT in florida", "oral minoxidil vs topical for receding hairline").
- Do NOT output any conversational text or markdown blocks, just 20 lines of raw text.

Here are our last few keywords to give you an idea of the style, please do not duplicate them:
${existingKeywords.slice(-10).join('\n')}
`;

async function run() {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8
      })
    });

    const data = await response.json();
    if (!data.choices || !data.choices[0]) {
      console.error('Error from OpenAI API:', JSON.stringify(data));
      process.exit(1);
    }

    let newKeywords = data.choices[0].message.content.trim();
    
    // Clean up if it gave markdown or numbering
    newKeywords = newKeywords.replace(/```markdown|```/g, '');
    const cleanKWs = newKeywords.split('\n')
      .map(k => k.trim().replace(/^[\d]+\.\s*/, '').replace(/^- /, '').replace(/^"|"$/g, ''))
      .filter(k => k.length > 5);

    if (cleanKWs.length === 0) {
      console.log('Failed to parse any valid keywords from LLM response.');
      process.exit(1);
    }

    // Append to file
    const newContent = (existingKeywords.length > 0 ? existingKeywords.join('\n') + '\n' : '') + cleanKWs.join('\n');
    
    // Ensure dir exists
    const dir = path.dirname(keywordsFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(keywordsFile, newContent);
    console.log(`✅ Keyword Queue Auto-Refilled with ${cleanKWs.length} fresh keywords!`);

  } catch (error) {
    console.error('Failed to run keyword refill logic:', error);
    process.exit(1);
  }
}

run();
