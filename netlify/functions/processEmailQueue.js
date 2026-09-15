/**
 * Netlify Function: processEmailQueue
 *
 * Drains lib/email/engine.js's Blobs-backed send queue. Every step of every
 * enrolled drip journey (lib/email/journeys.js) is scheduled up front, at
 * enrollJourney() time, as one `queue/<dueISO>__<uuid>` item in the
 * "email-engine" Blobs store; this function is what turns a now-due item
 * into an actual send, on the same "queue in Blobs + cron" pattern as
 * retryPendingCases.js.
 *
 * GET /.netlify/functions/processEmailQueue — also invocable manually
 * (same convention as retryPendingCases.js). Add ?dry=1 to log what WOULD
 * be sent without sending or removing anything from the queue.
 *
 * Scheduled every 10 minutes (netlify.toml). Netlify's scheduled-function
 * 30-second execution limit is why this caps itself to MAX_PER_RUN items —
 * a backlog just gets picked up across more runs, never all at once.
 */

const { connectBlobs } = require('./lib/blobs');
const { getEmailStore, emailHash, sendTransactional } = require('./lib/email/engine');

const MAX_PER_RUN = 50;

exports.handler = async (event) => {
  connectBlobs(event);
  const dryRun = Boolean(event.queryStringParameters && event.queryStringParameters.dry === '1');
  const headers = { 'Content-Type': 'application/json' };

  try {
    const store = getEmailStore();
    const { blobs } = await store.list({ prefix: 'queue/' });
    if (!blobs || blobs.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ processed: 0, message: 'Queue empty' }) };
    }

    // Keys are queue/<dueISO>__<uuid> — lexicographically sortable by due
    // time, so a plain string sort doubles as "oldest due first" and lets us
    // stop the moment we reach an item that isn't due yet.
    const sortedKeys = blobs.map(b => b.key).sort();
    const nowIso = new Date().toISOString();

    let processed = 0, sent = 0, skipped = 0;
    const failures = [];

    for (const key of sortedKeys) {
      if (processed >= MAX_PER_RUN) break;
      const dueIso = key.slice('queue/'.length, key.indexOf('__'));
      if (dueIso > nowIso) break; // nothing after this (in sort order) is due either

      processed++;
      let item;
      try {
        item = await store.get(key, { type: 'json' });
      } catch (e) {
        console.warn(`[EMAIL QUEUE] Failed to read ${key} (non-critical):`, e.message);
        continue;
      }
      if (!item) continue; // already drained by a previous overlapping run

      // A journey step only fires while its enrollment is still the SAME one
      // that scheduled it — cancelJourney (or a fresh force:true re-enroll)
      // invalidates every already-queued step this way, with no need to
      // search-and-delete the queue itself.
      if (item.journey) {
        const journeyRec = await store.get(`journeys/${emailHash(item.to)}/${item.journey}`, { type: 'json' });
        const stillActive = journeyRec && journeyRec.status === 'active' && journeyRec.enrollment_id === item.enrollment_id;
        if (!stillActive) {
          skipped++;
          if (!dryRun) await store.delete(key);
          continue;
        }
      }

      if (dryRun) {
        console.log(`[EMAIL QUEUE] DRY RUN would send "${item.template}" (journey: ${item.journey || 'n/a'})`);
        continue;
      }

      try {
        const result = await sendTransactional({
          template: item.template,
          to: item.to,
          data: item.data || {},
          dedupeKey: item.dedupe_key,
          kind: item.kind || 'marketing'
        });
        if (result.sent) sent++;
        else if (!['suppressed', 'duplicate', 'dry-run'].includes(result.reason)) {
          // An unexpected failure (network error, Resend down, …) — logged
          // distinctly from an ordinary skip so it's easy to spot in logs.
          // The item is still removed: journey emails are best-effort, not
          // a guaranteed-delivery queue, matching this repo's convention for
          // every other non-critical notification path.
          console.warn(`[EMAIL QUEUE] Send failed for ${key}: ${result.reason}`);
          failures.push({ key, reason: result.reason });
        }
        await store.delete(key);
      } catch (e) {
        console.warn(`[EMAIL QUEUE] Unexpected error processing ${key} (non-critical):`, e.message);
        failures.push({ key, reason: e.message });
        await store.delete(key);
      }
    }

    console.log(`[EMAIL QUEUE] Processed ${processed} item(s): ${sent} sent, ${skipped} skipped (stale journey), ${failures.length} failed`);
    return { statusCode: 200, headers, body: JSON.stringify({ processed, sent, skipped, failed: failures.length, dry_run: dryRun }) };
  } catch (e) {
    console.error('[EMAIL QUEUE] Fatal error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
