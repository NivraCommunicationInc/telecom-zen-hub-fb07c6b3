// Public submission of employee onboarding form.
// Anonymous endpoint guarded by the secret token in the request body.
import { createClient } from "npm:@supabase/supabase-js@2";
import { reportEdgeError } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const form = await req.formData();
    const token = String(form.get("token") || "");
    const payloadRaw = String(form.get("payload") || "{}");
    let payload: any;
    try { payload = JSON.parse(payloadRaw); } catch (_e) { payload = {}; }

    if (!token) {
      return new Response(JSON.stringify({ error: "missing_token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing, error: lookupErr } = await supabase
      .from("employee_onboarding_forms")
      .select("id, applicant_id, status, token_expires_at, email")
      .eq("token", token)
      .maybeSingle();

    if (lookupErr) throw lookupErr;
    if (!existing) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(existing.token_expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "expired" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (existing.status === "submitted" || existing.status === "reviewed") {
      return new Response(JSON.stringify({ error: "already_submitted" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload files
    const uploads: Record<string, string> = {};
    const fileFields = ["id_document", "work_permit", "void_cheque"] as const;
    for (const field of fileFields) {
      const file = form.get(field) as File | null;
      if (!file || typeof file === "string" || file.size === 0) continue;
      if (file.size > 10 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: `file_too_large_${field}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const allowed = ["image/jpeg", "image/png", "application/pdf"];
      if (!allowed.includes(file.type)) {
        return new Response(JSON.stringify({ error: `invalid_type_${field}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ext = file.type === "application/pdf" ? "pdf" : (file.type === "image/png" ? "png" : "jpg");
      const path = `${existing.applicant_id}/${field}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("employee-documents")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      uploads[`${field}_path`] = path;
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const nowIso = new Date().toISOString();

    const updateRow: Record<string, unknown> = {
      full_legal_name: payload.full_legal_name ?? null,
      date_of_birth: payload.date_of_birth ?? null,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      address_street: payload.address_street ?? null,
      address_city: payload.address_city ?? null,
      address_province: payload.address_province ?? null,
      address_postal: payload.address_postal ?? null,
      residential_status: payload.residential_status ?? null,
      residential_status_other: payload.residential_status_other ?? null,
      id_document_type: payload.id_document_type ?? null,
      bank_account_name: payload.bank_account_name ?? null,
      signature_data: payload.signature_data ?? null,
      signature_ip: ip,
      signed_at: nowIso,
      submitted_at: nowIso,
      status: "submitted",
      ...uploads,
    };

    const { error: updErr } = await supabase
      .from("employee_onboarding_forms")
      .update(updateRow)
      .eq("token", token);
    if (updErr) throw updErr;

    // Mark applicant as hired
    if (existing.applicant_id) {
      await supabase
        .from("job_applicants")
        .update({ status: "hired", hired_at: nowIso })
        .eq("id", existing.applicant_id);
    }

    // Notify admin
    await supabase.from("email_queue").insert({
      event_key: `onboarding_submit_admin_${existing.id}_${Date.now()}`,
      to_email: "support@nivra-telecom.ca",
      template_key: "onboarding_form_submitted_admin",
      template_vars: {
        full_legal_name: payload.full_legal_name,
        email: payload.email,
        phone: payload.phone,
        address_street: payload.address_street,
        address_city: payload.address_city,
        address_province: payload.address_province,
        address_postal: payload.address_postal,
        residential_status: payload.residential_status,
      },
      language: "fr",
      status: "queued",
    });

    // Confirmation to employee
    if (payload.email) {
      await supabase.from("email_queue").insert({
        event_key: `onboarding_confirm_${existing.id}_${Date.now()}`,
        to_email: payload.email,
        template_key: "onboarding_form_confirmation_employee",
        template_vars: {
          first_name: (payload.full_legal_name || "").split(" ")[0] || "",
        },
        language: payload.language || "fr",
        status: "queued",
      });
      await supabase.from("applicant_emails").insert({
        applicant_id: existing.applicant_id,
        email_type: "onboarding_confirmation",
        sent_to: payload.email,
        status: "queued",
        subject: "Votre dossier est bien reçu — Nivra Telecom",
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("onboarding-form-submit error", e);
    reportEdgeError(e, { function: "onboarding-form-submit" }).catch(() => {});
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
