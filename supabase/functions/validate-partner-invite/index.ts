import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateRequest {
  token: string;
}

interface ValidateResponse {
  valid: boolean;
  reason?: string;
  data?: {
    influencer_id: string;
    email: string;
    first_name: string;
    last_name: string;
    status: string;
    invite_id: string;
    expires_at: string;
  };
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token }: ValidateRequest = await req.json();

    console.log("[validate-partner-invite] Received token:", token?.substring(0, 8) + "...");

    if (!token || typeof token !== "string" || token.trim().length === 0) {
      console.log("[validate-partner-invite] Invalid or missing token");
      return new Response(
        JSON.stringify({ valid: false, reason: "missing_token" } as ValidateResponse),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invite by token
    const { data: invite, error: inviteError } = await supabase
      .from("influencer_invites")
      .select("id, influencer_id, expires_at, used_at")
      .eq("token", token.trim())
      .maybeSingle();

    if (inviteError) {
      console.error("[validate-partner-invite] DB error:", inviteError);
      return new Response(
        JSON.stringify({ valid: false, reason: "db_error" } as ValidateResponse),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!invite) {
      console.log("[validate-partner-invite] Token not found");
      return new Response(
        JSON.stringify({ valid: false, reason: "not_found" } as ValidateResponse),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if already used
    if (invite.used_at) {
      console.log("[validate-partner-invite] Token already used at:", invite.used_at);
      return new Response(
        JSON.stringify({ valid: false, reason: "already_used" } as ValidateResponse),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if expired
    const expiresAt = new Date(invite.expires_at);
    if (expiresAt < new Date()) {
      console.log("[validate-partner-invite] Token expired at:", invite.expires_at);
      return new Response(
        JSON.stringify({ valid: false, reason: "expired" } as ValidateResponse),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch influencer details
    const { data: influencer, error: influencerError } = await supabase
      .from("influencers")
      .select("id, first_name, last_name, email, status")
      .eq("id", invite.influencer_id)
      .single();

    if (influencerError || !influencer) {
      console.error("[validate-partner-invite] Influencer not found:", influencerError);
      return new Response(
        JSON.stringify({ valid: false, reason: "influencer_not_found" } as ValidateResponse),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if influencer is still in invited status
    if (influencer.status !== "invited") {
      console.log("[validate-partner-invite] Influencer already activated, status:", influencer.status);
      return new Response(
        JSON.stringify({ valid: false, reason: "already_activated" } as ValidateResponse),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[validate-partner-invite] Token valid for:", influencer.email);

    const response: ValidateResponse = {
      valid: true,
      data: {
        influencer_id: influencer.id,
        email: influencer.email,
        first_name: influencer.first_name,
        last_name: influencer.last_name,
        status: influencer.status,
        invite_id: invite.id,
        expires_at: invite.expires_at,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("[validate-partner-invite] Unexpected error:", error);
    return new Response(
      JSON.stringify({ valid: false, reason: "server_error" } as ValidateResponse),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
