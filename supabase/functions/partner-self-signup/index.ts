import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SignupRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

async function findUserByEmail(supabaseAdmin: any, email: string): Promise<any | null> {
  // Paginate through all users to find by email (listUsers has 50 user default limit)
  let page = 1;
  const perPage = 1000;
  
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    
    if (error) {
      console.error("[partner-self-signup] Error listing users page", page, error);
      throw error;
    }
    
    const users = data?.users || [];
    const found = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    
    if (found) {
      return found;
    }
    
    // No more pages
    if (users.length < perPage) {
      break;
    }
    
    page++;
  }
  
  return null;
}

// Helper to always return JSON (status 200) for consistent client handling
function jsonResponse(body: Record<string, unknown>) {
  return new Response(
    JSON.stringify(body),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for required secrets first
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[partner-self-signup] Missing required secrets");
      return jsonResponse({
        ok: false,
        code: "MISCONFIGURED",
        message: "Service configuration error. Please contact support."
      });
    }

    const { first_name, last_name, email, password } = await req.json() as SignupRequest;

    // Validate input
    if (!first_name || !last_name || !email || !password) {
      return jsonResponse({
        ok: false,
        code: "MISSING_FIELDS",
        message: "Tous les champs sont requis."
      });
    }

    if (password.length < 8) {
      return jsonResponse({
        ok: false,
        code: "PASSWORD_TOO_SHORT",
        message: "Le mot de passe doit contenir au moins 8 caractères."
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    console.log(`[partner-self-signup] Processing signup for: ${normalizedEmail}`);

    // Check if auth user already exists (with pagination)
    const existingAuthUser = await findUserByEmail(supabaseAdmin, normalizedEmail);

    let authUserId: string;

    if (existingAuthUser) {
      console.log(`[partner-self-signup] Auth user already exists: ${existingAuthUser.id}`);
      authUserId = existingAuthUser.id;

      // Check if influencer row exists for this user
      const { data: existingInfluencer } = await supabaseAdmin
        .from("influencers")
        .select("id, status")
        .eq("user_id", authUserId)
        .maybeSingle();

      if (existingInfluencer) {
        // Account fully exists
        console.log(`[partner-self-signup] Influencer row exists with status: ${existingInfluencer.status}`);
        return jsonResponse({ 
          ok: false,
          code: "USER_EXISTS",
          message: "Un compte existe déjà avec cet email. Utilisez 'Mot de passe oublié' pour récupérer l'accès.",
          status: existingInfluencer.status
        });
      }

      // Also check by email in case user_id wasn't linked
      const { data: influencerByEmail } = await supabaseAdmin
        .from("influencers")
        .select("id, status, user_id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (influencerByEmail) {
        // Link the existing influencer row to the auth user if not linked
        if (!influencerByEmail.user_id) {
          await supabaseAdmin
            .from("influencers")
            .update({ user_id: authUserId })
            .eq("id", influencerByEmail.id);
          console.log(`[partner-self-signup] Linked existing influencer to auth user`);
        }
        
        return jsonResponse({ 
          ok: false,
          code: "USER_EXISTS",
          message: "Un compte existe déjà avec cet email. Utilisez 'Mot de passe oublié' pour récupérer l'accès.",
          status: influencerByEmail.status
        });
      }

      // Auth user exists but no influencer row - repair it
      console.log(`[partner-self-signup] Repairing ghost account - creating influencer row`);
    } else {
      // Create new auth user
      console.log(`[partner-self-signup] Creating new auth user`);
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: password,
        email_confirm: true, // Auto-confirm since this is self-signup
      });

      if (createError) {
        console.error("[partner-self-signup] Error creating auth user:", createError);
        return jsonResponse({
          ok: false,
          code: "AUTH_ERROR",
          message: createError.message || "Erreur lors de la création du compte."
        });
      }

      authUserId = newUser.user.id;
      console.log(`[partner-self-signup] Created auth user: ${authUserId}`);
    }

    // Get default commission plan
    const { data: defaultPlan } = await supabaseAdmin
      .from("commission_plans")
      .select("id")
      .eq("is_default", true)
      .maybeSingle();

    // Upsert influencer record (using service role - bypasses RLS)
    // Auto-activate: no admin approval needed
    const { error: influencerError } = await supabaseAdmin
      .from("influencers")
      .upsert({
        user_id: authUserId,
        email: normalizedEmail,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        status: "active", // Auto-activate - no admin approval needed
        payout_method: "etransfer",
        payout_email: normalizedEmail,
        commission_plan_id: defaultPlan?.id || null,
      }, {
        onConflict: "email",
      });

    if (influencerError) {
      console.error("[partner-self-signup] Error upserting influencer:", influencerError);
      return jsonResponse({
        ok: false,
        code: "DB_ERROR",
        message: influencerError.message || "Erreur lors de la création du profil partenaire."
      });
    }

    // Verify the row was actually created by re-reading it
    const { data: verifiedInfluencer, error: verifyError } = await supabaseAdmin
      .from("influencers")
      .select("id, email, status, created_at")
      .eq("email", normalizedEmail)
      .limit(1)
      .single();

    if (verifyError || !verifiedInfluencer) {
      console.error("[partner-self-signup] Verification failed - row not found:", verifyError);
      return jsonResponse({
        ok: false,
        code: "DB_WRITE_FAILED",
        message: "Influencer row not created. Please try again."
      });
    }

    console.log(`[partner-self-signup] Influencer record verified: ${verifiedInfluencer.id}`);

    // Auto-create referral code for the new partner
    const generatedCode = `${first_name.trim().toUpperCase().slice(0, 4)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    const { error: codeError } = await supabaseAdmin
      .from("referral_codes")
      .insert({
        influencer_id: verifiedInfluencer.id,
        code: generatedCode,
        is_active: true,
      });

    if (codeError) {
      console.error("[partner-self-signup] Error creating referral code (non-fatal):", codeError);
      // Non-fatal - partner can create code manually later
    } else {
      console.log(`[partner-self-signup] Created referral code: ${generatedCode}`);
    }

    // Upsert user_roles
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: authUserId,
        role: "influencer",
      }, {
        onConflict: "user_id,role",
        ignoreDuplicates: true,
      });

    if (roleError) {
      console.error("[partner-self-signup] Error upserting role (non-fatal):", roleError);
      // Non-fatal - continue
    }

    return jsonResponse({
      ok: true,
      success: true,
      influencer_id: verifiedInfluencer.id,
      influencer: verifiedInfluencer,
      status: verifiedInfluencer.status,
      referral_code: generatedCode,
      message: "Inscription réussie! Vous pouvez maintenant accéder à votre tableau de bord.",
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
    console.error("[partner-self-signup] Unexpected error:", error);
    return jsonResponse({ 
      ok: false,
      code: "SERVER_ERROR",
      message: errorMessage
    });
  }
});
