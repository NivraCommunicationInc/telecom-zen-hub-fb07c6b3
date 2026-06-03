import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * AUTO-CREATE CLIENT ACCOUNT
 * 
 * Creates a Supabase Auth account for a client if they don't have one,
 * creates/updates their profile, and sends a "set password" email.
 * 
 * Called after order creation to ensure every order is linked to an account.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateAccountRequest {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  order_id?: string;
  order_number?: string;
  service_address?: string;
  service_city?: string;
  service_postal_code?: string;
  date_of_birth?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Internal-only: require service role or AGENT_SECRET — not callable by end users
  const _auth = req.headers.get("Authorization") ?? "";
  const _svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const _agentSecret = Deno.env.get("AGENT_SECRET");
  if (_auth !== `Bearer ${_svcKey}` && (!_agentSecret || _auth !== `Bearer ${_agentSecret}`)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const body: CreateAccountRequest = await req.json();
    
    if (!body.email) {
      throw new Error("Email is required");
    }

    const email = body.email.trim().toLowerCase();
    console.log(`[auto-create-client-account] Processing: ${email}`);

    // Step 1: Check if auth user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === email
    );

    let userId: string;
    let isNewAccount = false;

    if (existingUser) {
      userId = existingUser.id;
      console.log(`[auto-create-client-account] User already exists: ${userId}`);
    } else {
      // Step 2: Create new auth user with a random password
      // User will reset via email
      const tempPassword = crypto.randomUUID() + "Aa1!"; // Meets password requirements
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: body.first_name,
          last_name: body.last_name,
          full_name: `${body.first_name} ${body.last_name}`.trim(),
        }
      });

      if (createError) {
        console.error(`[auto-create-client-account] Create user error:`, createError);
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      userId = newUser.user.id;
      isNewAccount = true;
      console.log(`[auto-create-client-account] Created new user: ${userId}`);
    }

    // Step 3: Ensure profile exists and is updated
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, user_id")
      .eq("user_id", userId)
      .single();

    if (!existingProfile) {
      // Create profile
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          user_id: userId,
          email,
          first_name: body.first_name,
          last_name: body.last_name,
          full_name: `${body.first_name} ${body.last_name}`.trim(),
          phone: body.phone,
          service_address: body.service_address,
          service_city: body.service_city,
          service_postal_code: body.service_postal_code,
          date_of_birth: body.date_of_birth || null,
          dob_locked: true,
        });

      if (profileError && !profileError.message.includes("duplicate")) {
        console.error(`[auto-create-client-account] Profile create error:`, profileError);
      } else {
        console.log(`[auto-create-client-account] Created profile for: ${userId}`);
      }
    } else {
      // Update profile with any missing data
      // ★ FIX #1/#10: Backfill DOB on profile UPDATE branch if missing.
      // Previously DOB was only set on profile INSERT, causing 94% of orders to
      // have NULL client_dob when the profile already existed.
      const updatePayload: Record<string, unknown> = {
        first_name: body.first_name,
        last_name: body.last_name,
        full_name: `${body.first_name} ${body.last_name}`.trim(),
        phone: body.phone || undefined,
        service_address: body.service_address || undefined,
        service_city: body.service_city || undefined,
        service_postal_code: body.service_postal_code || undefined,
        updated_at: new Date().toISOString(),
      };
      if (body.date_of_birth) {
        // Re-fetch to avoid overwriting an existing locked DOB
        const { data: dobRow } = await supabase
          .from("profiles")
          .select("date_of_birth")
          .eq("user_id", userId)
          .maybeSingle();
        if (!dobRow?.date_of_birth) {
          updatePayload.date_of_birth = body.date_of_birth;
          updatePayload.dob_locked = true;
        }
      }
      await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("user_id", userId);
    }

    // Step 4: Ensure client role exists
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({
        user_id: userId,
        role: "client",
        status: "active",
        is_active: true,
      }, {
        onConflict: "user_id,role"
      });

    if (roleError) {
      console.error(`[auto-create-client-account] Role upsert error:`, roleError);
    }

    // Step 5: Link order to user if order_id provided
    if (body.order_id) {
      await supabase
        .from("orders")
        .update({ user_id: userId })
        .eq("id", body.order_id)
        .is("user_id", null); // Only update if not already linked
    }

    // Emails are intentionally not sent here. The canonical order sync sends
    // them in the correct order after the order/invoice/documents exist.

    console.log(`[auto-create-client-account] Complete: userId=${userId}, isNew=${isNewAccount}`);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        is_new_account: isNewAccount,
        email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[auto-create-client-account] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
