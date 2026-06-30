/**
 * Copy onnxruntime-web's wasm/mjs runtime files into public/ort/ so they ship
 * from our own origin.
 *
 * Why: transformers.js defaults the ONNX wasm path to
 *   https://cdn.jsdelivr.net/npm/onnxruntime-web@<version>/dist/
 * but the version bundled here is a dev build (e.g. 1.26.0-dev.*) that does NOT
 * exist on the CDN — so that fetch 404s in production ("Failed to fetch"). It
 * only works in dev because Vite serves the wasm locally. Serving the exact
 * bundled files ourselves (browserTranscribe sets env...wasmPaths to /ort/)
 * removes the CDN dependency and the version mismatch.
 *
 * Runs automatically via the predev / prebuild npm hooks.
 */
import { existsSync, mkdirSync, readdirSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptsDir, "..");

const candidates = [
  join(repoRoot, "node_modules", "onnxruntime-web", "dist"),
  join(
    repoRoot,
    "node_modules",
    "@huggingface",
    "transformers",
    "node_modules",
    "onnxruntime-web",
    "dist",
  ),
];
const ortDist = candidates.find(existsSync);
if (!ortDist) {
  console.error("[copy-ort-wasm] onnxruntime-web/dist not found — is it installed?");
  process.exit(1);
}

const outDir = join(repoRoot, "public", "ort");
// Start clean so a version bump never leaves stale wasm behind.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// The threaded runtime variants (asyncify = wasm backend, jsep = WebGPU, jspi,
// and the plain Safari build) plus their .mjs loaders. ONNX picks the right one.
const wanted = /^ort-wasm-simd-threaded.*\.(wasm|mjs)$/;
const files = readdirSync(ortDist).filter((f) => wanted.test(f));
for (const f of files) copyFileSync(join(ortDist, f), join(outDir, f));

console.log(`[copy-ort-wasm] copied ${files.length} files to public/ort/`);
