# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser-based lyric video app. A musician uploads a song + images, the app
transcribes lyrics with word-level timestamps, lets them correct text/timing,
and exports a vertical (or square/landscape) MP4 in one tasteful aesthetic
("Mood"). The product IS the aesthetic — favor the visual quality of the
default, zero-input output over adding features or options.

`lyric-video-app-plan.md` is the original build brief; `START-HERE.md` is the
kickoff note. Read the brief before large changes.

## Running it (two processes)

Frontend (Vite + React 19 + TS + Tailwind v4):
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run typecheck  # tsc -b --noEmit
```

Backend (local Whisper transcription, only needed for the Transcribe button):
```bash
cd backend
uv sync
uv run uvicorn main:app --reload --port 8000
```
The Vite dev server proxies `/api/*` → `localhost:8000` (see `vite.config.ts`),
so without the backend running, transcription returns a 500. The first
transcription downloads the Whisper model (configurable via `WHISPER_MODEL`,
default `base`).

There is **no test runner**. `npm run typecheck` / `npm run build` is the
correctness gate. Canvas output can't be unit-tested; visual changes have been
verified by rendering frames in headless Chrome (a throwaway `_render-test.html`
+ `src/renderTest.ts` harness, removed before commit) and inspecting/`ffprobe`ing
the result.

## Architecture — the load-bearing ideas

**The renderer is one shared code path.** `src/renderer/moodRenderer.ts`
(`MoodRenderer`) is the single source of truth for drawing a frame. It is
framework-agnostic: given a 2D context sized to `preset.output` and `FrameInputs`
(images, lyric lines, `playbackSeconds`, `timeSeconds`, `durationSeconds`), it
draws one frame — background cover-crop + color grade + tint + lifted blacks +
vignette + gradients + animated grain, then lyric text. **Both the live preview
and the export call this exact code, so they never drift.** Do not add rendering
logic anywhere else.

- `src/MoodPreview.tsx` runs a `requestAnimationFrame` loop calling
  `renderer.render(...)`, driven by the `<audio>` element's `currentTime`.
- `src/renderer/exportVideo.ts` renders every frame deterministically at
  `t = frame / fps` with the same `MoodRenderer`, then encodes H.264 + muxes the
  original audio with **ffmpeg.wasm** (fully client-side, no frame uploads).

**The aesthetic lives entirely in the preset.** `src/presets/mood-preset.ts`
exports the `MOOD` `LyricPreset` object — every visual constant (grade, grain,
vignette, fonts, sizes, anchors, shadow/halo, motion). `MoodRenderer` hardcodes
no aesthetic values; it reads them from the preset it holds. A new aesthetic is a
new config object, not new renderer code.

**Runtime settings = an "effective preset", not renderer flags.** `App.tsx`
clones `MOOD` (via `useMemo`) applying user choices and passes the result to both
the preview and the export:
- Text color: `TEXT_COLOR_OPTIONS` (curated list). Each option overrides
  `text.color` AND `text.shadow.color`/`opacity` so dark text gets a light halo
  and light text a dark halo — legibility is part of the color choice.
- Aspect ratio: `ASPECT_OPTIONS` overrides `output.{width,height}`.
- `MoodRenderer.preset` is intentionally mutable; `MoodPreview` swaps it each
  frame (and resizes the canvas when `output` changes) so settings update live
  without rebuilding the renderer/grain pool.

**The renderer is aspect-aware**, not stretch-aware. Font size is `fontSizeVmin`
(% of the shorter side) so text stays consistent across 9:16/1:1/16:9; the
vertical anchor uses the preset's lower-center value only in portrait and centers
(0.5) on square/landscape; image cover-crop adapts automatically.

**Lyric timing flow.** Backend returns segments with word-level timestamps
(`src/transcription.ts` types). `segmentsToLines()` collapses each segment into a
`LyricLine` whose start/end come from its first/last word. `App` holds these as
editable `EditableLine[]` (`src/LyricEditor.tsx`) — edit text, nudge start time,
split/merge, add manual lines, "play from here". The renderer picks the active
line by `playbackSeconds` (hard cut — no fade) and clears it during long gaps
(`lineHoldSeconds` / `clearGapSeconds`).

## Conventions / gotchas

- App source lives in `src/`; do not scaffold app/test files into the repo root.
- `@ffmpeg/ffmpeg` and `@ffmpeg/util` are in `optimizeDeps.exclude`
  (`vite.config.ts`) — Vite's dep optimizer otherwise breaks ffmpeg's worker.
- Export uses the **ESM** single-thread ffmpeg core from a CDN (no
  SharedArrayBuffer, so no COOP/COEP headers); the module worker dynamic-imports
  it. The UMD core does not work here.
- The Brat font is **Arimo**, bundled via `@fontsource/arimo` (imported in
  `main.tsx`) so the canvas renders deterministically instead of falling back;
  the renderer applies lowercasing, tight tracking, and a horizontal scale.
- Build milestones in order and confirm each works visibly before continuing;
  keep the default output postable.
