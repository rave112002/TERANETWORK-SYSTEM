import { ConfigProvider } from "antd";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { initSentry } from "./config/sentry.js";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Initialize Sentry before rendering
initSentry();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      {/* App owns the reactive (light/dark) ConfigProvider. This outer one only
          themes the error-boundary fallback if App fails to mount. */}
      <ConfigProvider theme={{ token: { colorPrimary: "#4f46e5" } }}>
        <App />
      </ConfigProvider>
    </ErrorBoundary>
  </StrictMode>,
);
