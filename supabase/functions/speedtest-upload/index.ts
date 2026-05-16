// Nivra Speed Test — upload sink
// Accepts a POST body, discards it, returns 200 with received byte count.
// Used to measure upload throughput from the client.

import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

// 50 MB is more than enough for a real speed test sample.
const MAX_BODY_BYTES = 50 * 1024 * 1024;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // IP-based rate limit (30 req/min) — same preset as autocomplete.
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip") || "unknown";
  const rateCheck = await checkRateLimit({ key: `speedtest_upload:${clientIp}`, ...RATE_LIMITS.SEARCH });
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck, corsHeaders, "fr");
  }

  // Hard cap on declared Content-Length to prevent bandwidth exhaustion attacks.
  const declaredLength = Number(req.headers.get("content-length") || "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return new Response(
      JSON.stringify({ ok: false, error: "Payload too large" }),
      { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // Drain the body, but also enforce the cap defensively in case Content-Length is missing/lies.
    let received = 0;
    const reader = req.body?.getReader();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          if (received > MAX_BODY_BYTES) {
            try { await reader.cancel(); } catch { /* noop */ }
            return new Response(
              JSON.stringify({ ok: false, error: "Payload too large" }),
              { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, received_bytes: received }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
