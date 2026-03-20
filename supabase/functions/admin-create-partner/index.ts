import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePartnerRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  notes?: string;
  // New fields for complete account creation
  password?: string;
  activate_immediately?: boolean;
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
      console.error("[admin-create-partner] Missing required secrets");
      return jsonResponse({ ok: false, code: "MISCONFIGURED", message: "Service configuration error" });
    }

    // Get auth header to verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ ok: false, code: "UNAUTHORIZED", message: "Missing authorization" });
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller is admin/employee
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ ok: false, code: "UNAUTHORIZED", message: "Invalid session" });
    }

    // Check if user has admin or employee role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);

    const isAdminOrEmployee = roles?.some(
      (r) => r.role === "admin" || r.role === "employee"
    );

    if (!isAdminOrEmployee) {
      return jsonResponse({ ok: false, code: "FORBIDDEN", message: "Admin access required" });
    }

    const { first_name, last_name, email, phone, notes, password, activate_immediately } = (await req.json()) as CreatePartnerRequest;

    if (!first_name || !last_name || !email) {
      return jsonResponse({ ok: false, code: "MISSING_FIELDS", message: "first_name, last_name, email required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    console.log(`[admin-create-partner] Creating partner: ${normalizedEmail}, with_password: ${!!password}, activate: ${activate_immediately}`);

    // Check if influencer already exists
    const { data: existing } = await supabaseAdmin
      .from("influencers")
      .select("id, status, user_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existing) {
      return jsonResponse({
        ok: false,
        code: "ALREADY_EXISTS",
        message: `Partenaire existe déjà (statut: ${existing.status})`,
        influencer_id: existing.id,
      });
    }

    // If password provided, create auth user immediately
    let authUserId: string | null = null;
    
    if (password) {
      if (password.length < 8) {
        return jsonResponse({ ok: false, code: "PASSWORD_TOO_SHORT", message: "Le mot de passe doit contenir au moins 8 caractères" });
      }

      console.log(`[admin-create-partner] Creating auth user for: ${normalizedEmail}`);

      // Check if auth user already exists
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const existingAuthUser = authUsers?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);

      if (existingAuthUser) {
        console.log(`[admin-create-partner] Auth user already exists: ${existingAuthUser.id}`);
        authUserId = existingAuthUser.id;
        
        // Update password for existing user
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          password,
          email_confirm: true,
        });

        if (updateError) {
          console.error("[admin-create-partner] Password update error:", updateError);
          return jsonResponse({ ok: false, code: "AUTH_ERROR", message: updateError.message });
        }
      } else {
        // Create new auth user
        const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
        });

        if (createUserError) {
          console.error("[admin-create-partner] User creation error:", createUserError);
          return jsonResponse({ ok: false, code: "AUTH_ERROR", message: createUserError.message });
        }

        authUserId = newUser.user.id;
        console.log(`[admin-create-partner] Created auth user: ${authUserId}`);
      }
    }

    // Get default commission plan
    const { data: defaultPlan } = await supabaseAdmin
      .from("commission_plans")
      .select("id")
      .eq("is_default", true)
      .maybeSingle();

    // Determine status based on whether we're activating immediately
    const status = (password && activate_immediately) ? "active" : "invited";

    // Insert influencer using service role (bypasses RLS)
    const { data: influencer, error: insertError } = await supabaseAdmin
      .from("influencers")
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: normalizedEmail,
        phone: phone?.trim() || null,
        notes: notes?.trim() || null,
        status,
        user_id: authUserId,
        payout_method: "etransfer",
        payout_email: normalizedEmail,
        commission_plan_id: defaultPlan?.id || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[admin-create-partner] Insert error:", insertError);
      return jsonResponse({
        ok: false,
        code: "INSERT_ERROR",
        message: insertError.message,
      });
    }

    console.log(`[admin-create-partner] Created influencer: ${influencer.id}`);

    // If auth user was created, add role
    if (authUserId) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({
          user_id: authUserId,
          role: "influencer",
          is_active: true,
          status: "active",
        }, {
          onConflict: "user_id,role",
        });

      if (roleError) {
        console.error("[admin-create-partner] Role creation error (non-fatal):", roleError);
      }

      // Also create profile if needed
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: authUserId,
          user_id: authUserId,
          email: normalizedEmail,
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          full_name: `${first_name.trim()} ${last_name.trim()}`,
          phone: phone?.trim() || null,
        }, {
          onConflict: "id",
        });

      if (profileError) {
        console.error("[admin-create-partner] Profile creation error (non-fatal):", profileError);
      }
    }

    // Generate referral code
    const code = `${first_name.toUpperCase().slice(0, 3)}${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;

    const { error: codeError } = await supabaseAdmin
      .from("referral_codes")
      .insert({
        influencer_id: influencer.id,
        code,
        status: "active",
      });

    if (codeError) {
      console.error("[admin-create-partner] Code insert error:", codeError);
      // Non-fatal, influencer was created
    }

    // Only create invite token if not activated immediately
    let token: string | null = null;
    if (!password || !activate_immediately) {
      token = crypto.randomUUID();
      const { error: inviteError } = await supabaseAdmin
        .from("influencer_invites")
        .insert({
          influencer_id: influencer.id,
          token,
        });

      if (inviteError) {
        console.error("[admin-create-partner] Invite insert error:", inviteError);
        // Non-fatal
      }
    }

    const message = password && activate_immediately 
      ? "Compte partenaire créé et activé avec succès"
      : "Partenaire créé avec succès";

    return jsonResponse({
      ok: true,
      influencer_id: influencer.id,
      user_id: authUserId,
      code,
      status,
      token,
      activated: password && activate_immediately,
      message,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin-create-partner] Unexpected error:", error);
    return jsonResponse({
      ok: false,
      code: "SERVER_ERROR",
      message: errorMessage,
    });
  }
});
