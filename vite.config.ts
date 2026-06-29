/// <reference types="vitest" />
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Copy the @ffmpeg/core ESM files into public/ so they're served from our own
 * origin instead of a third-party CDN. Runs on every dev-server start and
 * every build so the files are always in sync with the installed package.
 * The files are gitignored — they regenerate from node_modules on any install.
 */
function ffmpegCorePlugin(): Plugin {
  return {
    name: "ffmpeg-core",
    buildStart() {
      const src = resolve("node_modules/@ffmpeg/core/dist/esm");
      const dest = resolve("public");
      mkdirSync(dest, { recursive: true });
      for (const f of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
        copyFileSync(`${src}/${f}`, `${dest}/${f}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ffmpegCorePlugin()],
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
