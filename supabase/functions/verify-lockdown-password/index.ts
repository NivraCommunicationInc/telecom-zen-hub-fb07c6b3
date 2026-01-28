import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // If no hash is set, use default password
    const defaultPassword = Deno.env.get("LOCKDOWN_DEFAULT_PASSWORD") || "NivraSecure2024!";
    
    if (!storedHash) {
      // First time - compare with default password
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
