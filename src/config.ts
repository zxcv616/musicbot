import { parseFlag } from "./utils/featureFlags";

/**
 * Whether the Whisper transcription backend is available.
 *
 * Default: false — the app runs as a standalone static frontend with no
 * backend required.
 *
 * To enable: add VITE_ENABLE_TRANSCRIPTION=true to .env.local, then restart
 * the dev server (or rebuild). The backend must be running on port 8000:
 *   cd backend && uv run uvicorn main:app --reload --port 8000
 */
export const TRANSCRIPTION_ENABLED = parseFlag(
  import.meta.env.VITE_ENABLE_TRANSCRIPTION,
);
