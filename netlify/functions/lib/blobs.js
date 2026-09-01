/**
 * Netlify Blobs bootstrap for legacy (`exports.handler`) functions.
 *
 * Every function in this directory is a lambda-compat v1 handler. In that
 * runtime Netlify does NOT auto-configure `@netlify/blobs` — the store
 * credentials arrive on the invocation event (`event.blobs`) and must be
 * handed to the SDK with `connectLambda(event)` before the first `getStore()`.
 * Without it every Blobs call in production throws:
 *   "The environment has not been configured to use Netlify Blobs. To use it
 *    manually, supply the following properties when creating a store: siteID, token"
 * (seen in the freeley-health submitQuiz logs, 2026-08-30/31 — no order record
 * was ever persisted, the retry queue, rate limiter and test-case tagging were
 * all silently no-ops). `netlify dev` injects the context through env vars, so
 * local runs never showed the problem.
 *
 * Call `connectBlobs(event)` as the first line of every handler that touches a
 * store, directly or through a lib helper. Idempotent and harmless when the
 * event carries no Blobs context (local dev, unit tests).
 */

const { connectLambda } = require('@netlify/blobs');

let warned = false;

function connectBlobs(event) {
  if (!event || !event.blobs) return false;
  try {
    connectLambda(event);
    return true;
  } catch (e) {
    if (!warned) {
      warned = true;
      console.warn('[BLOBS] connectLambda failed (Blobs calls will fail):', e.message);
    }
    return false;
  }
}

module.exports = { connectBlobs };
