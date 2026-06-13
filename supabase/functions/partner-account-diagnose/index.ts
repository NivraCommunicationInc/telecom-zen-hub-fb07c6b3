import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiagnoseRequest {
  email: string;
  repair?: boolean;
}

async function findUserByEmail(supabaseAdmin: any, email: string): Promise<any | null> {
  // Paginate through all users to find by email
  let page = 1;
  const perPage = 1000;
  
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    
    if (error) {
      console.error("[partner-account-diagnose] Error listing users page", page, error);
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
    // Verify admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create regular client to verify caller is admin
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: callerError } = await supabaseClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is admin
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: roleRows } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("status", "active");
    const isAdmin = (roleRows || []).some((r: any) =>
      ["admin", "supervisor", "employee"].includes(r.role)
    );

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, repair } = await req.json() as DiagnoseRequest;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log(`[partner-account-diagnose] Diagnosing: ${normalizedEmail}, repair=${repair}`);

    // Check auth user with pagination
    const authUser = await findUserByEmail(supabaseAdmin, normalizedEmail);
    
    // Check influencer row
    const { data: influencer } = await supabaseAdmin
      .from("influencers")
      .select("id, user_id, status, first_name, last_name, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    const diagnosis = {
      email: normalizedEmail,
      auth_user_exists: !!authUser,
      auth_user_id: authUser?.id || null,
      influencer_row_exists: !!influencer,
      influencer_id: influencer?.id || null,
      influencer_user_id: influencer?.user_id || null,
      influencer_status: influencer?.status || null,
      issues: [] as string[],
      repaired: false,
      repair_actions: [] as string[],
    };

    // Identify issues
    if (authUser && !influencer) {
      diagnosis.issues.push("GHOST_ACCOUNT: Auth user exists but no influencer row");
    }
    if (influencer && !influencer.user_id && authUser) {
      diagnosis.issues.push("UNLINKED: Influencer row exists but user_id is null (auth user found)");
    }
    if (influencer && influencer.user_id && !authUser) {
      diagnosis.issues.push("ORPHAN_INFLUENCER: Influencer has user_id but auth user not found");
    }
    if (!authUser && !influencer) {
      diagnosis.issues.push("NO_ACCOUNT: No auth user and no influencer found");
    }

    // Repair if requested
    if (repair && diagnosis.issues.length > 0) {
      // Get default commission plan
      const { data: defaultPlan } = await supabaseAdmin
        .from("commission_plans")
        .select("id")
        .eq("is_default", true)
        .maybeSingle();

      if (authUser && !influencer) {
        // Create missing influencer row
        const { data: newInfluencer, error: insertError } = await supabaseAdmin
          .from("influencers")
          .insert({
            user_id: authUser.id,
            email: normalizedEmail,
            first_name: authUser.user_metadata?.first_name || "Unknown",
            last_name: authUser.user_metadata?.last_name || "User",
            status: "pending",
            payout_method: "etransfer",
            payout_email: normalizedEmail,
            commission_plan_id: defaultPlan?.id || null,
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("[partner-account-diagnose] Repair insert error:", insertError);
          diagnosis.repair_actions.push(`FAILED: Could not create influencer row: ${insertError.message}`);
        } else {
          diagnosis.repaired = true;
          diagnosis.repair_actions.push(`CREATED: Influencer row ${newInfluencer.id} with status pending`);
          diagnosis.influencer_row_exists = true;
          diagnosis.influencer_id = newInfluencer.id;
        }
      }

      if (influencer && !influencer.user_id && authUser) {
        // Link influencer to auth user
        const { error: updateError } = await supabaseAdmin
          .from("influencers")
          .update({ user_id: authUser.id })
          .eq("id", influencer.id);

        if (updateError) {
          console.error("[partner-account-diagnose] Repair link error:", updateError);
          diagnosis.repair_actions.push(`FAILED: Could not link influencer: ${updateError.message}`);
        } else {
          diagnosis.repaired = true;
          diagnosis.repair_actions.push(`LINKED: Influencer ${influencer.id} now linked to auth user ${authUser.id}`);
          diagnosis.influencer_user_id = authUser.id;
        }
      }

      // Ensure user_roles entry exists with is_active = true
      if (authUser) {
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .upsert(
            { 
              user_id: authUser.id, 
              role: "influencer",
              is_active: true,
            }, 
            { onConflict: "user_id,role" }
          );
        
        if (roleError) {
          console.error("[partner-account-diagnose] Role upsert error:", roleError);
          diagnosis.repair_actions.push(`WARN: Could not ensure user_roles: ${roleError.message}`);
        } else {
          diagnosis.repair_actions.push("ENSURED: user_roles entry with is_active=true for influencer");
        }
      }
    }

    console.log(`[partner-account-diagnose] Result:`, diagnosis);

    return new Response(
      JSON.stringify(diagnosis),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Server error";
    console.error("[partner-account-diagnose] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
