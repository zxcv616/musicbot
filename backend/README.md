# Transcription backend (Milestone 1)

Local Whisper (faster-whisper) FastAPI endpoint that returns word-level
timestamps.

## Run

```bash
cd backend
uv sync           # install deps into .venv
uv run uvicorn main:app --reload --port 8000
```

First request downloads the Whisper model (default `base`) from Hugging Face;
subsequent runs are cached.

- `GET  /api/health` — engine/model info
- `POST /api/transcribe` (multipart `file`) — returns `{ segments: [{ text, start, end, words: [{ word, start, end }] }] }`

Config via env: `WHISPER_MODEL` (base|small|medium|large-v3), `WHISPER_DEVICE`,
`WHISPER_COMPUTE`.

The Vite dev server proxies `/api/*` here (see `vite.config.ts`).
