import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompleteInviteRequest {
  token: string;
  password: string;
  payout_method?: string;
  payout_email?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[partner-complete-invite] Missing required secrets");
      return jsonResponse({ ok: false, code: "MISCONFIGURED", message: "Service configuration error" });
    }

    const { token, password, payout_method, payout_email } = await req.json() as CompleteInviteRequest;

    if (!token || !password) {
      return jsonResponse({ ok: false, code: "MISSING_FIELDS", message: "Token et mot de passe requis" });
    }

    if (password.length < 8) {
      return jsonResponse({ ok: false, code: "PASSWORD_TOO_SHORT", message: "Le mot de passe doit contenir au moins 8 caractères" });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log("[partner-complete-invite] Processing token...");

    // 1) Validate the invite token
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("influencer_invites")
      .select("id, influencer_id, token, used_at, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (inviteError || !invite) {
      console.error("[partner-complete-invite] Invite not found:", inviteError);
      return jsonResponse({ ok: false, code: "INVALID_TOKEN", message: "Lien d'invitation invalide" });
    }

    if (invite.used_at) {
      return jsonResponse({ ok: false, code: "ALREADY_USED", message: "Ce lien a déjà été utilisé" });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return jsonResponse({ ok: false, code: "EXPIRED", message: "Ce lien a expiré" });
    }

    // 2) Get influencer details
    const { data: influencer, error: influencerError } = await supabaseAdmin
      .from("influencers")
      .select("id, email, first_name, last_name, status, user_id")
      .eq("id", invite.influencer_id)
      .single();

    if (influencerError || !influencer) {
      console.error("[partner-complete-invite] Influencer not found:", influencerError);
      return jsonResponse({ ok: false, code: "INFLUENCER_NOT_FOUND", message: "Compte partenaire introuvable" });
    }

    if (influencer.user_id) {
      return jsonResponse({ ok: false, code: "ALREADY_ACTIVATED", message: "Ce compte est déjà activé. Connectez-vous directement." });
    }

    const email = influencer.email.toLowerCase().trim();
    console.log(`[partner-complete-invite] Creating user for: ${email}`);

    // 3) Create auth user with admin API (bypasses email confirmation)
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createUserError) {
      console.error("[partner-complete-invite] User creation failed:", createUserError);
      
      // Check if user already exists
      if (createUserError.message?.includes("already")) {
        return jsonResponse({ ok: false, code: "USER_EXISTS", message: "Un compte existe déjà avec cet email" });
      }
      
      return jsonResponse({ ok: false, code: "AUTH_ERROR", message: createUserError.message });
    }

    const userId = newUser.user.id;
    console.log(`[partner-complete-invite] Created auth user: ${userId}`);

    // 4) Update influencer with user_id and activate
    const { error: updateInfluencerError } = await supabaseAdmin
      .from("influencers")
      .update({
        user_id: userId,
        status: "active",
        payout_method: payout_method || "etransfer",
        payout_email: payout_email || email,
      })
      .eq("id", influencer.id);

    if (updateInfluencerError) {
      console.error("[partner-complete-invite] Influencer update failed:", updateInfluencerError);
      return jsonResponse({ ok: false, code: "DB_ERROR", message: "Erreur lors de l'activation du compte" });
    }

    // 5) Mark invite as used
    await supabaseAdmin
      .from("influencer_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    // 6) Add role to user_roles with is_active = true
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: userId,
        role: "influencer",
        is_active: true,
        status: "active",
      }, {
        onConflict: "user_id,role",
      });

    if (roleError) {
      console.error("[partner-complete-invite] Role creation failed (non-fatal):", roleError);
    }

    console.log(`[partner-complete-invite] Completed successfully for ${email}`);

    return jsonResponse({
      ok: true,
      success: true,
      message: "Compte activé avec succès! Vous pouvez maintenant vous connecter.",
      influencer_id: influencer.id,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
    console.error("[partner-complete-invite] Unexpected error:", error);
    return jsonResponse({ ok: false, code: "SERVER_ERROR", message: errorMessage });
  }
});
