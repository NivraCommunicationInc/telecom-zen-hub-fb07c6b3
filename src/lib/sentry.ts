/**
 * Sentry — Error monitoring & performance tracing
 *
 * Setup:
 *   1. Create a project at https://sentry.io (React platform, Vite)
 *   2. Copy the DSN
 *   3. Add to your .env (and Lovable Secrets for prod):
 *        VITE_SENTRY_DSN=https://...@sentry.io/...
 *        VITE_SENTRY_ENVIRONMENT=production
 *        VITE_SENTRY_RELEASE=<git sha or version>
 *
 * Without a DSN this module is a no-op — safe to ship before signup.
 *
 * What gets reported:
 *   - Uncaught JS errors (React + non-React)
 *   - Unhandled promise rejections
 *   - ErrorBoundary catches (wired via Sentry.captureException in the boundary)
 *   - Tagged manual reports via captureError() / setUser()
 *
 * Privacy:
 *   - PII scrubbing on by default (sendDefaultPii=false)
 *   - Request bodies NOT captured (avoids leaking credit card / PIN data)
 *   - URL query strings stripped if they contain "token", "code", "pin", "auth"
 */
import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENVIRONMENT =
  (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ||
  (import.meta.env.MODE === "production" ? "production" : "development");
const RELEASE = import.meta.env.VITE_SENTRY_RELEASE as string | undefined;

let initialized = false;

/** Initialize Sentry once at app boot. Safe to call multiple times. */
export function initSentry(): void {
  if (initialized) return;
  if (!DSN) {
    // No DSN configured — no-op (development before Sentry account exists).
    return;
  }
  try {
    Sentry.init({
      dsn: DSN,
      environment: ENVIRONMENT,
      release: RELEASE,
      // 10% of transactions in prod, 100% in dev. Tune with traffic.
      tracesSampleRate: ENVIRONMENT === "production" ? 0.1 : 1.0,
      // Capture replays only for sessions where an error happened.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.5,
      // Never send PII (we use email + user_id as tags only, set explicitly)
      sendDefaultPii: false,
      // Strip sensitive query parameters before sending the event.
      beforeSend(event) {
        try {
          const url = event.request?.url;
          if (url) {
            const stripped = stripSensitiveQueryParams(url);
            event.request!.url = stripped;
          }
          // Never send cookies or auth headers
          if (event.request?.headers) {
            const h = event.request.headers as Record<string, string>;
            delete h.cookie;
            delete h.authorization;
            delete h.Cookie;
            delete h.Authorization;
          }
        } catch {
          // ignore scrubbing errors
        }
        return event;
      },
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          maskAllInputs: true,
          blockAllMedia: true,
        }),
      ],
    });
    initialized = true;
  } catch (err) {
    // Sentry init must never crash the app.
    console.warn("[sentry] init failed:", err);
  }
}

const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "code",
  "pin",
  "auth",
  "secret",
  "key",
  "password",
  "session",
  "access_token",
  "refresh_token",
]);

function stripSensitiveQueryParams(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const params = Array.from(u.searchParams.keys());
    for (const k of params) {
      if (SENSITIVE_QUERY_KEYS.has(k.toLowerCase())) {
        u.searchParams.set(k, "[REDACTED]");
      }
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

/** Manually report a handled exception. */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) {
    console.warn("[sentry] captureError called before init:", err);
    return;
  }
  Sentry.withScope((scope) => {
    if (context) {
      for (const [k, v] of Object.entries(context)) {
        scope.setExtra(k, v);
      }
    }
    Sentry.captureException(err);
  });
}

/** Set the current user (for grouping events). Call after auth. */
export function setSentryUser(user: { id?: string; email?: string; role?: string } | null): void {
  if (!initialized) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: user.id,
    // We do send email — it's the simplest way for support to identify a user.
    // If your privacy posture requires zero PII, replace with a hash.
    email: user.email,
    role: user.role,
  });
}

/** Tag the current scope (portal, route, feature flag, etc.). */
export function setSentryTag(key: string, value: string): void {
  if (!initialized) return;
  Sentry.setTag(key, value);
}

/** Add a breadcrumb (action trace shown alongside the next error). */
export function addBreadcrumb(message: string, category?: string, data?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.addBreadcrumb({
    message,
    category: category ?? "app",
    level: "info",
    data,
    timestamp: Date.now() / 1000,
  });
}

/** Returns true when Sentry is actively reporting (DSN configured + init ok). */
export function isSentryEnabled(): boolean {
  return initialized;
}

// Re-export for advanced callers (ErrorBoundary integration, etc.)
export { Sentry };
