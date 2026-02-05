import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    // Common SDK/browser headers (avoid CORS breakages across browsers/Supabase-js versions)
    "x-supabase-client-platform",
    "x-supabase-client-version",
    "x-supabase-api-version",
    "x-requested-with",
  ].join(", "),
};

// Hash session token for comparison
async function hashSessionToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

interface RequestBody {
  admin_user_id: string;
  session_token: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

const requestId = `session-check-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  
  console.log(`[${requestId}] admin-session-check started`);

  try {
    // Parse request body
    const body: RequestBody = await req.json();
    const { admin_user_id, session_token } = body;

    if (!admin_user_id || !session_token) {
      console.error(`[${requestId}] Missing required fields`);
      return new Response(
        JSON.stringify({ valid: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hash the session token
    const tokenHash = await hashSessionToken(session_token);

    // Check for valid session
    const { data: session, error } = await supabase
      .from("admin_otp_sessions")
      .select("id, expires_at, verified_at")
      .eq("admin_user_id", admin_user_id)
      .eq("session_token_hash", tokenHash)
      .is("revoked_at", null)
      .gte("expires_at", new Date().toISOString())
      .order("verified_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !session) {
      console.log(`[${requestId}] No valid session found for user ${admin_user_id}`);
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[${requestId}] Valid session found, expires at ${session.expires_at}`);

    return new Response(
      JSON.stringify({ 
        valid: true,
        expires_at: session.expires_at,
        verified_at: session.verified_at
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error);
    
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
