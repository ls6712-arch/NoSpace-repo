import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./app/App";
import { migrateLegacyStorageKeys } from "./app/lib/localData";

// Must run before any component reads localStorage, so an existing user's
// badges, points, drafts and other local-only data carry over from their
// pre-rebrand "nospace.*" keys instead of silently resetting to empty.
migrateLegacyStorageKeys();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
