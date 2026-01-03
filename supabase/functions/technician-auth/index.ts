import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Simple JWT-like token signing (HMAC-SHA256)
async function signToken(payload: object, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = { ...payload, iat: now, exp: now + 8 * 60 * 60 }; // 8 hour expiry
  
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(tokenPayload)).replace(/=/g, '');
  const data = `${headerB64}.${payloadB64}`;
  
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${data}.${signatureB64}`;
}

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const { email, accessCode } = await req.json();
    
    if (!email || !accessCode) {
      console.log("[technician-auth] Missing email or accessCode");
      return new Response(
        JSON.stringify({ error: "Email et code d'accès requis" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log(`[technician-auth] Login attempt for: ${normalizedEmail}`);

    // Create Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find technician by email
    const { data: technician, error: techError } = await supabase
      .from("technicians")
      .select("id, full_name, email, status, user_id, access_code, failed_login_attempts, lockout_until, specializations, phone")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (techError) {
      console.error("[technician-auth] Database error:", techError);
      return new Response(
        JSON.stringify({ error: "Erreur de connexion. Veuillez réessayer." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!technician) {
      console.log("[technician-auth] No technician found for email:", normalizedEmail);
      return new Response(
        JSON.stringify({ error: "Aucun profil technicien trouvé pour ce courriel." }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check lockout
    if (technician.lockout_until) {
      const lockoutEnd = new Date(technician.lockout_until);
      if (lockoutEnd > new Date()) {
        const minutesRemaining = Math.ceil((lockoutEnd.getTime() - Date.now()) / 60000);
        console.log("[technician-auth] Account locked for:", minutesRemaining, "minutes");
        return new Response(
          JSON.stringify({ error: `Compte temporairement verrouillé. Réessayez dans ${minutesRemaining} minute(s).` }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if active
    if (technician.status !== "active") {
      console.log("[technician-auth] Account inactive:", technician.status);
      return new Response(
        JSON.stringify({ error: "Accès bloqué: compte désactivé." }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify access code
    if (technician.access_code !== accessCode) {
      const newAttempts = (technician.failed_login_attempts || 0) + 1;
      const MAX_ATTEMPTS = 5;
      const LOCKOUT_MINUTES = 15;

      const updates: { failed_login_attempts: number; lockout_until?: string } = {
        failed_login_attempts: newAttempts,
      };

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockoutTime = new Date();
        lockoutTime.setMinutes(lockoutTime.getMinutes() + LOCKOUT_MINUTES);
        updates.lockout_until = lockoutTime.toISOString();
        
        await supabase.from("technicians").update(updates).eq("id", technician.id);
        
        console.log("[technician-auth] Account locked after", MAX_ATTEMPTS, "attempts");
        return new Response(
          JSON.stringify({ error: `Trop de tentatives. Compte verrouillé pour ${LOCKOUT_MINUTES} minutes.` }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase.from("technicians").update(updates).eq("id", technician.id);
      
      const remaining = MAX_ATTEMPTS - newAttempts;
      console.log("[technician-auth] Invalid access code. Remaining attempts:", remaining);
      return new Response(
        JSON.stringify({ error: `Code d'accès invalide. ${remaining} tentative(s) restante(s).` }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success - reset failed attempts
    await supabase.from("technicians").update({ 
      failed_login_attempts: 0, 
      lockout_until: null 
    }).eq("id", technician.id);

    // Sign session token
    const tokenSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Use service key as signing secret
    const sessionToken = await signToken({
      technicianId: technician.id,
      email: technician.email,
      fullName: technician.full_name,
      role: "technician",
    }, tokenSecret);

    console.log("[technician-auth] Login successful for:", technician.full_name);

    return new Response(
      JSON.stringify({
        success: true,
        token: sessionToken,
        technician: {
          id: technician.id,
          email: technician.email,
          full_name: technician.full_name,
          phone: technician.phone,
          specializations: technician.specializations,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[technician-auth] Unexpected error:", error);
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ error: "Erreur inattendue. Veuillez réessayer." }),
      { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }
});
