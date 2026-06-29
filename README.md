# lyric video

Web app that turns a song into a vertical lyric video. Upload audio and background images or video clips, auto-transcribe lyrics with local Whisper, fix timing in the editor, pick a look, export an MP4.

## What it does

1. Upload an audio file and background media (images, video clips, or both)
2. Hit **Transcribe** — runs faster-whisper locally, returns word-level timestamps
3. Fix timing in the editor: type directly into time fields, tap "now" to pin a line to the playhead, nudge ±0.1s, split/merge/delete lines
4. Pick a preset and text color, choose aspect ratio (9:16 / 1:1 / 16:9)
5. Export — renders every frame client-side with ffmpeg.wasm, muxes the original audio, downloads an MP4

## Presets

**Mood** — photo treatment with color grade, film grain, vignette, and gradient overlays. Bold Arimo, warm off-white text, horizontally stretched. For a moody/filmic look.

**Brat** — flat lime green (#8ACE00) background, regular-weight Arimo, text condensed tall and narrow. Minimal. No grain, no vignette.

## Stack

- Frontend: React 19, Vite, TypeScript, Tailwind v4
- Renderer: single shared canvas renderer (`src/renderer/moodRenderer.ts`) used by both live preview and export
- Export: ffmpeg.wasm (client-side H.264 + AAC, no uploads)
- Backend: FastAPI + faster-whisper (local, only needed for transcription)

## Running it

Backend (only needed for the Transcribe button):

```
cd backend
uv sync
uv run uvicorn main:app --reload --port 8000
```

Frontend:

```
npm install
npm run dev
```

Open http://localhost:5173. Without the backend, everything works except transcription.

## Deploy

Build command: `npm run build`. Output dir: `dist`. Deploy that directory to any static host.

`netlify.toml` and `vercel.json` are included. For Cloudflare Pages, set build command and output dir in the dashboard — no config file needed.

**Do not set `VITE_ENABLE_TRANSCRIPTION=true`** in the host's environment variables. The deployed version has no backend: paste lyrics in the editor, use tap-to-time, preview, and export all work. Transcription (Whisper) is local-dev only.

## Other commands

```
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm test            # vitest (unit tests for timing/preset logic)
```
