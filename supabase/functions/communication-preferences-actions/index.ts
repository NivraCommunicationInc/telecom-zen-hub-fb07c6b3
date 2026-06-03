// communication-preferences-actions — Phase 16
// Staff-only: read/update client communication preferences
// (email categories, SMS categories, preferred contact method, language).
// Audited under account_ops.preferences_*.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { checkStaffAuth } from "../_shared/adminAuth.ts";

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
  action: "get" | "update" | "unsubscribe_all";
  client_user_id: string;
  account_id?: string | null;
  reason?: string | null;
  changes?: Partial<Record<BoolKey, boolean>> & {
    preferred_contact_method?: "email" | "sms" | "both";
    preferred_language?: "fr" | "en";
    notification_channel?: "email" | "sms" | "push";
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

      const { isStaff } = await checkStaffAuth(admin, userData.user.id);
  if (!isStaff) return json(403, { error: "Action réservée au personnel autorisé" });

    const body = (await req.json()) as Body;
    if (!body?.client_user_id || !body?.action) {
      return json({ error: "client_user_id and action required" }, 400);
    }

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
