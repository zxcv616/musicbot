/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  server: {
    proxy: {
      // Forward transcription requests to the local FastAPI backend.
      "/api": "http://localhost:8000",
    },
  },
  // ffmpeg.wasm ships a Worker that Vite's dep optimizer mangles; exclude it.
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  test: {
    environment: "node",
  },
});