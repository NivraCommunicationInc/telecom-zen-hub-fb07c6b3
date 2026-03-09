/**
 * Nivra Core — Standalone entry point
 * Self-contained React root for the Core internal operations console.
 * Used when Core is deployed as a separate app on app.nivra-telecom.ca.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import CoreApp from "./CoreApp";
import "../index.css";
import "./styles/core-dark-processing.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CoreApp />
  </React.StrictMode>
);
