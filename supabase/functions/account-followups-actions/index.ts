// account-followups-actions — Phase 18
// Staff-only: manage internal follow-up tasks tied to a client account.
// Actions: list, create, update_status, assign, delete. All audited.

import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
import { checkStaffAuth } from "../_shared/adminAuth.ts";

interface Body {
  action: "list" | "create" | "update_status" | "assign" | "delete";
  client_user_id: string;
  account_id?: string | null;
  followup_id?: string;
  title?: string;
  description?: string;
  category?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  status?: "open" | "in_progress" | "done" | "cancelled";
  due_at?: string | null;
  assigned_to?: string | null;
  completion_note?: string | null;
  reason?: string | null;
}

const CATEGORIES = [
  "general", "billing", "technical", "retention",
  "collections", "kyc", "escalation", "callback",
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

      const { isStaff } = await checkStaffAuth(admin, user.id);
  if (!isStaff) return json(403, { error: "Action réservée au personnel autorisé" });
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });

    const body = (await req.json()) as Body;
    if (!body?.client_user_id || !body?.action) {
      return json({ error: "client_user_id and action required" }, 400);
    }

    switch (body.action) {
      case "list": {
        const { data, error } = await admin
          .from("account_followups")
          .select("*")
          .eq("client_user_id", body.client_user_id)
          .order("status", { ascending: true })
          .order("due_at", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        return json({ ok: true, followups: data ?? [], categories: CATEGORIES });
      }

      case "create": {
        if (!body.title?.trim()) return json({ error: "Titre requis" }, 400);
        if (!body.reason?.trim()) return json({ error: "Motif requis" }, 400);

        const priority = ["low", "normal", "high", "urgent"].includes(body.priority ?? "")
          ? body.priority! : "normal";
        const category = CATEGORIES.includes(body.category ?? "") ? body.category! : "general";

        let assignedEmail: string | null = null;
        if (body.assigned_to) {
          const { data: p } = await admin
            .from("profiles").select("email").eq("user_id", body.assigned_to).maybeSingle();
          assignedEmail = p?.email ?? null;
        }

        const row = {
          client_user_id: body.client_user_id,
          account_id: body.account_id ?? null,
          title: body.title.trim().slice(0, 240),
          description: body.description?.trim().slice(0, 4000) || null,
          category,
          priority,
          status: "open",
          due_at: body.due_at || null,
          assigned_to: body.assigned_to ?? userData.user.id,
          assigned_to_email: assignedEmail ?? userData.user.email ?? null,
          created_by: userData.user.id,
          created_by_email: userData.user.email ?? null,
        };

        const { data, error } = await admin
          .from("account_followups").insert(row).select("*").single();
        if (error) throw error;

        await admin.from("admin_audit_log").insert({
          admin_user_id: userData.user.id,
          admin_email: userData.user.email,
          action: "account_ops.followup_create",
          target_type: "user",
          target_id: body.client_user_id,
          details: { followup_id: data.id, row, reason: body.reason.trim() },
        });
        return json({ ok: true, followup: data });
      }

      case "update_status": {
        if (!body.followup_id) return json({ error: "followup_id requis" }, 400);
        if (!body.status) return json({ error: "status requis" }, 400);
        if (!["open", "in_progress", "done", "cancelled"].includes(body.status)) {
          return json({ error: "status invalide" }, 400);
        }
        if (!body.reason?.trim()) return json({ error: "Motif requis" }, 400);

        const patch: Record<string, unknown> = { status: body.status };
        if (body.status === "done" || body.status === "cancelled") {
          patch.completed_at = new Date().toISOString();
          patch.completed_by = userData.user.id;
          patch.completion_note = body.completion_note?.trim().slice(0, 2000) || null;
        } else {
          patch.completed_at = null;
          patch.completed_by = null;
          patch.completion_note = null;
        }

        const { data, error } = await admin
          .from("account_followups")
          .update(patch)
          .eq("id", body.followup_id)
          .eq("client_user_id", body.client_user_id)
          .select("*").maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "Suivi introuvable" }, 404);

        await admin.from("admin_audit_log").insert({
          admin_user_id: userData.user.id,
          admin_email: userData.user.email,
          action: "account_ops.followup_update_status",
          target_type: "user",
          target_id: body.client_user_id,
          details: { followup_id: body.followup_id, status: body.status, reason: body.reason.trim() },
        });
        return json({ ok: true, followup: data });
      }

      case "assign": {
        if (!body.followup_id) return json({ error: "followup_id requis" }, 400);
        if (!body.assigned_to) return json({ error: "assigned_to requis" }, 400);
        if (!body.reason?.trim()) return json({ error: "Motif requis" }, 400);

        const { data: p } = await admin
          .from("profiles").select("email").eq("user_id", body.assigned_to).maybeSingle();

        const { data, error } = await admin
          .from("account_followups")
          .update({ assigned_to: body.assigned_to, assigned_to_email: p?.email ?? null })
          .eq("id", body.followup_id)
          .eq("client_user_id", body.client_user_id)
          .select("*").maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "Suivi introuvable" }, 404);

        await admin.from("admin_audit_log").insert({
          admin_user_id: userData.user.id,
          admin_email: userData.user.email,
          action: "account_ops.followup_assign",
          target_type: "user",
          target_id: body.client_user_id,
          details: { followup_id: body.followup_id, assigned_to: body.assigned_to, reason: body.reason.trim() },
        });
        return json({ ok: true, followup: data });
      }

      case "delete": {
        if (!isAdmin) return json({ error: "Seuls les admins peuvent supprimer" }, 403);
        if (!body.followup_id) return json({ error: "followup_id requis" }, 400);
        if (!body.reason?.trim()) return json({ error: "Motif requis" }, 400);

        const { data: existing } = await admin
          .from("account_followups").select("*")
          .eq("id", body.followup_id)
          .eq("client_user_id", body.client_user_id).maybeSingle();
        if (!existing) return json({ error: "Suivi introuvable" }, 404);

        const { error } = await admin
          .from("account_followups").delete()
          .eq("id", body.followup_id)
          .eq("client_user_id", body.client_user_id);
        if (error) throw error;

        await admin.from("admin_audit_log").insert({
          admin_user_id: userData.user.id,
          admin_email: userData.user.email,
          action: "account_ops.followup_delete",
          target_type: "user",
          target_id: body.client_user_id,
          details: { removed: existing, reason: body.reason.trim() },
        });
        return json({ ok: true });
      }

      default:
        return json({ error: `unknown action: ${body.action}` }, 400);
    }
  } catch (e) {
    console.error("account-followups-actions error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
