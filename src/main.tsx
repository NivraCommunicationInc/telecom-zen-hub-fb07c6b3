import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import ErrorBoundary from "@/components/ErrorBoundary";
import App from "./App.tsx";
import "./index.css";
import "./styles/internal-portal.css";
import "./core-app/styles/core-dark-processing.css";

// Global error handlers — catch async errors that escape React
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Promise Rejection]", event.reason);
  if (import.meta.env.PROD) {
    event.preventDefault();
  }
});

window.addEventListener("error", (event) => {
  console.error("[Global Error]", event.error);
});

// DEV: Prevent stale UI caused by previously-registered PWA service workers/caches.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .then(() => {
      if ("caches" in window) {
        return caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
      }
    })
    .catch((err) => {
      console.warn("[DEV] Failed to unregister service workers", err);
    });
}

// Remove static SEO fallback content once React mounts
const seoFallback = document.getElementById("seo-fallback");
if (seoFallback) seoFallback.remove();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
