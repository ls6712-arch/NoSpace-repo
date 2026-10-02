import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./app/App";
import { migrateLegacyStorageKeys } from "./app/lib/localData";

// Must run before any component reads localStorage, so an existing user's
// badges, points, drafts and other local-only data carry over from their
// pre-rebrand "nospace.*" keys instead of silently resetting to empty.
migrateLegacyStorageKeys();

// iOS Safari only applies :active (the pressed state on every button and
// link) once the page has a touchstart listener. A no-op one is enough.
document.addEventListener("touchstart", () => {}, { passive: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
