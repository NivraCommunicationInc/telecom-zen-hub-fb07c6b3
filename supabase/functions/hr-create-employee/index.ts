import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface CreateEmployeeRequest {
  first_name: string;
  last_name: string;
  work_email: string;
  phone?: string;
  department?: string;
  job_title?: string;
  employment_type: string;
  hire_date?: string;
  salary_type: string;
  hourly_rate?: number;
  base_salary?: number;
  commission_enabled?: boolean;
  payment_method?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  roles: string[]; // e.g. ["employee"], ["field_sales"], ["employee","field_sales"]
  notes?: string;
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Verify caller is admin ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers });
    }

    // Must be admin
    const { data: adminRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .limit(1);

    if (!adminRoles?.length) {
      // Fallback admin_users
      const { data: au } = await adminClient
        .from("admin_users")
        .select("id")
        .eq("user_id", caller.id)
        .eq("is_active", true)
        .limit(1);
      if (!au?.length) {
        return new Response(JSON.stringify({ error: "Accès admin requis" }), { status: 403, headers });
      }
    }

    // ── Parse & validate body ──
    const body: CreateEmployeeRequest = await req.json();

    if (!body.first_name?.trim() || !body.last_name?.trim() || !body.work_email?.trim()) {
      return new Response(
        JSON.stringify({ error: "Prénom, nom et email professionnel requis" }),
        { status: 400, headers }
      );
    }

    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!emailRegex.test(body.work_email)) {
      return new Response(JSON.stringify({ error: "Format email invalide" }), { status: 400, headers });
    }

    if (!body.roles?.length) {
      return new Response(
        JSON.stringify({ error: "Au moins un rôle est requis" }),
        { status: 400, headers }
      );
    }

    const validRoles = ["employee", "field_sales", "admin"];
    for (const r of body.roles) {
      if (!validRoles.includes(r)) {
        return new Response(
          JSON.stringify({ error: `Rôle invalide: ${r}` }),
          { status: 400, headers }
        );
      }
    }

    // ── Step 1: Create auth user with invite (magic link) ──
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: body.work_email,
      email_confirm: false, // They must confirm via invitation link
      user_metadata: {
        full_name: `${body.first_name} ${body.last_name}`,
        is_employee: true,
      },
    });

    if (authError) {
      console.error("Auth create error:", authError);
      if (authError.message?.includes("already registered") || authError.message?.includes("duplicate")) {
        return new Response(
          JSON.stringify({ error: "Un utilisateur avec cet email existe déjà" }),
          { status: 409, headers }
        );
      }
      return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers });
    }

    const userId = authData.user!.id;
    console.log(`Auth user created: ${userId} for ${body.work_email}`);

    // ── Step 2: Update profile ──
    const { error: profileErr } = await adminClient
      .from("profiles")
      .update({
        first_name: body.first_name,
        last_name: body.last_name,
        full_name: `${body.first_name} ${body.last_name}`,
        phone: body.phone || null,
        department: body.department || null,
        employee_number: null, // Will be set from employee_records trigger
      })
      .eq("user_id", userId);

    if (profileErr) console.error("Profile update error:", profileErr);

    // ── Step 3: Create employee_records ──
    const { data: empRecord, error: empErr } = await adminClient
      .from("employee_records")
      .insert({
        user_id: userId,
        first_name: body.first_name,
        last_name: body.last_name,
        work_email: body.work_email,
        phone: body.phone || null,
        department: body.department || null,
        job_title: body.job_title || null,
        employment_type: body.employment_type || "full_time",
        hire_date: body.hire_date || null,
        salary_type: body.salary_type || "hourly",
        hourly_rate: body.hourly_rate || null,
        base_salary: body.base_salary || null,
        commission_enabled: body.commission_enabled ?? false,
        payment_method: body.payment_method || "direct_deposit",
        emergency_contact_name: body.emergency_contact_name || null,
        emergency_contact_phone: body.emergency_contact_phone || null,
        emergency_contact_relation: body.emergency_contact_relation || null,
        notes: body.notes || null,
        status: "pending_invitation",
        created_by: caller.id,
      })
      .select("id, employee_number")
      .single();

    if (empErr) {
      console.error("Employee record create error:", empErr);
      // Rollback: delete auth user
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Erreur création dossier employé: " + empErr.message }),
        { status: 500, headers }
      );
    }

    console.log(`Employee record created: ${empRecord.employee_number}`);

    // ── Step 4: Assign roles ──
    const roleInserts = body.roles.map((role) => ({
      user_id: userId,
      role,
    }));

    const { error: rolesErr } = await adminClient.from("user_roles").insert(roleInserts);
    if (rolesErr) {
      console.error("Roles insert error:", rolesErr);
      // Non-fatal, log but continue
    }

    // ── Step 5: Send invitation email (magic link) ──
    const { error: inviteErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: body.work_email,
      options: {
        redirectTo: `${Deno.env.get("APP_BASE_URL") || "https://telecom-zen-hub.lovable.app"}/hub`,
      },
    });

    // Update invitation_sent_at
    const now = new Date().toISOString();
    await adminClient
      .from("employee_records")
      .update({ invitation_sent_at: now })
      .eq("id", empRecord.id);

    if (inviteErr) {
      console.error("Invitation generation error:", inviteErr);
      // Non-fatal — employee is created, invitation can be resent
    }

    // ── Step 6: Audit log ──
    await adminClient.from("activity_logs").insert({
      user_id: caller.id,
      entity_type: "employee",
      entity_id: empRecord.id,
      action: "create_employee",
      new_value: JSON.stringify({
        employee_number: empRecord.employee_number,
        email: body.work_email,
        name: `${body.first_name} ${body.last_name}`,
        roles: body.roles,
      }),
      reason: "Nouvel employé créé via HR & Payroll",
      actor_email: caller.email,
      actor_role: "admin",
    });

    return new Response(
      JSON.stringify({
        success: true,
        employee: {
          id: empRecord.id,
          user_id: userId,
          employee_number: empRecord.employee_number,
          email: body.work_email,
        },
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur serveur inattendue" }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" } }
    );
  }
});
