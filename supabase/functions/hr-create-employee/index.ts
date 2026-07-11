import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";
import { employeeWelcome } from "../_shared/emailTemplates/onboarding.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

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
  roles: string[];
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

    const { data: adminRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .limit(1);

    if (!adminRoles?.length) {
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

    // ── Check if employee_records already exists for this email ──
    const { data: existingEmp } = await adminClient
      .from("employee_records")
      .select("id, employee_number")
      .eq("work_email", body.work_email.trim().toLowerCase())
      .limit(1);

    if (existingEmp?.length) {
      return new Response(
        JSON.stringify({ error: "Un dossier employé existe déjà pour cet email" }),
        { status: 200, headers }  // Return 200 so supabase.functions.invoke parses it
      );
    }

    // ── Step 1: Create or find auth user ──
    let userId: string;
    let isNewAuthUser = false;

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: body.work_email.trim().toLowerCase(),
      email_confirm: false,
      user_metadata: {
        full_name: `${body.first_name} ${body.last_name}`,
        is_employee: true,
      },
    });

    if (authError) {
      if (authError.message?.includes("already registered") || (authError as any).code === "email_exists") {
        // User exists in auth — look them up and link as employee
        console.log(`Auth user already exists for ${body.work_email}, linking as employee`);
        const { data: existingUsers, error: listErr } = await adminClient.auth.admin.listUsers({
          page: 1,
          perPage: 1,
        });
        
        // Use a more targeted approach - get by email
        const { data: userByEmail } = await adminClient
          .from("profiles")
          .select("user_id")
          .eq("email", body.work_email.trim().toLowerCase())
          .limit(1);

        if (!userByEmail?.length) {
          // Try auth admin API to find user
          // listUsers doesn't filter by email, so we search profiles
          // If not in profiles, check auth directly
          const allUsersResp = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=50`, {
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              apikey: supabaseServiceKey,
            },
          });
          const allUsersData = await allUsersResp.json();
          const foundUser = allUsersData?.users?.find(
            (u: any) => u.email?.toLowerCase() === body.work_email.trim().toLowerCase()
          );
          if (!foundUser) {
            return new Response(
              JSON.stringify({ error: "Utilisateur existant introuvable. Contactez le support." }),
              { status: 200, headers }
            );
          }
          userId = foundUser.id;
        } else {
          userId = userByEmail[0].user_id;
        }
      } else {
        console.error("Auth create error:", authError);
        return new Response(JSON.stringify({ error: authError.message }), { status: 200, headers });
      }
    } else {
      userId = authData.user!.id;
      isNewAuthUser = true;
      console.log(`Auth user created: ${userId} for ${body.work_email}`);
    }

    // ── Step 2: Update profile ──
    const { error: profileErr } = await adminClient
      .from("profiles")
      .update({
        first_name: body.first_name,
        last_name: body.last_name,
        full_name: `${body.first_name} ${body.last_name}`,
        phone: body.phone || null,
        department: body.department || null,
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
        work_email: body.work_email.trim().toLowerCase(),
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
      if (isNewAuthUser) {
        await adminClient.auth.admin.deleteUser(userId);
      }
      return new Response(
        JSON.stringify({ error: "Erreur création dossier employé: " + empErr.message }),
        { status: 200, headers }
      );
    }

    console.log(`Employee record created: ${empRecord.employee_number}`);

    // ── Step 4: Assign role (user_roles has UNIQUE(user_id) = one role per user) ──
    // Use the primary role: admin > employee > field_sales
    const primaryRole = body.roles.includes("admin")
      ? "admin"
      : body.roles.includes("employee")
        ? "employee"
        : body.roles[0];

    const portalAccess = {
      can_access_core: primaryRole === "admin",
      can_access_employee: ["employee", "admin"].includes(primaryRole),
      can_access_field: body.roles.includes("field_sales"),
      can_access_rh: true,
      require_onboarding: true,
    };

    // Try update first (row may exist from auth trigger), then insert
    const { data: existingRole } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (existingRole?.length) {
      const { error: roleErr } = await adminClient
        .from("user_roles")
        .update({ role: primaryRole, ...portalAccess })
        .eq("user_id", userId);
      if (roleErr) console.error("Role update error:", roleErr);
      else console.log(`Role updated to ${primaryRole} for ${userId}`);
    } else {
      const { error: roleErr } = await adminClient
        .from("user_roles")
        .insert({ user_id: userId, role: primaryRole, ...portalAccess });
      if (roleErr) console.error("Role insert error:", roleErr);
      else console.log(`Role inserted ${primaryRole} for ${userId}`);
    }

    // ── Step 5: Generate password setup link (auth invitation) ──
    // Use type=invite so Supabase issues a real "set password" flow on the
    // confirmation page. Capture the action_link and embed it in our branded
    // welcome email so the employee can activate their account in one click.
    const baseUrl = Deno.env.get("APP_BASE_URL") || "https://nivra-telecom.ca";
    let setupLink: string | undefined;

    const { data: linkData, error: inviteErr } = await adminClient.auth.admin.generateLink({
      type: isNewAuthUser ? "invite" : "magiclink",
      email: body.work_email.trim().toLowerCase(),
      options: {
        // CANONICAL: all internal staff land on the secure hub after activation
        redirectTo: `${baseUrl}/nivra-secure-hub-2617-internal`,
        data: {
          role: primaryRole,
          employee_id: empRecord.id,
          full_name: `${body.first_name} ${body.last_name}`,
        },
      },
    });

    if (inviteErr) {
      console.error("Invitation generation error:", inviteErr);
    } else {
      // properties.action_link is the URL that triggers the password-setup flow
      setupLink = (linkData as any)?.properties?.action_link
        || (linkData as any)?.action_link
        || undefined;
      console.log(`Setup link generated for ${body.work_email}: ${setupLink ? 'OK' : 'MISSING'}`);
    }

    const now = new Date().toISOString();
    await adminClient
      .from("employee_records")
      .update({ invitation_sent_at: now })
      .eq("id", empRecord.id);

    // ── Step 5b: Send branded employee welcome email (BIENVENUE) WITH setup link ──
    try {
      const hasEmployeePortal = (body.roles || []).some((r) =>
        ["admin", "employee", "supervisor", "sales", "kyc_agent", "billing_admin", "techops", "support"].includes(r)
      );
      const fullName = `${body.first_name} ${body.last_name}`.trim();
      const welcome = employeeWelcome({
        employeeName: fullName,
        employeeEmail: body.work_email.trim().toLowerCase(),
        jobTitle: body.job_title,
        department: body.department,
        hireDate: body.hire_date,
        hasEmployeePortal,
        setupLink,                       // ← password-setup magic link as primary CTA
        supportEmail: "support@nivra-telecom.ca",
      });

      const welcomeRes = await enqueueEmail({
        to: body.work_email.trim().toLowerCase(),
        templateKey: "employee_welcome",
        subject: welcome.subject,
        html: welcome.html,
        fromEmail: "Nivra RH <rh@nivra-telecom.ca>",
        replyTo: "support@nivra-telecom.ca",
        messageType: "employee_onboarding",
        entityType: "employee_record",
        entityId: empRecord.id,
        eventKey: `employee_welcome_${empRecord.id}`,
      });

      if (!welcomeRes?.success) {
        console.error("Employee welcome enqueue failed:", welcomeRes?.error);
      } else {
        console.log(`Employee welcome queued for ${body.work_email}: ${welcomeRes.id}`);
      }
    } catch (welcomeErr) {
      console.error("Employee welcome dispatch error:", welcomeErr);
      // Non-blocking
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
        linked_existing_user: !isNewAuthUser,
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
      { status: 200, headers: { ...getCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" } }
    );
  }
});
