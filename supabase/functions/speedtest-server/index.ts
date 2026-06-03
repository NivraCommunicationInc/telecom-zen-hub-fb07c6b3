// speedtest-server — download sink + ping endpoint for Nivra Speed Test
// GET ?action=ping     → 1-byte immediate response
// GET ?action=download → 4 MB incompressible payload

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
};

// 4 MB pseudo-random (xorshift — incompressible, fast)
function buildChunk(size: number): Uint8Array {
  const buf = new Uint8Array(size);
  let x = 0xDEADBEEF >>> 0;
  for (let i = 0; i < size; i++) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x = x >>> 0;
    buf[i] = x & 0xFF;
  }
  return buf;
}

const CHUNK = buildChunk(4 * 1024 * 1024); // 4 MB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "GET") return new Response("405", { status: 405, headers: cors });

  const action = new URL(req.url).searchParams.get("action") ?? "ping";

  if (action === "ping") {
    return new Response(".", {
      headers: { ...cors, "Content-Type": "text/plain", "Content-Length": "1" },
    });
  }

  if (action === "download") {
    return new Response(CHUNK, {
      headers: {
        ...cors,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(CHUNK.byteLength),
        "Content-Encoding": "identity",
      },
    });
  }

  return new Response("Bad action", { status: 400, headers: cors });
});
