// speedtest-server — Nivra Speed Test download & ping endpoint
// GET ?action=ping   → 1-byte response for latency measurement
// GET ?action=download → 1 MB of incompressible random-ish data

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
};

// 1 MB of pseudo-random data (generated once, reused across requests)
// Uses XOR pattern to avoid compression while being fast to generate
function makePseudoRandomChunk(size: number): Uint8Array {
  const buf = new Uint8Array(size);
  let x = 0xDEADBEEF;
  for (let i = 0; i < size; i++) {
    x ^= x << 13; x ^= x >> 17; x ^= x << 5;
    buf[i] = x & 0xFF;
  }
  return buf;
}

const CHUNK = makePseudoRandomChunk(1024 * 1024); // 1 MB

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "ping";

  if (action === "ping") {
    return new Response(".", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain", "Content-Length": "1" },
    });
  }

  if (action === "download") {
    // Return 1 MB of incompressible data
    return new Response(CHUNK, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/octet-stream",
        "Content-Length": CHUNK.byteLength.toString(),
        "Content-Encoding": "identity",
      },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
