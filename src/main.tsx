import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { runContractTemplateSmokeTest } from "@/lib/contractTemplateSmokeTest";

// DEV: Prevent stale UI caused by previously-registered PWA service workers/caches.
// This keeps the Preview always reflecting the latest code.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .then(() => {
      // Also clear Cache Storage in dev, when available.
      if ("caches" in window) {
        return caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
      }
    })
    .catch((err) => {
      console.warn("[DEV] Failed to unregister service workers", err);
    });
}

// Dev-only helper for quick regression checks (see docs/contract-template-smoke-test.md)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__nivraContractTemplateSmokeTest = runContractTemplateSmokeTest;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
