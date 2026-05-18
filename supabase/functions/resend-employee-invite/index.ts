import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";
import { employeeWelcome } from "../_shared/emailTemplates/onboarding.ts";

interface Body {
  employee_id: string;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

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
      .from("user_roles").select("role")
      .eq("user_id", caller.id).eq("role", "admin").limit(1);
    if (!adminRoles?.length) {
      const { data: au } = await adminClient
        .from("admin_users").select("id")
        .eq("user_id", caller.id).eq("is_active", true).limit(1);
      if (!au?.length) {
        return new Response(JSON.stringify({ error: "Accès admin requis" }), { status: 403, headers });
      }
    }

    // ── Body ──
    const body: Body = await req.json();
    if (!body.employee_id) {
      return new Response(JSON.stringify({ error: "employee_id requis" }), { status: 400, headers });
    }

    // ── Fetch employee ──
    const { data: emp, error: empErr } = await adminClient
      .from("employee_records")
      .select("id, first_name, last_name, work_email, job_title, department, hire_date, user_id")
      .eq("id", body.employee_id)
      .maybeSingle();

    if (empErr || !emp) {
      return new Response(JSON.stringify({ error: "Employé introuvable" }), { status: 404, headers });
    }
    if (!emp.work_email) {
      return new Response(JSON.stringify({ error: "Aucun email pour cet employé" }), { status: 400, headers });
    }

    const email = emp.work_email.trim().toLowerCase();
    const baseUrl = Deno.env.get("APP_BASE_URL") || "https://nivra-telecom.ca";

    // ── Determine if auth user already exists for this email ──
    let isNewAuthUser = !emp.user_id;
    if (!emp.user_id) {
      const { data: existing } = await adminClient.auth.admin.listUsers();
      const found = existing?.users?.find((u: any) => u.email?.toLowerCase() === email);
      if (found) {
        isNewAuthUser = false;
        // backfill user_id link
        await adminClient
          .from("employee_records")
          .update({ user_id: found.id })
          .eq("id", emp.id);
      }
    }

    // ── Generate set-password / magic link ──
    let setupLink: string | undefined;
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: isNewAuthUser ? "invite" : "magiclink",
      email,
      options: {
        // CANONICAL: all internal staff land on the secure hub after activation
        redirectTo: `${baseUrl}/nivra-secure-hub-2617-internal`,
        data: { employee_id: emp.id, full_name: `${emp.first_name} ${emp.last_name}` },
      },
    });
    if (linkErr) {
      console.error("generateLink error:", linkErr);
    } else {
      setupLink = (linkData as any)?.properties?.action_link
        || (linkData as any)?.action_link
        || undefined;
    }

    // ── Send branded welcome email ──
    const fullName = `${emp.first_name} ${emp.last_name}`.trim();
    const welcome = employeeWelcome({
      employeeName: fullName,
      employeeEmail: email,
      jobTitle: emp.job_title ?? undefined,
      department: emp.department ?? undefined,
      hireDate: emp.hire_date ?? undefined,
      hasEmployeePortal: true,
      setupLink,
      supportEmail: "support@nivra-telecom.ca",
    });

    await enqueueEmail({
      to: email,
      templateKey: "employee_welcome",
      subject: welcome.subject,
      html: welcome.html,
      fromEmail: "Nivra RH <rh@nivra-telecom.ca>",
      replyTo: "support@nivra-telecom.ca",
    });

    // ── Update record ──
    const now = new Date().toISOString();
    await adminClient
      .from("employee_records")
      .update({ invitation_sent_at: now, status: "pending_invitation" })
      .eq("id", emp.id);

    return new Response(
      JSON.stringify({ success: true, email, setup_link_generated: !!setupLink }),
      { status: 200, headers },
    );
  } catch (err) {
    console.error("resend-employee-invite error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Erreur serveur" }),
      { status: 500, headers },
    );
  }
});
