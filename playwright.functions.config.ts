import { defineConfig } from '@playwright/test';

// Separate from playwright.config.ts (which runs the UI regression suite against
// `astro build && astro preview` — a static server with NO Netlify Functions).
//
// This config exercises the actual Netlify Functions backend (submitQuiz.js and
// friends) as real HTTP calls, via `netlify dev`, which proxies to a local
// functions runtime with the SITE'S REAL ENV VARS injected (MDI_CLIENT_ID,
// MDI_CLIENT_SECRET, MDI_LIVE_MODE, etc — same values Netlify uses in prod for
// this project's "dev" context). Requires `netlify login` + `netlify link` once.
//
// Every request here reaches the REAL MDI API (https://api.mdintegrations.com).
// Safety net: lib/mdi-voucher.js defaults every voucher to demo:true unless BOTH
// MDI_LIVE_MODE=true and MDI_ALLOW_LIVE_ORDERS=true are set — the latter is not
// set anywhere for this project, so these tests can only ever create
// non-billable demo vouchers (see docs/MDI_TESTING.md). Do not add
// MDI_ALLOW_LIVE_ORDERS to any env this suite runs against.
//
// Run: npm run test:mdi
export default defineConfig({
  testDir: './tests/functions',
  fullyParallel: false, // MDI OAuth token cache + rate limits — keep it serial
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8888',
  },
  // Two servers, started in order:
  //  1. `astro dev` — Astro 7 daemonizes this (the CLI invocation returns almost
  //     immediately once the background dev server is up).
  //  2. `netlify dev --target-port 4321` — proxies functions on top of the Astro
  //     server above. netlify-cli's own framework auto-detection insists on running
  //     a long-lived foreground "dev command" it can supervise; because Astro 7's
  //     command returns immediately (daemon model), giving it `astro dev`/`npm run
  //     dev` directly makes netlify-cli think the server just died and shut itself
  //     down. The inline `setInterval` below is a never-exiting placeholder so
  //     netlify-cli stays happy while it proxies to the real (already-running)
  //     Astro daemon via --target-port.
  webServer: [
    {
      command: 'npx astro dev --port 4321',
      url: 'http://localhost:4321',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npx netlify-cli dev -c "node -e \\"setInterval(()=>{},1000)\\"" --target-port 4321 --port 8888',
      url: 'http://localhost:8888/.netlify/functions/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
