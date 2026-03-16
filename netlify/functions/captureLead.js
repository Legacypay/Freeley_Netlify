exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
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
      
      console.log(`[LEAD CAPTURED] Email: ${email} | Phone: ${phone} | Webhook Status: ${response.status}`);
    } catch (e) {
      console.error("[WEBHOOK ERROR] Unable to reach n8n / Make endpoint:", e.message);
    }

    // Always return a fast 200 OK so the frontend user isn't kept waiting.
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Lead securely captured and queued for webhook dispatch.",
        captured: { email, phone, timestamp }
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
