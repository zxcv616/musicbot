/**
 * Cloudflare Worker for the lyric video app.
 *
 * Two jobs:
 *  1. Serve the built SPA via the Workers Static Assets binding (ASSETS).
 *  2. Proxy Hugging Face model requests same-origin under /hf/*.
 *
 * Why the proxy: on workers.dev the browser fails the direct cross-origin fetch
 * to huggingface.co with a CORS error, even though HF returns valid CORS
 * headers (verified server-side). transformers.js is pointed at /hf/ (see
 * src/browserTranscribe.ts); this Worker fetches HF server-side — where CORS
 * doesn't apply — following HF's redirect to its CDN, and streams the bytes
 * back from our own origin. No cross-origin request, no CORS.
 */
const HF_PREFIX = "/hf/";
const HF_BASE = "https://huggingface.co/";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith(HF_PREFIX)) {
      return proxyHuggingFace(request, url);
    }
    // Everything else: the built static site (with SPA fallback via config).
    return env.ASSETS.fetch(request);
  },
};

async function proxyHuggingFace(request, url) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const target = HF_BASE + url.pathname.slice(HF_PREFIX.length) + url.search;

  // Forward Range so large model files can be ranged/resumed if needed.
  const fwd = new Headers();
  const range = request.headers.get("Range");
  if (range) fwd.set("Range", range);

  let upstream;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: fwd,
      redirect: "follow", // follows HF's 302 to its CDN, server-side
    });
  } catch (err) {
    return new Response(`Upstream fetch failed: ${err}`, { status: 502 });
  }

  const headers = new Headers(upstream.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.delete("set-cookie");
  // Model files are content-addressed/immutable — let the browser cache hard.
  if (upstream.ok) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
