// sms-account-actions — Phase 14
// Staff-only SMS communication with a client account.
// Actions:
//   - list_recent: returns recent SMS exchanges from telephony_logs for the client
//   - send_sms: sends an outbound SMS via OpenPhone (sendSmsNotification)
//   - resolve_phone: returns the canonical phone for the client from profiles
// Every send is logged in admin_audit_log under account_ops.sms_send.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendSmsNotification, toE164 } from "../_shared/smsHelper.ts";

interface Body {
  action: "list_recent" | "send_sms" | "resolve_phone";
  client_user_id: string;
  account_id?: string | null;
  phone?: string | null;
  message?: string;
  template_key?: string;
  reason?: string | null;
}

const TEMPLATES: Record<string, { label: string; body: string }> = {
  custom: { label: "Message personnalisé", body: "" },
  payment_reminder: {
    label: "Rappel de paiement",
    body: "Nivra : un solde est en attente sur votre compte. Connectez-vous à votre espace client pour régulariser. Merci.",
  },
  appointment_reminder: {
    label: "Rappel de rendez-vous",
    body: "Nivra : rappel de votre rendez-vous prévu. Si besoin de modifier, répondez à ce message ou contactez-nous par courriel.",
  },
  callback_request: {
    label: "Demande de rappel",
    body: "Nivra : notre équipe a tenté de vous joindre. Pourriez-vous nous répondre ou nous écrire à support@nivra-telecom.ca ?",
  },
  service_update: {
    label: "Mise à jour de service",
    body: "Nivra : une mise à jour concerne votre service. Consultez votre espace client ou répondez à ce message pour plus d'informations.",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: isStaff } = await admin.rpc("has_staff_role", { _user_id: userData.user.id });
    if (isStaff !== true) return json({ error: "forbidden" }, 403);

    const body = (await req.json()) as Body;
    if (!body?.client_user_id || !body?.action) {
      return json({ error: "client_user_id and action required" }, 400);
    }

    const resolvePhone = async (): Promise<string | null> => {
      if (body.phone) return body.phone;
      const { data } = await admin
        .from("profiles")
        .select("phone, phone_e164")
        .eq("user_id", body.client_user_id)
        .maybeSingle();
      return data?.phone_e164 || data?.phone || null;
    };

    switch (body.action) {
      case "resolve_phone": {
        const raw = await resolvePhone();
        const e164 = raw ? toE164(raw) : null;
        return json({
          ok: true,
          templates: Object.entries(TEMPLATES).map(([key, t]) => ({ key, label: t.label, body: t.body })),
          phone_raw: raw,
          phone_e164: e164,
        });
      }

      case "list_recent": {
        const { data, error } = await admin
          .from("telephony_logs")
          .select("id, phone_number, action, direction, message_preview, status, agent_name, created_at")
          .eq("client_id", body.client_user_id)
          .eq("action", "sms")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return json({ ok: true, logs: data ?? [] });
      }

      case "send_sms": {
        const raw = await resolvePhone();
        if (!raw) return json({ error: "Aucun téléphone enregistré pour ce client" }, 400);
        const e164 = toE164(raw);
        if (!e164) return json({ error: "Numéro invalide (format E.164 requis)" }, 400);

        const tplKey = body.template_key && TEMPLATES[body.template_key] ? body.template_key : "custom";
        const text = (body.message?.trim() || TEMPLATES[tplKey].body).slice(0, 480);
        if (!text) return json({ error: "Le message est requis" }, 400);

        const eventKey = `account_ops.sms.${body.client_user_id}.${Date.now()}`;
        const result = await sendSmsNotification({
          to: e164,
          message: text,
          clientId: body.client_user_id,
          eventType: `account_ops.${tplKey}`,
          eventKey,
        });

        await admin.from("admin_audit_log").insert({
          admin_user_id: userData.user.id,
          admin_email: userData.user.email,
          action: `account_ops.sms_send`,
          target_type: "user",
          target_id: body.client_user_id,
          details: {
            template_key: tplKey,
            phone_e164: e164,
            preview: text.slice(0, 160),
            account_id: body.account_id ?? null,
            reason: body.reason ?? null,
            result,
          },
        });

        if (!result.success && !result.skipped) {
          return json({ error: result.error ?? "send_failed", result }, 500);
        }
        return json({ ok: true, result });
      }

      default:
        return json({ error: `unknown action: ${body.action}` }, 400);
    }
  } catch (e) {
    console.error("sms-account-actions error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
