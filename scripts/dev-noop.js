// Placeholder process for `netlify dev`'s [dev] "#custom" framework — see
// the comment in netlify.toml. Netlify Dev needs a long-running child
// process to watch; the real Astro dev server is expected to already be
// running separately (`npm run dev`) on the configured targetPort.
setInterval(() => {}, 60000);
