import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);

  const start = Date.now();
  const checks: Record<string, { status: "ok" | "error"; latency?: number; message?: string }> = {};

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Database connectivity
  try {
    const dbStart = Date.now();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    checks.database = error
      ? { status: "error", message: error.message }
      : { status: "ok", latency: Date.now() - dbStart };
  } catch (e) {
    checks.database = { status: "error", message: String(e) };
  }

  // 2. Storage
  try {
    const { error } = await supabase.storage.listBuckets();
    checks.storage = error
      ? { status: "error", message: error.message }
      : { status: "ok" };
  } catch (e) {
    checks.storage = { status: "error", message: String(e) };
  }

  // 3. Auth service
  try {
    const { error } = await supabase.auth.getSession();
    checks.auth = error
      ? { status: "error", message: error.message }
      : { status: "ok" };
  } catch (e) {
    checks.auth = { status: "error", message: String(e) };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const totalLatency = Date.now() - start;

  const body = {
    status: allOk ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    latency_ms: totalLatency,
    checks,
    environment: Deno.env.get("ENVIRONMENT") ?? "production",
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: allOk ? 200 : 503,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-cache, no-store" },
  });
});
