<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-08-12 | Updated: 2026-08-12 -->

# scripts/lib/

## Purpose
Shared image-generation backends used by both `scripts/generate-images.js` and `scripts/generate-cutout-images.js`. The two files expose the exact same call signature — `generateImage(prompt, sourceImage?) -> Promise<Buffer>` — so either one is a drop-in swap for the other; the calling scripts import whichever is currently wired up (as of this writing, `generate-images.js` and `generate-cutout-images.js` both import from `openai-image.js`, but `gemini-image.js` implements the identical interface against Google's model and can be swapped in without touching the calling scripts).

## Key Files
| File | Description |
|------|-------------|
| `gemini-image.js` | Calls Gemini 2.5 Flash Image ("nano banana") via `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`. Sends the prompt as a text part, plus an inline base64-encoded image part when `sourceImage` (`{ buffer, mimeType }`) is provided (image-conditioned edit). Requires `GEMINI_API_KEY` env var — exits the process immediately if missing. Exports `{ generateImage, MIME_TYPES, MODEL }`. |
| `openai-image.js` | Calls OpenAI `gpt-image-1`. With no `sourceImage`, does `POST /v1/images/generations` (JSON body, `size: 'auto'`). With `sourceImage`, does `POST /v1/images/edits` (multipart `FormData`/`Blob`, built with Node's native `fetch`/`FormData` — no extra multipart dependency). Requires `OPENAI_API_KEY` env var — exits the process immediately if missing. Exports `{ generateImage, MIME_TYPES, MODEL }`. |

Both modules throw an `Error` (with the API's JSON error body stringified into the message) if the response doesn't contain image data, which the calling scripts catch per-manifest-entry.

## Subdirectories
None.

## For AI Agents
### Working In This Directory
- Keep the exported interface (`generateImage(prompt, sourceImage)` returning a `Buffer`, plus `MIME_TYPES` and `MODEL`) identical across both files — the calling scripts in `scripts/` rely on being able to swap the `require('./lib/...')` target without other code changes.
- Both files fail fast (process exit) at module-load time if their API key env var is absent, rather than deferring the error to first call.

### Testing Requirements
No automated tests. These are thin, directly-`fetch`-based API wrappers; verify by running one of the calling scripts in `scripts/` end-to-end with a real API key.

### Common Patterns
- Env-var-gated API key read at module load, not per-call.
- A shared `MIME_TYPES` map (`png`/`jpg`/`jpeg`/`webp`) used to set the correct content type for image inputs.

## Dependencies
### Internal
Consumed by `scripts/generate-images.js` and `scripts/generate-cutout-images.js` (see `scripts/AGENTS.md`).

### External
- Gemini API (`gemini-image.js`) — no SDK, raw `fetch`.
- OpenAI Images API (`openai-image.js`) — no SDK, raw `fetch`/`FormData`/`Blob`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
