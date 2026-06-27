# Lyric Video Web App — Build Brief

> Hand this document to Claude Code as the project spec. It is written to be built incrementally: get each milestone working and visible before moving to the next. Do not build everything at once.

---

## 1. What this is

A web app where a musician uploads a song and a few images, the app transcribes and time-aligns the lyrics, and it renders a vertical (9:16) lyric video in a specific *aesthetic*: large centered lyric text over a soft, moody, "Pinterest-mood" photo background with film grain, a muted color grade, a slow Ken-Burns drift, and clean typography. Output is a TikTok/Reels/Shorts-ready MP4.

**The point of this app is the aesthetic, not the automation.** Many tools already auto-sync lyrics fast. They all look generic/AI. This one wins by producing one specific, tasteful, intentional-looking style that does *not* look mass-produced. Treat visual quality and the "vibe" of the default look as the most important success criterion. When in doubt, favor restraint, subtlety, and a curated feel over flashy effects.

## 2. Core user flow (v1)

1. User uploads an audio file (mp3/wav/m4a).
2. App transcribes vocals to text with word-level timestamps.
3. User reviews/corrects the lyrics and timing in a simple editor.
4. User uploads 1–10 background images.
5. User picks an aesthetic preset (v1 ships with ONE great preset; architecture allows more).
6. App shows a live preview of the lyric video.
7. User exports a 9:16 MP4.

## 3. Tech decisions (already made — do not re-litigate)

- **Platform:** Web app, runs in the browser.
- **Backgrounds:** User uploads their own images. (No stock API, no AI image generation in v1.)
- **Lyrics input:** Auto-transcribe from the uploaded audio using Whisper, then let the user correct the text and nudge timing. Word-level timestamps required (for word-by-word highlight if desired, and for accurate line timing).

## 4. Recommended architecture

Keep it simple and standard so it's easy to extend and later turn into a product.

- **Frontend:** React + Vite + TypeScript. Tailwind for styling.
- **Preview rendering:** Render the live preview on an HTML5 `<canvas>` (or WebGL via a thin layer if needed for grain/filters). The preview and the final export must use the SAME rendering code path so what you see is what you get.
- **Transcription:** OpenAI Whisper for word-level timestamps. Two viable options — let the builder pick based on simplicity:
  - (a) `whisper.cpp` / `faster-whisper` running on a small backend (Python FastAPI) endpoint that accepts audio and returns word-level JSON. **Preferred** — keeps audio off third-party APIs and is free to run.
  - (b) A hosted transcription API as a fallback if local Whisper is too heavy to set up first.
- **Backend (only if needed):** Python FastAPI for the transcription endpoint and for final video export (ffmpeg). Keep frontend and backend in one repo.
- **Final export:** Render frames + mux with audio via **ffmpeg**. Two approaches, pick the simpler that gives acceptable quality:
  - (a) Server-side: backend renders frames (e.g. via headless canvas / Playwright screenshotting the same renderer, or a node-canvas reimplementation) and ffmpeg encodes them with the original audio. More reliable quality.
  - (b) Client-side: capture the canvas with `MediaRecorder` / `ffmpeg.wasm`. Faster to ship, lower quality ceiling. OK for a first proof.
  - Start with whichever is faster to get a watchable MP4 out the door, then improve.

## 5. The aesthetic preset (THIS IS THE PRODUCT — get it right)

Ship ONE preset in v1, executed extremely well. Call it e.g. **"Mood"**. Specification:

**Background image treatment**
- Image fills the 9:16 frame, center-cropped.
- Slow Ken-Burns drift: very slow zoom (e.g. 1.0 → 1.08 over ~8s) and a few px of pan. Subtle, never fast.
- Color grade: muted/desaturated slightly (saturation ~85%), lifted blacks (slightly faded shadows), warm or cool tint as a preset option. Think faded film, not Instagram-vivid.
- A soft dark vignette and a subtle dark gradient overlay (top and bottom) so white text stays readable over any image.
- Film grain overlay (animated, low opacity ~5–10%).
- Optional very subtle light-leak / bloom (off by default — easy to overdo).
- Crossfade between images on section changes (slow, ~1s).

**Lyric text**
- Centered horizontally, positioned in the **center third** of the frame (mobile eye-focus zone), not the very middle.
- One or two lines visible at a time (current line, optionally the next line dimmed).
- Typography: ship 2–3 carefully chosen fonts only (one clean sans like Inter/Söhne-ish, one elegant serif). Do NOT offer a giant font dropdown — curation is the point.
- Text: high contrast white or off-white, subtle soft shadow/glow for legibility, generous letter spacing, tasteful line height.
- Animation per line: gentle fade + a few px rise on entry; fade out on exit. No bouncy/karaoke gimmicks by default. Word-level highlight is an *option*, off by default.
- Timing driven by the word-level timestamps from transcription.

**Global**
- Output 1080×1920, 30fps.
- Everything tuned so the *default* output already looks good with zero user fiddling. The user should be able to do nothing but upload and get something they'd post.

> Design guidance: subtlety beats intensity everywhere. The failure mode of every competitor is "too much." Err toward less.

## 6. The lyric/timing editor (keep it minimal but real)

- Show the transcribed lines in a list with their start times.
- User can: edit the text of any line, split/merge lines, and nudge a line's start time earlier/later (e.g. +/- buttons and a draggable marker on a waveform if cheap to add).
- A waveform view of the audio with line markers is a nice-to-have, not required for v1. A simple list with editable timestamps is enough to start.
- "Play from here" button to check sync against audio.

## 7. Build milestones (do these in order, get each working + visible first)

**Milestone 0 — Skeleton**
- Vite + React + TS + Tailwind project. One page. File upload for audio. Plays the audio back. Commit.

**Milestone 1 — Transcription**
- Wire up Whisper (local preferred). Upload audio → get word-level timestamp JSON → display the raw lyrics on screen. Don't worry about the editor yet. Verify timestamps are roughly right.

**Milestone 2 — Static render**
- Upload one image. Render it to a 9:16 canvas with the full background treatment (crop, grade, vignette, grain, gradient overlays). No text, no motion yet. Make this image treatment look genuinely good — this is half the aesthetic.

**Milestone 3 — Text over background**
- Render the current lyric line centered over the treated background, synced to audio playback using the timestamps. Fade/rise animation. This is the first moment it feels real — make sure the type looks great.

**Milestone 4 — Motion + multi-image**
- Add the Ken-Burns drift and crossfades between multiple uploaded images. Tie image changes to lyric sections or even spacing.

**Milestone 5 — Editor**
- Add the lyric/timing correction UI from section 6.

**Milestone 6 — Export**
- Produce a downloadable 9:16 MP4 with the original audio muxed in, matching the preview. Ship the simplest approach that yields a watchable file, then improve quality.

**Milestone 7 — Polish pass**
- Tune the default preset until an upload-and-do-nothing result looks postable. This is where the product is won or lost.

## 8. Explicitly OUT of scope for v1 (resist building these)

- Multiple aesthetic presets (architecture should ALLOW them; ship only one).
- Stock photo APIs, AI image generation.
- User accounts, payments, hosting/scaling. (Build it to run locally first.)
- Horizontal (16:9) / square exports. Vertical only for v1.
- A big customization surface (font pickers, dozens of sliders). Curation is the value.

## 9. Definition of done for v1

A musician can: open the app, upload a song and a few images, fix any transcription mistakes in a couple minutes, and export a vertical MP4 in the "Mood" aesthetic that they would actually post to TikTok without editing it further in Premiere.

## 10. Notes for the builder

- The single most important file is the renderer (the canvas drawing + effects + timing). Structure the code so the renderer is one well-organized module that both the live preview and the export call. Never let preview and export drift apart.
- Make the preset a single config object (colors, grain opacity, fonts, drift amount, fade timings, etc.) so new presets are just new configs later. This is how the product becomes a taste library, not a one-off.
- Prioritize visual quality of the default output over feature count at every decision point.
