import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { runContractTemplateSmokeTest } from "@/lib/contractTemplateSmokeTest";

// Dev-only helper for quick regression checks (see docs/contract-template-smoke-test.md)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__nivraContractTemplateSmokeTest = runContractTemplateSmokeTest;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
