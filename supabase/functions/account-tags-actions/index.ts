// account-tags-actions — Phase 17
// Staff-only: manage account tags / alerts (VIP, à risque, fraude, etc.)
// Actions: list, add, remove. All audited under account_ops.tag_*.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  action: "list" | "add" | "remove";
  client_user_id: string;
  account_id?: string | null;
  tag_id?: string;
  tag_key?: string;
  tag_label?: string;
  severity?: "info" | "warning" | "critical";
  note?: string;
  expires_at?: string | null;
  reason?: string | null;
}

// Curated preset catalogue surfaced to UI.
const PRESETS = [
  { key: "vip", label: "VIP", severity: "info" },
  { key: "loyal", label: "Client fidèle", severity: "info" },
  { key: "watchlist", label: "Surveillance", severity: "warning" },
  { key: "at_risk", label: "À risque", severity: "warning" },
  { key: "collections", label: "Recouvrement actif", severity: "warning" },
  { key: "chargeback_history", label: "Historique chargeback", severity: "warning" },
  { key: "fraud_suspected", label: "Fraude suspectée", severity: "critical" },
  { key: "do_not_contact", label: "Ne pas contacter", severity: "critical" },
  { key: "litigation", label: "Litige juridique", severity: "critical" },
  { key: "escalation_required", label: "Escalade requise", severity: "warning" },
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

    const roles = await Promise.all([
      admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" }),
      admin.rpc("has_role", { _user_id: userData.user.id, _role: "support" }),
      admin.rpc("has_role", { _user_id: userData.user.id, _role: "billing_admin" }),
      admin.rpc("has_role", { _user_id: userData.user.id, _role: "supervisor" }),
    ]);
    if (!roles.some((r) => r.data === true)) return json({ error: "forbidden" }, 403);

    const body = (await req.json()) as Body;
    if (!body?.client_user_id || !body?.action) {
      return json({ error: "client_user_id and action required" }, 400);
    }

    switch (body.action) {
      case "list": {
        const { data, error } = await admin
          .from("account_tags")
          .select("*")
          .eq("client_user_id", body.client_user_id)
          .order("severity", { ascending: false })
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ ok: true, tags: data ?? [], presets: PRESETS });
      }

      case "add": {
        if (!body.tag_key?.trim() || !body.tag_label?.trim()) {
          return json({ error: "tag_key et tag_label requis" }, 400);
        }
        if (!body.reason?.trim()) return json({ error: "Motif requis" }, 400);

        const severity =
          body.severity === "warning" || body.severity === "critical" ? body.severity : "info";

        const row = {
          client_user_id: body.client_user_id,
          account_id: body.account_id ?? null,
          tag_key: body.tag_key.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 64),
          tag_label: body.tag_label.trim().slice(0, 120),
          severity,
          note: body.note?.trim() || null,
          expires_at: body.expires_at || null,
          created_by: userData.user.id,
          created_by_email: userData.user.email ?? null,
        };

        const { data, error } = await admin
          .from("account_tags")
          .insert(row)
          .select("*")
          .single();
        if (error) {
          if (String(error.message).includes("account_tags_unique_active")) {
            return json({ error: "Cette étiquette existe déjà sur ce compte" }, 409);
          }
          throw error;
        }

        await admin.from("admin_audit_log").insert({
          admin_user_id: userData.user.id,
          admin_email: userData.user.email,
          action: "account_ops.tag_add",
          target_type: "user",
          target_id: body.client_user_id,
          details: { account_id: body.account_id ?? null, tag: row, reason: body.reason.trim() },
        });
        return json({ ok: true, tag: data });
      }

      case "remove": {
        if (!body.tag_id) return json({ error: "tag_id requis" }, 400);
        if (!body.reason?.trim()) return json({ error: "Motif requis" }, 400);

        const { data: existing } = await admin
          .from("account_tags")
          .select("*")
          .eq("id", body.tag_id)
          .eq("client_user_id", body.client_user_id)
          .maybeSingle();
        if (!existing) return json({ error: "Étiquette introuvable" }, 404);

        const { error } = await admin
          .from("account_tags")
          .delete()
          .eq("id", body.tag_id)
          .eq("client_user_id", body.client_user_id);
        if (error) throw error;

        await admin.from("admin_audit_log").insert({
          admin_user_id: userData.user.id,
          admin_email: userData.user.email,
          action: "account_ops.tag_remove",
          target_type: "user",
          target_id: body.client_user_id,
          details: {
            account_id: body.account_id ?? null,
            removed_tag: existing,
            reason: body.reason.trim(),
          },
        });
        return json({ ok: true });
      }

      default:
        return json({ error: `unknown action: ${body.action}` }, 400);
    }
  } catch (e) {
    console.error("account-tags-actions error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
