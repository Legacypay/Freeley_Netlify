// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Whop conversion pixel (docs.whop.com/developer/guides/pixel), company
// biz_2i0xjR1QwIvijR. Vendor snippet, verbatim — do not reformat.
// SCOPE: Astro pages only. The legacy public/*.html pages passed through into
// the same deploy are deliberately NOT tagged — do not add it to shared.js.
// Whop wants it in <head> on every page it covers, so it is injected here
// rather than added to Layout.astro: six pages (checkout, waitlist, compare,
// prototype, assessment-quiz, assessment-design-2) declare their own <head>
// and never touch the layout. `head-inline` is the one stage Astro applies to
// all of them, unbundled.
// Requires https://t.whop.tw in the netlify.toml CSP (script-src + connect-src).
const WHOP_PIXEL = `
!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,"script","https://t.whop.tw","whop");
whop.setScope("biz_2i0xjR1QwIvijR");
whop.track("page");
`;

// https://astro.build/config
export default defineConfig({
  integrations: [
    {
      name: 'whop-pixel',
      hooks: {
        'astro:config:setup': ({ injectScript }) => injectScript('head-inline', WHOP_PIXEL),
      },
    },
  ],
  // Fonts are self-hosted at build time instead of linked from Google. Two
  // reasons, both visible: the stylesheet was a render-blocking request to a
  // third-party origin, and the fallback that painted while it travelled had
  // different metrics from the real face — that is the "bold flash then swap"
  // on a hard refresh. Astro emits metric-matched fallbacks (size-adjust,
  // ascent-override) so the placeholder occupies the same space, and preloads
  // the files from our own origin. Build-time note: this fetches from Google
  // during `astro build`, so the Netlify builder needs network (it has it).
  // Only pages that render <Font /> are affected; the other 16 are untouched.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Source Serif 4',
      cssVariable: '--font-display',
      weights: ['400 700'],
      styles: ['normal', 'italic'],
      fallbacks: ['Charter', 'Georgia', 'serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Archivo',
      cssVariable: '--font-text',
      weights: ['400 700'],
      styles: ['normal'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    // The compliance register. Astro's font API does not expose a width axis,
    // so a self-hosted Archivo carries no font-stretch range and `font-stretch:
    // 79%` would clamp to 100% and silently do nothing. Archivo Narrow is the
    // real narrow cut rather than an interpolation — better drawn, and it works.
    {
      provider: fontProviders.google(),
      name: 'Archivo Narrow',
      cssVariable: '--font-condensed',
      weights: ['400 700'],
      styles: ['normal'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
