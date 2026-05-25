// calls-account-actions — Phase 15
// Staff-only telephony actions for a client account.
// Actions:
//   - resolve_phone: returns canonical phone (E.164) from profiles
//   - list_recent: returns recent call logs (telephony_logs action=call) for the client
//   - initiate_call: logs an outbound call attempt and returns OpenPhone deep link
//   - log_manual_call: records a manual call entry (inbound/outbound) with disposition + notes
// All actions audited under account_ops.call_* in admin_audit_log.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  action: "resolve_phone" | "list_recent" | "initiate_call" | "log_manual_call";
  client_user_id: string;
  account_id?: string | null;
  phone?: string | null;
  direction?: "inbound" | "outbound";
  disposition?: string;
  duration_seconds?: number;
  notes?: string;
  reason?: string | null;
}

const DISPOSITIONS = [
  "answered",
  "voicemail",
  "no_answer",
  "busy",
  "wrong_number",
  "callback_requested",
  "resolved",
];

function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return null;
}

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

    const resolvePhone = async (): Promise<{ raw: string | null; e164: string | null }> => {
      if (body.phone) return { raw: body.phone, e164: toE164(body.phone) };
      const { data } = await admin
        .from("profiles")
        .select("phone, phone_e164, full_name")
        .eq("user_id", body.client_user_id)
        .maybeSingle();
      const raw = data?.phone_e164 || data?.phone || null;
      return { raw, e164: toE164(raw) };
    };

    const getClientName = async (): Promise<string | null> => {
      const { data } = await admin
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", body.client_user_id)
        .maybeSingle();
      return data?.full_name || data?.email || null;
    };

    switch (body.action) {
      case "resolve_phone": {
        const { raw, e164 } = await resolvePhone();
        return json({ ok: true, phone_raw: raw, phone_e164: e164, dispositions: DISPOSITIONS });
      }

      case "list_recent": {
        const { data, error } = await admin
          .from("telephony_logs")
          .select("id, phone_number, action, direction, status, agent_name, message_preview, created_at")
          .eq("client_id", body.client_user_id)
          .eq("action", "call")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        return json({ ok: true, logs: data ?? [] });
      }

      case "initiate_call": {
        const { raw, e164 } = await resolvePhone();
        if (!e164) return json({ error: "Aucun téléphone valide pour ce client" }, 400);
        const clientName = await getClientName();

        const { data: log } = await admin
          .from("telephony_logs")
          .insert({
            client_id: body.client_user_id,
            phone_number: e164,
            action: "call",
            direction: "outbound",
            agent_user_id: userData.user.id,
            agent_name: userData.user.email,
            status: "initiated",
            client_name: clientName,
          })
          .select("id")
          .single();

        await admin.from("admin_audit_log").insert({
          admin_user_id: userData.user.id,
          admin_email: userData.user.email,
          action: "account_ops.call_initiated",
          target_type: "user",
          target_id: body.client_user_id,
          details: {
            phone_e164: e164,
            phone_raw: raw,
            account_id: body.account_id ?? null,
            reason: body.reason ?? null,
            log_id: log?.id ?? null,
          },
        });

        const cleanNumber = e164.replace(/\D/g, "");
        return json({
          ok: true,
          phone_e164: e164,
          deep_link: `openphone://call?number=${cleanNumber}`,
          web_link: `https://my.openphone.com/?number=${encodeURIComponent(e164)}`,
          tel_link: `tel:${e164}`,
          log_id: log?.id ?? null,
        });
      }

      case "log_manual_call": {
        const { raw, e164 } = await resolvePhone();
        const phone = e164 || raw || "unknown";
        const direction = body.direction === "inbound" ? "inbound" : "outbound";
        const disposition = body.disposition && DISPOSITIONS.includes(body.disposition)
          ? body.disposition
          : "answered";
        const clientName = await getClientName();
        const preview = (body.notes ?? "").slice(0, 240);

        const { data: log, error } = await admin
          .from("telephony_logs")
          .insert({
            client_id: body.client_user_id,
            phone_number: phone,
            action: "call",
            direction,
            agent_user_id: userData.user.id,
            agent_name: userData.user.email,
            status: disposition,
            client_name: clientName,
            message_preview: preview || null,
          })
          .select("id")
          .single();
        if (error) throw error;

        await admin.from("admin_audit_log").insert({
          admin_user_id: userData.user.id,
          admin_email: userData.user.email,
          action: "account_ops.call_logged",
          target_type: "user",
          target_id: body.client_user_id,
          details: {
            phone_e164: e164,
            account_id: body.account_id ?? null,
            direction,
            disposition,
            duration_seconds: body.duration_seconds ?? null,
            reason: body.reason ?? null,
            log_id: log?.id ?? null,
            preview,
          },
        });

        return json({ ok: true, log_id: log?.id ?? null });
      }

      default:
        return json({ error: `unknown action: ${body.action}` }, 400);
    }
  } catch (e) {
    // Log full error server-side, return generic message to client to avoid
    // leaking stack traces, SQL errors, or other internal details.
    console.error("calls-account-actions error", e);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
