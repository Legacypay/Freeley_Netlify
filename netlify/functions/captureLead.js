exports.handler = async (event, context) => {
  // Only allow POST requests for capturing leads
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

    // PHASE 4 ABANDONED CART STUB:
    // When the ESP (Email Service Provider) like Klaviyo or Make/n8n webhook is ready,
    // we simply execute an HTTP POST to their endpoint here.
    
    // Example: (Uncomment and replace URL when ready)
    /*
    await fetch("https://hook.us2.make.com/YOUR_WEBHOOK_URL", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone, timestamp, source: "Freeley_Quiz_Save_Progress" })
    });
    */

    console.log(`[LEAD CAPTURED] Email: ${email} | Phone: ${phone} | Time: ${timestamp}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Lead captured successfully.",
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
