import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

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

  // Called from public checkout (GuestCheckout) and internal agents.
  // Auth: accept service role, AGENT_SECRET, or any authenticated/anon key (checkout use case).

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

    // Step 1: Match by email first, then by normalized phone (anti-duplicate).
    const normalizePhone = (p?: string | null): string | null => {
      if (!p) return null;
      const digits = String(p).replace(/\D+/g, "");
      // strip leading country code 1 for NA numbers so 5145551234 == 15145551234
      const trimmed = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
      return trimmed.length >= 10 ? trimmed.slice(-10) : (trimmed || null);
    };
    const inputPhoneNorm = normalizePhone(body.phone);

    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    let existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === email
    );

    let phoneMatchDifferentEmail: { matchedEmail: string } | null = null;

    if (!existingUser && inputPhoneNorm) {
      // Look up profiles by normalized phone
      const { data: phoneRows } = await supabase
        .from("profiles")
        .select("user_id, email, phone")
        .not("phone", "is", null);
      const match = (phoneRows || []).find(r => normalizePhone(r.phone) === inputPhoneNorm);
      if (match?.user_id) {
        const matchedAuth = existingUsers?.users?.find(u => u.id === match.user_id);
        existingUser = matchedAuth;
        phoneMatchDifferentEmail = { matchedEmail: matchedAuth?.email || match.email || "(inconnu)" };
        console.log(`[auto-create-client-account] Phone match found, different email: ${email} vs ${phoneMatchDifferentEmail.matchedEmail}`);
      }
    }

    let userId: string;
    let isNewAccount = false;

    if (existingUser) {
      userId = existingUser.id;
      console.log(`[auto-create-client-account] User already exists: ${userId}`);
    } else {
      // Step 2: Create new auth user with a random password
      const tempPassword = crypto.randomUUID() + "Aa1!";
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
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

    // If we linked by phone with a different email, log an auto-note + activity alert
    if (phoneMatchDifferentEmail) {
      try {
        const noteBody = `Commande liée par correspondance téléphone — email fourni différent : ${email} vs ${phoneMatchDifferentEmail.matchedEmail}. Vérification agent requise.`;
        await supabase.from("client_internal_notes").insert({
          client_id: userId,
          author_name: "Système Nivra",
          author_role: "system",
          note: noteBody,
          category: "identity",
        });
        await supabase.from("activity_logs").insert({
          entity_id: userId,
          entity_type: "client",
          action: noteBody,
          actor_name: "Système Nivra",
          actor_role: "system",
        });
      } catch (e) {
        console.warn("[auto-create-client-account] phone-match note failed:", e);
      }
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

    // Schedule NPS survey for J+7 via email_queue trigger (non-blocking)
    try {
      const { error: npsError } = await enqueueCommunication(supabase, {
      channel: "email",
      recipient: email,
      templateKey: "nps_survey_scheduled",
      scheduledFor: new Date(Date.now() + 7 * 86400_000).toISOString(),
      idempotencyKey: `auto-create:nps_schedule:${userId}:${body.order_id ?? "no-order"}`,
      templateVars: { first_name: body.first_name, days: 7, order_id: body.order_id || null },
    });
      if (npsError) console.warn("[auto-create-client-account] NPS queue skipped:", npsError);
    } catch (npsErr) {
      console.warn("[auto-create-client-account] NPS queue skipped:", npsErr);
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

  } catch (error) {
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
