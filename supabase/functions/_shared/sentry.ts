/**
 * Sentry — Edge function error reporting (Deno)
 *
 * Lightweight HTTP-based reporter. We don't pull the full @sentry/deno SDK
 * because it bloats cold-start time and depends on Node compat shims. The
 * Sentry "store" endpoint accepts a JSON envelope directly — that's all we
 * need to capture exceptions from critical functions.
 *
 * Setup:
 *   1. In Sentry, create a project (Node.js or Generic platform works)
 *   2. Copy the DSN
 *   3. In Lovable Secrets, add:
 *        SENTRY_DSN=https://<key>@<id>.ingest.sentry.io/<project_id>
 *        SENTRY_ENVIRONMENT=production
 *
 * Without SENTRY_DSN this module is a no-op — safe to ship before signup.
 *
 * Usage in an edge function:
 *
 *   import { reportEdgeError, withSentry } from "../_shared/sentry.ts";
 *
 *   serve(withSentry("paypal-webhook", async (req) => {
 *     // ... your handler — uncaught errors are auto-reported with the tag
 *   }));
 *
 * Or report a handled error manually:
 *
 *   try { ... } catch (e) {
 *     await reportEdgeError(e, { function: "paypal-webhook", event_id: "..." });
 *     throw e;
 *   }
 */

const DSN = Deno.env.get("SENTRY_DSN") ?? "";
const ENVIRONMENT = Deno.env.get("SENTRY_ENVIRONMENT") ?? "production";
const RELEASE = Deno.env.get("SENTRY_RELEASE") ?? "";

interface SentryDsnParts {
  protocol: string;
  publicKey: string;
  host: string;
  projectId: string;
}

function parseDsn(dsn: string): SentryDsnParts | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    if (!projectId) return null;
    return {
      protocol: u.protocol.replace(":", ""),
      publicKey: u.username,
      host: u.host,
      projectId,
    };
  } catch (_e) {
    return null;
  }
}

const dsnParts = DSN ? parseDsn(DSN) : null;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function uuid(): string {
  // RFC4122 v4-ish, sufficient for Sentry event_id.
  return crypto.randomUUID().replace(/-/g, "");
}

function serializeError(err: unknown): {
  type: string;
  value: string;
  stacktrace?: { frames: Array<{ filename: string; function?: string }> };
} {
  if (err instanceof Error) {
    const frames =
      err.stack
        ?.split("\n")
        .slice(1, 30)
        .map((line) => ({
          filename: line.trim(),
          function: undefined,
        })) ?? [];
    return {
      type: err.name || "Error",
      value: err.message || "Unknown error",
      stacktrace: { frames: frames.reverse() }, // Sentry expects oldest-first
    };
  }
  if (typeof err === "string") {
    return { type: "Error", value: err };
  }
  try {
    return { type: "Error", value: JSON.stringify(err) };
  } catch (_e) {
    return { type: "Error", value: String(err) };
  }
}

interface ReportContext {
  /** Edge function name (sets `tags.function`) */
  function?: string;
  /** Free-form structured context attached as `extra` */
  [key: string]: unknown;
}

/**
 * Report a handled or unhandled exception to Sentry. Never throws — failures
 * are logged but do not propagate (Sentry must never crash the edge function).
 */
export async function reportEdgeError(err: unknown, ctx: ReportContext = {}): Promise<void> {
  if (!dsnParts) return; // No DSN — silent no-op

  try {
    const eventId = uuid();
    const { function: fnName, ...extra } = ctx;

    const event = {
      event_id: eventId,
      timestamp: nowSeconds(),
      platform: "javascript",
      level: "error",
      environment: ENVIRONMENT,
      release: RELEASE || undefined,
      server_name: "supabase-edge",
      tags: {
        function: fnName ?? "unknown",
        runtime: "deno",
      },
      extra,
      exception: {
        values: [serializeError(err)],
      },
    };

    const url = `${dsnParts.protocol}://${dsnParts.host}/api/${dsnParts.projectId}/store/`;
    const sentryAuth = [
      "Sentry sentry_version=7",
      `sentry_client=nivra-deno-edge/1.0`,
      `sentry_key=${dsnParts.publicKey}`,
    ].join(", ");

    // Fire-and-forget with a 5s timeout — never block the actual response.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sentry-Auth": sentryAuth,
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (reportErr) {
    // Sentry itself is down — degrade gracefully.
    console.warn("[sentry] reportEdgeError failed:", reportErr);
  }
}

type Handler = (req: Request) => Promise<Response> | Response;

/**
 * Wrap a Deno.serve handler so any uncaught exception is reported to Sentry
 * before being re-thrown. The original error is NOT swallowed — the caller's
 * own try/catch (or Deno's default 500 response) still runs.
 *
 *   serve(withSentry("paypal-webhook", async (req) => { ... }))
 */
export function withSentry(functionName: string, handler: Handler): Handler {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (err) {
      // Report but don't await — don't add latency to the 500 response.
      reportEdgeError(err, {
        function: functionName,
        method: req.method,
        url: req.url,
      }).catch(() => {});
      throw err;
    }
  };
}

/** Is Sentry actively reporting? Useful for skipping debug-only paths in tests. */
export function isSentryEnabled(): boolean {
  return dsnParts !== null;
}
