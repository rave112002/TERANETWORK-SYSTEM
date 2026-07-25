import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Self-hosted variable fonts (offline-safe in production). The index.html
// Google Fonts <link> is only a dev/CDN fallback.
import "@fontsource-variable/onest";
import "@fontsource-variable/jetbrains-mono";

import "./index.css";
import { initSentry } from "./config/sentry.js";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Initialize Sentry before rendering
initSentry();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
