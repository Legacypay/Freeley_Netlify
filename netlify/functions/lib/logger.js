/**
 * Freeley Structured Logger
 * 
 * Shared logging utility for all Netlify Functions.
 * Outputs structured JSON logs and optionally sends critical errors to Slack.
 * 
 * Usage:
 *   const log = require('./lib/logger');
 *   log.info('submitQuiz', 'Case created', { case_id: '...' });
 *   log.error('submitQuiz', 'MDI API failed', { statusCode: 500 });
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, critical: 4 };

function createLogEntry(level, fn, message, data = {}) {
  return {
    level,
    function: fn,
    message,
    ...data,
    ts: new Date().toISOString()
  };
}

function log(level, fn, message, data = {}) {
  const entry = createLogEntry(level, fn, message, data);
  const output = JSON.stringify(entry);

  if (level === 'error' || level === 'critical') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }

  // Send critical/error to Slack (non-blocking)
  if ((level === 'error' || level === 'critical') && process.env.SLACK_WEBHOOK_URL) {
    const emoji = level === 'critical' ? '🚨' : '❌';
    const color = level === 'critical' ? '#dc2626' : '#f59e0b';
    
    fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color,
          title: `${emoji} [${fn}] ${message}`,
          text: JSON.stringify(data, null, 2).slice(0, 500),
          footer: `Freeley API | ${new Date().toISOString()}`,
          mrkdwn_in: ['text']
        }]
      })
    }).catch(() => {}); // Never fail on alert delivery
  }
}

module.exports = {
  debug: (fn, msg, data) => log('debug', fn, msg, data),
  info:  (fn, msg, data) => log('info', fn, msg, data),
  warn:  (fn, msg, data) => log('warn', fn, msg, data),
  error: (fn, msg, data) => log('error', fn, msg, data),
  critical: (fn, msg, data) => log('critical', fn, msg, data)
};
