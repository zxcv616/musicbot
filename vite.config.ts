import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
});
