/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { version: string };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Bake package.json's version into the client bundle at build time (shown in
  // the header) rather than fetching/parsing package.json at runtime.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
