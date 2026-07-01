import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Bundle Arimo (metric-compatible with Arial) so the canvas renders the Brat
// look deterministically across machines instead of falling back.
import "@fontsource/arimo/400.css";
import "@fontsource/arimo/700.css";
// Courier Prime for the Typewriter preset, same reasoning.
import "@fontsource/courier-prime/400.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
