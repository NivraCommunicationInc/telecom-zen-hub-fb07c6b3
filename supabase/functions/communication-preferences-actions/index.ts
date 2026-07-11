// communication-preferences-actions — Phase 16
// Staff-only: read/update client communication preferences
// (email categories, SMS categories, preferred contact method, language).
// Audited under account_ops.preferences_*.

import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
import { checkStaffAuth } from "../_shared/adminAuth.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

// Module 51 — Phase B1: canonical timeline write for every client-scoped
// communication preference change. Mirror every admin_audit_log insert
// with a client_activity_logs entry so `v_customer_timeline` surfaces it.
function minuteBucket(): string {
  return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
}
async function journalPrefsChange(
  admin: any,
  args: {
    clientId: string;
    accountId: string | null;
    action: "preferences_update" | "preferences_unsubscribe_all" | "sms_master_toggle";
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    reason: string | null;
    actorId: string;
    actorEmail: string | null;
    actorRole: "staff" | "client";
    correlationId: string;
  },
) {
  try {
    await writeAccountJournal(admin, {
      targetTable: "client_activity_logs",
      eventKey: `account:${args.clientId}:communication.${args.action}:${args.correlationId}`,
      correlationId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.correlationId)
        ? args.correlationId
        : null,
      visibility: "staff",
      actor: {
        userId: args.actorId,
        role: args.actorRole,
        email: args.actorEmail,
        name: args.actorEmail ?? args.actorRole,
      },
      payload: {
        client_id: args.clientId,
        account_id: args.accountId,
        action_type: `account.communication.${args.action}`,
        entity_type: "account",
        entity_id: args.accountId ?? args.clientId,
        summary: args.reason
          ? `communication.${args.action} — ${args.reason}`
          : `communication.${args.action}`,
        before_data: args.before,
        after_data: args.after,
        metadata: {
          before: args.before,
          after: args.after,
          reason: args.reason,
          correlation_id: args.correlationId,
          module_tag: "module_51",
        },
      },
    });
  } catch (err) {
    // Loud, but non-fatal — the admin_audit_log write is authoritative.
    console.error(
      "communication-preferences-actions: timeline journal write failed",
      { action: args.action, clientId: args.clientId, error: (err as Error).message },
    );
  }
}

type BoolKey =
  | "marketing_emails"
  | "promotional_emails"
  | "newsletter"
  | "service_updates"
  | "billing_notifications"
  | "sms_reminders"
  | "sms_invoices"
  | "sms_service_updates";

interface Body {
  action: "get" | "update" | "unsubscribe_all" | "client_self_sms_master";
  client_user_id: string;
  account_id?: string | null;
  reason?: string | null;
  changes?: Partial<Record<BoolKey, boolean>> & {
    preferred_contact_method?: "email" | "sms" | "both";
    preferred_language?: "fr" | "en";
    notification_channel?: "email" | "sms" | "push";
    sms_master?: boolean;
  };
}

const BOOL_KEYS: BoolKey[] = [
  "marketing_emails", "promotional_emails", "newsletter",
  "service_updates", "billing_notifications",
  "sms_reminders", "sms_invoices", "sms_service_updates",
];

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

    const body = (await req.json()) as Body;
    if (!body?.client_user_id || !body?.action) {
      return json({ error: "client_user_id and action required" }, 400);
    }

    // D46-C: allow a client to self-manage the SMS master toggle without staff role.
    if (body.action === "client_self_sms_master") {
      if (userData.user.id !== body.client_user_id) {
        return json({ error: "forbidden: self-only action" }, 403);
      }
      const value = !!body.changes?.sms_master;
      // Read "before" for a proper before/after diff in the timeline.
      const beforeRow = await admin
        .from("profiles")
        .select("sms_opt_in")
        .eq("user_id", body.client_user_id)
        .maybeSingle();
      const before = { sms_opt_in: beforeRow.data?.sms_opt_in ?? null };

      const { error: updErr } = await admin
        .from("profiles")
        .update({ sms_opt_in: value })
        .eq("user_id", body.client_user_id);
      if (updErr) throw updErr;

      const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      await admin.from("consent_audit_trail").insert({
        client_id: body.client_user_id,
        channel: "sms",
        action: value ? "sms_master_opt_in" : "sms_master_opt_out",
        consent_source: "client_portal",
        ip_address: clientIp,
        user_agent: req.headers.get("user-agent"),
      }).catch(() => {});

      const correlationId = crypto.randomUUID();
      await admin.from("admin_audit_log").insert({
        admin_user_id: userData.user.id,
        admin_email: userData.user.email,
        action: "client_self.sms_master_toggle",
        target_type: "user",
        target_id: body.client_user_id,
        details: {
          sms_master: value,
          reason: body.reason ?? null,
          correlation_id: correlationId,
          module_tag: "module_51",
        },
      }).catch(() => {});

      await journalPrefsChange(admin, {
        clientId: body.client_user_id,
        accountId: body.account_id ?? null,
        action: "sms_master_toggle",
        before,
        after: { sms_opt_in: value },
        reason: body.reason ?? null,
        actorId: userData.user.id,
        actorEmail: userData.user.email ?? null,
        actorRole: "client",
        correlationId,
      });

      return json({ ok: true, sms_master: value });
    }

    const { isStaff } = await checkStaffAuth(admin, userData.user.id);
    if (!isStaff) return json({ error: "Action réservée au personnel autorisé" }, 403);

    const loadAll = async () => {
      const [prefs, profile] = await Promise.all([
        admin.from("client_email_preferences").select("*").eq("client_id", body.client_user_id).maybeSingle(),
        admin.from("profiles").select("preferred_language, notification_channel, email, phone, phone_e164")
          .eq("user_id", body.client_user_id).maybeSingle(),
      ]);
      return {
        preferences: prefs.data ?? {
          client_id: body.client_user_id,
          marketing_emails: true, promotional_emails: true, newsletter: true,
          service_updates: true, billing_notifications: true,
          sms_reminders: false, sms_invoices: false, sms_service_updates: false,
          preferred_contact_method: "email",
          consent_given_at: null, consent_source: null,
        },
        profile: profile.data ?? null,
      };
    };

    switch (body.action) {
      case "get": {
        const data = await loadAll();
        return json({ ok: true, ...data });
      }

      case "update": {
        if (!body.reason?.trim()) return json({ error: "Motif requis" }, 400);
        const changes = body.changes ?? {};

        // Upsert email/SMS preferences row
        const prefPatch: Record<string, unknown> = {};
        for (const k of BOOL_KEYS) {
          if (typeof changes[k] === "boolean") prefPatch[k] = changes[k];
        }
        if (changes.preferred_contact_method) {
          prefPatch.preferred_contact_method = changes.preferred_contact_method;
        }
        if (Object.keys(prefPatch).length > 0) {
          prefPatch.consent_given_at = new Date().toISOString();
          prefPatch.consent_source = `staff:${userData.user.email}`;
          const { error } = await admin
            .from("client_email_preferences")
            .upsert({ client_id: body.client_user_id, ...prefPatch }, { onConflict: "client_id" });
          if (error) throw error;

          // CASL audit trail — log every preference change with IP
          const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || null;
          await admin.from("consent_audit_trail").insert({
            client_id: body.client_user_id,
            channel: "all",
            action: "preference_change",
            consent_source: "client_portal",
            ip_address: clientIp,
            user_agent: req.headers.get("user-agent"),
          }).catch(() => {});
        }

        // Update profile language/notification channel if requested
        const profilePatch: Record<string, unknown> = {};
        if (changes.preferred_language === "fr" || changes.preferred_language === "en") {
          profilePatch.preferred_language = changes.preferred_language;
        }
        if (
          changes.notification_channel === "email" ||
          changes.notification_channel === "sms" ||
          changes.notification_channel === "push"
        ) {
          profilePatch.notification_channel = changes.notification_channel;
        }
        if (Object.keys(profilePatch).length > 0) {
          const { error } = await admin
            .from("profiles")
            .update(profilePatch)
            .eq("user_id", body.client_user_id);
          if (error) throw error;
        }

        await admin.from("admin_audit_log").insert({
          admin_user_id: userData.user.id,
          admin_email: userData.user.email,
          action: "account_ops.preferences_update",
          target_type: "user",
          target_id: body.client_user_id,
          details: {
            account_id: body.account_id ?? null,
            reason: body.reason.trim(),
            changes,
          },
        });

        const data = await loadAll();
        return json({ ok: true, ...data });
      }

      case "unsubscribe_all": {
        if (!body.reason?.trim()) return json({ error: "Motif requis" }, 400);
        const off: Record<string, unknown> = {
          marketing_emails: false, promotional_emails: false, newsletter: false,
          sms_reminders: false, sms_invoices: false, sms_service_updates: false,
          consent_given_at: new Date().toISOString(),
          consent_source: `staff_unsubscribe:${userData.user.email}`,
        };
        // Note: service_updates and billing_notifications stay ON (transactional/legal).
        const { error } = await admin
          .from("client_email_preferences")
          .upsert({ client_id: body.client_user_id, ...off }, { onConflict: "client_id" });
        if (error) throw error;

        // CASL audit trail — log every preference change with IP
        const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || null;
        await admin.from("consent_audit_trail").insert({
          client_id: body.client_user_id,
          channel: "all",
          action: "preference_change",
          consent_source: "client_portal",
          ip_address: clientIp,
          user_agent: req.headers.get("user-agent"),
        }).catch(() => {});

        await admin.from("admin_audit_log").insert({
          admin_user_id: userData.user.id,
          admin_email: userData.user.email,
          action: "account_ops.preferences_unsubscribe_all",
          target_type: "user",
          target_id: body.client_user_id,
          details: { account_id: body.account_id ?? null, reason: body.reason.trim() },
        });

        const data = await loadAll();
        return json({ ok: true, ...data });
      }

      default:
        return json({ error: `unknown action: ${body.action}` }, 400);
    }
  } catch (e) {
    console.error("communication-preferences-actions error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
