/**
 * Health Check Endpoint
 * 
 * Simple 200 OK response for uptime monitoring and deploy verification.
 * 
 * GET /.netlify/functions/health
 */
exports.handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'ok',
    service: 'freeley-api',
    timestamp: new Date().toISOString(),
    version: process.env.COMMIT_REF || 'unknown'
  })
});
