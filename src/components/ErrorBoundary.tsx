import { Component, ErrorInfo, ReactNode } from "react";
import { captureError } from "@/lib/sentry";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorId: null };

  static getDerivedStateFromError(error: Error): State {
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
    // Forward to Sentry (no-op if not configured)
    captureError(error, {
      source: "ErrorBoundary",
      component_stack: info.componentStack,
      error_id: this.state.errorId,
    });

    // Stale-chunk recovery: after a deploy, the cached index.html can reference
    // hashed chunks that no longer exist. Auto-reload once instead of showing
    // the crash screen.
    const msg = (error?.message || "").toLowerCase();
    const isChunkError =
      msg.includes("importing a module script failed") ||
      msg.includes("failed to fetch dynamically imported module") ||
      msg.includes("loading chunk") ||
      msg.includes("loading css chunk") ||
      error?.name === "ChunkLoadError";
    if (isChunkError && typeof window !== "undefined") {
      const KEY = "__nivra_chunk_reload__";
      try {
        const last = Number(sessionStorage.getItem(KEY) || "0");
        if (Date.now() - last > 30_000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
          return;
        }
      } catch { /* ignore */ }
    }

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      if (projectId) {
        fetch(
          `https://${projectId}.supabase.co/functions/v1/log-client-error`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: error.message,
              stack: error.stack,
              component_stack: info.componentStack,
              timestamp: new Date().toISOString(),
              url: window.location.href,
            }),
          }
        ).catch(() => {});
      }
    } catch {
      // Silent — logging must never crash the app
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2rem",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              background: "#f8fafc",
            }}
          >
            <div style={{ textAlign: "center", maxWidth: 480 }}>
              <div
                style={{
                  fontSize: "3rem",
                  marginBottom: "1rem",
                }}
              >
                ⚠️
              </div>
              <h1
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: "0.75rem",
                }}
              >
                Une erreur inattendue s'est produite
              </h1>
              <p
                style={{
                  color: "#64748b",
                  fontSize: "0.95rem",
                  lineHeight: 1.6,
                  marginBottom: "0.5rem",
                }}
              >
                Nous nous excusons pour la gêne occasionnée. Notre équipe a été
                notifiée automatiquement.
              </p>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "0.8rem",
                  marginBottom: "1.5rem",
                }}
              >
                Code de référence : {this.state.errorId}
              </p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    padding: "10px 24px",
                    background: "#1a3a6a",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Réessayer
                </button>
                <a
                  href="/"
                  style={{
                    padding: "10px 24px",
                    background: "transparent",
                    color: "#1a3a6a",
                    border: "1px solid #1a3a6a",
                    borderRadius: "8px",
                    textDecoration: "none",
                    fontSize: "14px",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  Retour à l'accueil
                </a>
              </div>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
