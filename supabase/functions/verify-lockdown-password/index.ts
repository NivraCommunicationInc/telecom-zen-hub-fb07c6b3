import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple hash comparison using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // IP-based rate limiting: 5 attempts per 15 minutes to prevent brute force
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";
  const rlAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
  const rlWindow = 15 * 60 * 1000;
  const rlKey = `lockdown_verify:${clientIP}`;
  const rlNow = new Date().toISOString();
  const rlWindowStart = new Date(Date.now() - rlWindow).toISOString();
  const { count: attemptCount } = await rlAdmin
    .from("rate_limits").select("id", { count: "exact", head: true })
    .eq("key", rlKey).gte("created_at", rlWindowStart);
  if ((attemptCount ?? 0) >= 5) {
    return new Response(
      JSON.stringify({ success: false, error: "Trop de tentatives. Réessayez dans 15 minutes." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  await rlAdmin.from("rate_limits").insert({ key: rlKey, created_at: rlNow }).catch(() => {});

  try {
    const { password } = await req.json();

    if (!password || typeof password !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Password required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get stored password hash
    const { data: hashData, error: hashError } = await supabaseAdmin
      .from("site_settings")
      .select("value_json")
      .eq("key", "lockdown_password_hash")
      .maybeSingle();

    if (hashError) {
      console.error("Error fetching hash:", hashError);
      return new Response(
        JSON.stringify({ success: false, error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const storedHash = hashData?.value_json?.hash;

    // If no hash is set, require env var — no hardcoded fallback
    const defaultPassword = Deno.env.get("LOCKDOWN_DEFAULT_PASSWORD");
    
    if (!storedHash) {
      if (!defaultPassword) {
        console.error("[verify-lockdown-password] No stored hash and no LOCKDOWN_DEFAULT_PASSWORD env var configured");
        return new Response(
          JSON.stringify({ success: false, error: "Lockdown password not configured. Set LOCKDOWN_DEFAULT_PASSWORD secret." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // First time - compare with env-configured default password
      if (password === defaultPassword) {
        // Set the hash for future use
        const newHash = await hashPassword(password);
        await supabaseAdmin
          .from("site_settings")
          .update({
            value_json: {
              hash: newHash,
              last_changed_at: new Date().toISOString(),
              last_changed_by: "system",
            },
          })
          .eq("key", "lockdown_password_hash");

        console.log("[verify-lockdown-password] Default password accepted, hash stored");
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Compare hashes
      const inputHash = await hashPassword(password);
      if (inputHash === storedHash) {
        console.log("[verify-lockdown-password] Password verified successfully");
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log("[verify-lockdown-password] Invalid password attempt");
    return new Response(
      JSON.stringify({ success: false, error: "Invalid password" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[verify-lockdown-password] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
