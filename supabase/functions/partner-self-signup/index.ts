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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { first_name, last_name, email, password } = await req.json() as SignupRequest;

    // Validate input
    if (!first_name || !last_name || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields", code: "MISSING_FIELDS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters", code: "PASSWORD_TOO_SHORT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

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
        return new Response(
          JSON.stringify({ 
            error: "Un compte existe déjà avec cet email. Utilisez 'Mot de passe oublié' pour récupérer l'accès.",
            code: "USER_EXISTS",
            status: existingInfluencer.status
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
        
        return new Response(
          JSON.stringify({ 
            error: "Un compte existe déjà avec cet email. Utilisez 'Mot de passe oublié' pour récupérer l'accès.",
            code: "USER_EXISTS",
            status: influencerByEmail.status
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
        throw createError;
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

    // Upsert influencer record
    const { data: influencer, error: influencerError } = await supabaseAdmin
      .from("influencers")
      .upsert({
        user_id: authUserId,
        email: normalizedEmail,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        status: "pending",
        payout_method: "etransfer",
        payout_email: normalizedEmail,
        commission_plan_id: defaultPlan?.id || null,
      }, {
        onConflict: "user_id",
      })
      .select("id, status")
      .single();

    if (influencerError) {
      console.error("[partner-self-signup] Error upserting influencer:", influencerError);
      throw influencerError;
    }

    console.log(`[partner-self-signup] Influencer record created/updated: ${influencer.id}`);

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

    return new Response(
      JSON.stringify({
        success: true,
        influencer_id: influencer.id,
        status: influencer.status,
        message: "Inscription réussie. Votre compte est en attente d'activation.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
    console.error("[partner-self-signup] Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: "SERVER_ERROR"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
