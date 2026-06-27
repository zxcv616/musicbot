"""
Transcription backend for the lyric video app — Milestone 1.

Local Whisper via faster-whisper. Accepts an uploaded audio file and returns
word-level timestamps as JSON. No editor, no styling concerns here — just the
raw transcript + timing the frontend can display.

Run: uv run uvicorn main:app --reload --port 8000   (from backend/)

Model is configurable via WHISPER_MODEL (default "base"). Larger models
("small", "medium") are more accurate on sung vocals but slower to download/run.
"""

import os
import tempfile
from functools import lru_cache

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")
# CPU + int8 keeps it light and works on Apple Silicon without CUDA.
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE = os.environ.get("WHISPER_COMPUTE", "int8")

app = FastAPI(title="Lyric Video Transcription")

# Dev-only: allow the Vite dev server (and its proxy) to call us directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def get_model() -> WhisperModel:
    # Loaded lazily and cached so the first request pays the (one-time) cost.
    return WhisperModel(WHISPER_MODEL, device=WHISPER_DEVICE, compute_type=WHISPER_COMPUTE)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "model": WHISPER_MODEL, "engine": "faster-whisper (local)"}


@app.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...)) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    suffix = os.path.splitext(file.filename)[1] or ".audio"
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(contents)
        tmp.flush()

        model = get_model()
        segments, info = model.transcribe(
            tmp.name,
            word_timestamps=True,
            vad_filter=True,  # skip long silent/instrumental gaps
        )

        out_segments = []
        for seg in segments:
            words = [
                {
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    "probability": round(w.probability, 3),
                }
                for w in (seg.words or [])
            ]
            out_segments.append(
                {
                    "id": seg.id,
                    "start": round(seg.start, 3),
                    "end": round(seg.end, 3),
                    "text": seg.text.strip(),
                    "words": words,
                }
            )

    return {
        "engine": "faster-whisper (local)",
        "model": WHISPER_MODEL,
        "language": info.language,
        "duration": round(info.duration, 3),
        "segments": out_segments,
    }
