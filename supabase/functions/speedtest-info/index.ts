// speedtest-info — returns client IP + ISP info for the speed test page

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "—";

  let isp = "—", city = "—", region = "—", country = "CA";
  try {
    const r = await fetch(`https://ipinfo.io/${ip}/json?token=`, { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const d = await r.json();
      // org looks like "AS5769 Videotron Telecom Ltee" — strip ASN prefix
      isp = d.org ? d.org.replace(/^AS\d+\s+/, "").trim() : "—";
      city = d.city || "—";
      region = d.region || "—";
      country = d.country || "CA";
    }
  } catch { /* ipinfo unavailable, keep defaults */ }

  return new Response(JSON.stringify({ ip, isp, city, region, country }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
