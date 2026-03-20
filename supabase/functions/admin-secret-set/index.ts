import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "x-supabase-client-platform",
    "x-supabase-client-version",
    "x-supabase-api-version",
    "x-requested-with",
  ].join(", "),
};

const DEFAULT_CODE = "112233";

// Forbidden codes (weak patterns)
const FORBIDDEN_CODES = ["000000", "123456", "111111", "654321", "222222", "333333", "444444", "555555", "666666", "777777", "888888", "999999"];

// Check if code has all identical digits
function hasAllIdenticalDigits(code: string): boolean {
  return /^(\d)\1{5}$/.test(code);
}

// Hash code using SHA-256
async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

interface RequestBody {
  admin_user_id: string;
  current_code: string;
  new_code: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = `secret-set-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const timestamp = new Date().toISOString();
  
  // Get IP and user agent for logging
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  console.log(`[${requestId}] [${timestamp}] admin-secret-set started`);

  try {
    const body: RequestBody = await req.json();
    const { admin_user_id, current_code, new_code } = body;

    // Validate inputs
    if (!admin_user_id || !current_code || !new_code) {
      console.error(`[${requestId}] Missing required fields`);
      return new Response(
        JSON.stringify({ ok: false, request_id: requestId, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate code formats (6 digits)
    if (!/^\d{6}$/.test(current_code) || !/^\d{6}$/.test(new_code)) {
      console.error(`[${requestId}] Invalid code format`);
      return new Response(
        JSON.stringify({ ok: false, request_id: requestId, error: "Codes must be 6 digits" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if new code is forbidden
    if (FORBIDDEN_CODES.includes(new_code) || hasAllIdenticalDigits(new_code)) {
      console.error(`[${requestId}] Forbidden code pattern`);
      return new Response(
        JSON.stringify({ ok: false, request_id: requestId, error: "This code pattern is too weak. Please choose a different code." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get stored code hash for this admin
    const { data: codeRecord, error: codeError } = await supabase
      .from("admin_security_codes")
      .select("id, code_hash")
      .eq("admin_user_id", admin_user_id)
      .maybeSingle();

    if (codeError) {
      console.error(`[${requestId}] Error fetching code:`, codeError);
      return new Response(
        JSON.stringify({ ok: false, request_id: requestId, error: "Database error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Determine expected code hash for current code verification
    let expectedHash: string;
    
    if (codeRecord?.code_hash) {
      expectedHash = codeRecord.code_hash;
    } else {
      // No code set, use default
      expectedHash = await hashCode(DEFAULT_CODE);
      console.log(`[${requestId}] No existing code, using default for verification`);
    }

    // Verify current code
    const currentCodeHash = await hashCode(current_code);
    if (currentCodeHash !== expectedHash) {
      // Log failed attempt
      await supabase.from("admin_secret_audit_log").insert({
        request_id: requestId,
        admin_user_id,
        event: "set_failed_wrong_current",
        ip_address: ip,
        user_agent: userAgent,
        meta: {}
      });

      console.log(`[${requestId}] Current code verification failed`);
      return new Response(
        JSON.stringify({ ok: false, request_id: requestId, error: "Current code is incorrect" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Hash the new code
    const newCodeHash = await hashCode(new_code);

    // Upsert the code
    if (codeRecord) {
      const { error: updateError } = await supabase
        .from("admin_security_codes")
        .update({ code_hash: newCodeHash })
        .eq("id", codeRecord.id);

      if (updateError) {
        console.error(`[${requestId}] Error updating code:`, updateError);
        return new Response(
          JSON.stringify({ ok: false, request_id: requestId, error: "Failed to update code" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from("admin_security_codes")
        .insert({
          admin_user_id,
          code_hash: newCodeHash
        });

      if (insertError) {
        console.error(`[${requestId}] Error inserting code:`, insertError);
        return new Response(
          JSON.stringify({ ok: false, request_id: requestId, error: "Failed to set code" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Log success
    await supabase.from("admin_secret_audit_log").insert({
      request_id: requestId,
      admin_user_id,
      event: "set_success",
      ip_address: ip,
      user_agent: userAgent,
      meta: { was_update: !!codeRecord }
    });

    console.log(`[${requestId}] Code ${codeRecord ? 'updated' : 'set'} successfully for admin ${admin_user_id}`);

    return new Response(
      JSON.stringify({
        ok: true,
        request_id: requestId,
        message: "Secret code updated successfully"
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${requestId}] Error:`, errorMessage);
    
    return new Response(
      JSON.stringify({ ok: false, request_id: requestId, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
