# START HERE — Kickoff for Claude Code

You are building a lyric video web app. There are two companion files:

- `lyric-video-app-plan.md` — the full build brief (architecture, milestones, scope, the aesthetic spec).
- `mood-preset.ts` — the concrete "Mood" aesthetic preset as a typed config object. This is the look the app must produce. Drop it into the project and have the renderer read from it. Do NOT hardcode aesthetic values elsewhere.

## How to work

1. Read `lyric-video-app-plan.md` fully before writing code.
2. Build **strictly in milestone order** (Milestone 0 → 7 in the plan). After each milestone, stop, confirm it runs, and show me something visible before continuing. Do not scaffold the whole app in one shot.
3. The aesthetic is the product. At every decision, favor the visual quality of the *default, zero-input* output over adding features or options.
4. Keep the renderer as ONE module that both the live preview and the final export call, so they never drift apart.

## Your first task (Milestone 0 only — do not go further yet)

Set up a Vite + React + TypeScript project with Tailwind. Single page. Add an audio file upload that plays the uploaded file back in the browser. Add `mood-preset.ts` to the project (it won't be used yet). Confirm it runs with `npm run dev`, then tell me it's working and wait before starting Milestone 1.

## Tech stack (decided — don't change without asking)

- Frontend: Vite + React + TypeScript + Tailwind
- Rendering: HTML5 canvas (preview + export share the same code path)
- Transcription: Whisper with word-level timestamps (prefer local `faster-whisper`/`whisper.cpp` via a small Python FastAPI endpoint; hosted API only as fallback)
- Export: ffmpeg-based, vertical 1080×1920 @ 30fps MP4 with original audio muxed in
- Backgrounds: user-uploaded images only (no stock/AI in v1)

## Out of scope for v1 (don't build these)

Multiple presets (allow them in architecture, ship only "Mood"), stock/AI images, accounts/payments/hosting, horizontal/square export, large customization surfaces.

When Milestone 0 runs, report back and wait.
