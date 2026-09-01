const { allow } = require('./lib/rate-limit');

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  // Unauthenticated by design (abandoned-cart capture), so cap it: 20/min/IP
  // keeps a script from flooding the CRM webhook with junk leads.
  if (!(await allow(event, { key: 'capture-lead', limit: 20, windowSec: 60 }))) {
    return { statusCode: 429, body: JSON.stringify({ error: "Too many requests" }) };
  }

  try {
    const data = JSON.parse(event.body);
    const email = data.email;
    const phone = data.phone;
    const timestamp = new Date().toISOString();

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email is required to capture lead." })
      };
    }

    // This webhook URL should be added to your Netlify dashboard under Site Settings > Environment Variables > N8N_WEBHOOK_URL
    // If you are testing locally, replace this string temporarily with your actual webhook URL.
    const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "https://your-n8n-make-zapier-webhook.url/catch";

    try {
      // Fire HTTP POST webhook to your ESP / n8n / Make.
      // We don't wait for the return value strictly; we just fire and forget using `fetch`.
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email, 
          phone: phone, 
          timestamp: timestamp, 
          source: "Freeley_Quiz_Save_Progress_Abandoned_Cart"
        })
      });
      
      // Never log raw PII — a hashed tag is enough to correlate log lines.
      const emailTag = require('crypto').createHash('sha256').update(String(email).toLowerCase()).digest('hex').slice(0, 10);
      console.log(`[LEAD CAPTURED] email#${emailTag} | Webhook Status: ${response.status}`);
    } catch (e) {
      console.error("[WEBHOOK ERROR] Unable to reach n8n / Make endpoint:", e.message);
    }

    // Always return a fast 200 OK so the frontend user isn't kept waiting.
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Lead securely captured and queued for webhook dispatch.",
        captured: { timestamp }
      })
    };

  } catch (error) {
    console.error("Error capturing lead:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to process lead data." })
    };
  }
};
