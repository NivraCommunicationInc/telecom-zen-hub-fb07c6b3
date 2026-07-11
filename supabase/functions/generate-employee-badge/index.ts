// generate-employee-badge — returns badge data per employee profile.
// Produces: bilingual badge metadata, Apple Wallet pass.json structure,
// Google Wallet generic-pass JSON, and an enqueue option for the
// "employee_badge_ready" email.
import { createClient } from "npm:@supabase/supabase-js@2";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "field_sales" | "employee" | "technician" | "admin" | "hr";

const BADGE_ROLES: Record<string, {
  title_fr: string; title_en: string;
  dept_fr: string; dept_en: string;
  color: string; prefix: string;
}> = {
  field_sales: { title_fr: "Agent Terrain", title_en: "Field Sales Agent", dept_fr: "Vente Porte-à-Porte", dept_en: "Door-to-Door Sales", color: "#7C3AED", prefix: "AF" },
  employee:    { title_fr: "Service à la Clientèle", title_en: "Customer Service", dept_fr: "Service Client", dept_en: "Customer Service", color: "#2563EB", prefix: "CS" },
  technician:  { title_fr: "Technicien d'Installation", title_en: "Installation Technician", dept_fr: "Opérations Terrain", dept_en: "Field Operations", color: "#059669", prefix: "TC" },
  admin:       { title_fr: "Administration", title_en: "Administration", dept_fr: "Direction", dept_en: "Management", color: "#DC2626", prefix: "AD" },
  hr:          { title_fr: "Ressources Humaines", title_en: "Human Resources", dept_fr: "RH & Paie", dept_en: "HR & Payroll", color: "#D97706", prefix: "HR" },
};

function getBadgeInfo(role: string) {
  return BADGE_ROLES[role] ?? BADGE_ROLES.employee;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticated client for caller identity
    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestedUserId: string | undefined = body?.target_user_id;
    const sendEmail = body?.send_email === true;

    // Service-role client for joined reads
    const admin = createClient(url, serviceKey);

    // Determine effective target user: only admin/hr may target other users
    let targetUserId = user.id;
    if (requestedUserId && requestedUserId !== user.id) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true);
      const callerRoles = (roles ?? []).map((r: any) => r.role);
      if (!callerRoles.includes("admin")) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetUserId = requestedUserId;
    }

    // Profile
    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("user_id, full_name, agent_number, professional_email, email, preferred_language")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (pErr || !profile) {
      return new Response(JSON.stringify({ error: "profile_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Role
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId)
      .eq("is_active", true);
    const roles = (roleRows ?? []).map((r: any) => r.role as Role);
    const primaryRole: Role =
      (["admin", "hr", "technician", "field_sales", "employee"] as Role[])
        .find((r) => roles.includes(r)) ?? "employee";
    const info = getBadgeInfo(primaryRole);

    const fullName = profile.full_name || profile.email || "Employé Nivra";
    const agentNumber = profile.agent_number || `${info.prefix}-NEW`;
    const supportEmail = "support@nivra-telecom.ca";
    const websiteUrl = "https://nivra-telecom.ca";
    const qrPayload = `${websiteUrl}?ref=badge&agent=${encodeURIComponent(agentNumber)}`;

    const badge = {
      target_user_id: targetUserId,
      full_name: fullName,
      agent_number: agentNumber,
      role: primaryRole,
      role_title_fr: info.title_fr,
      role_title_en: info.title_en,
      dept_fr: info.dept_fr,
      dept_en: info.dept_en,
      color: info.color,
      prefix: info.prefix,
      support_email: supportEmail,
      website_url: websiteUrl,
      qr_payload: qrPayload,
      preferred_language: profile.preferred_language || "fr",
    };

    // Apple Wallet pass.json (unsigned)
    const colorRgb = hexToRgbString(info.color);
    const applePassJson = {
      formatVersion: 1,
      passTypeIdentifier: "pass.ca.nivra-telecom.employee",
      serialNumber: agentNumber,
      teamIdentifier: "TEAM_ID",
      organizationName: "Nivra Communication Inc.",
      description: "Badge employé Nivra",
      backgroundColor: colorRgb,
      foregroundColor: "rgb(255,255,255)",
      labelColor: "rgb(255,255,255)",
      generic: {
        primaryFields: [{ key: "name", label: "NOM / NAME", value: fullName }],
        secondaryFields: [
          { key: "role", label: "RÔLE / ROLE", value: info.title_fr },
          { key: "badge", label: "BADGE", value: agentNumber },
        ],
        auxiliaryFields: [{ key: "dept", label: "DÉPARTEMENT", value: info.dept_fr }],
        backFields: [
          { key: "email", label: "COURRIEL SUPPORT", value: supportEmail },
          { key: "website", label: "SITE WEB", value: websiteUrl },
        ],
      },
      barcode: {
        message: qrPayload,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
      },
    };

    // Google Wallet generic pass payload (unsigned JWT body)
    const googleWalletJson = {
      iss: "service_account_email@nivra.iam.gserviceaccount.com",
      aud: "google",
      typ: "savetowallet",
      payload: {
        genericObjects: [{
          id: `ISSUER_ID.${agentNumber}`,
          classId: "ISSUER_ID.nivra_employee",
          genericType: "GENERIC_TYPE_UNSPECIFIED",
          backgroundColor: { hexBackgroundColor: info.color },
          header: { defaultValue: { language: "fr", value: fullName } },
          subheader: { defaultValue: { language: "fr", value: info.title_fr } },
          cardTitle: { defaultValue: { language: "fr", value: "Nivra Telecom" } },
          textModulesData: [
            { header: "BADGE", body: agentNumber },
            { header: "DÉPARTEMENT", body: info.dept_fr },
            { header: "COURRIEL", body: supportEmail },
          ],
          barcode: { type: "QR_CODE", value: qrPayload },
        }],
      },
    };

    // Optional: enqueue badge-ready email
    let emailQueued = false;
    if (sendEmail) {
      const recipient = profile.professional_email || profile.email;
      if (recipient) {
        let qErr: any = null;
        try { await enqueueCommunication({
          channel: "email",
          templateKey: "employee_badge_ready",
          recipient: recipient,
          idempotencyKey: `employee_badge_${targetUserId}_${Date.now()}`,
          templateVars: { client_name: fullName,
            full_name: fullName,
            agent_number: agentNumber,
            role_title: info.title_fr,
            role_title_en: info.title_en,
            dept: info.dept_fr,
            color: info.color,
            portal_url: primaryRole === "field_sales" ? "https://nivra-telecom.ca/field" : "https://nivra-telecom.ca/hr", language: profile.preferred_language || "fr" },
        }); } catch (__e) { qErr = __e; }
        emailQueued = !qErr;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      badge,
      apple_wallet: applePassJson,
      google_wallet: googleWalletJson,
      email_queued: emailQueued,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function hexToRgbString(hex: string): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgb(${r},${g},${b})`;
}
