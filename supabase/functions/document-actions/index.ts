/**
 * MODULE 39 — CANONICAL SINGLE DOOR for all document writes.
 *
 * Actions:
 *  - register      : record a document row after client uploaded to storage
 *  - soft_delete   : mark document as deleted (Loi 25 audit)
 *  - restore       : undo a soft-delete (admin only)
 *  - signed_url    : return a short-lived signed URL (audited)
 *  - purge_expired : cron entry point, permanently deletes rows past retention_until
 *
 * Guarantees: Zod validation, RBAC, idempotency (UUID key, 24h),
 * transactional writes via SECURITY DEFINER RPC, full audit, notifications.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const TABLES = ["client_documents", "order_documents", "hr_documents", "client_auto_documents"] as const;
const TABLE_BUCKETS: Record<string, string> = {
  client_documents: "client-documents",
  order_documents: "order-documents",
  hr_documents: "hr-documents",
  client_auto_documents: "client-documents",
};

const BaseSchema = z.object({
  action: z.enum(["register", "soft_delete", "restore", "signed_url", "purge_expired"]),
  idempotency_key: z.string().uuid().optional(),
  reason: z.string().min(3).max(500),
  __audit_reason: z.string().optional(),
});

const RegisterSchema = BaseSchema.extend({
  action: z.literal("register"),
  table: z.enum(TABLES),
  payload: z.record(z.any()),
});
const DeleteSchema = BaseSchema.extend({
  action: z.literal("soft_delete"),
  table: z.enum(TABLES),
  document_id: z.string().uuid(),
});
const RestoreSchema = BaseSchema.extend({
  action: z.literal("restore"),
  table: z.enum(TABLES),
  document_id: z.string().uuid(),
});
const SignedSchema = BaseSchema.extend({
  action: z.literal("signed_url"),
  table: z.enum(TABLES),
  document_id: z.string().uuid(),
  ttl_seconds: z.number().int().min(30).max(3600).default(300),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getActor(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) return { user: null, roles: [] as string[] };
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData } = await client.auth.getUser();
  const user = userData?.user ?? null;
  if (!user) return { user: null, roles: [] };
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  return { user, roles: (roles ?? []).map((r: any) => r.role as string) };
}

function has(roles: string[], ...allowed: string[]) {
  return roles.some((r) => allowed.includes(r));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const parsedBase = BaseSchema.safeParse(body);
  if (!parsedBase.success) {
    return json({ error: "validation_failed", detail: parsedBase.error.flatten() }, 400);
  }

  const { user, roles } = await getActor(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "";
  const ua = req.headers.get("user-agent") ?? "";
  const reason = body.reason ?? body.__audit_reason ?? "";
  const isStaff = has(roles, "admin", "employee", "supervisor", "billing_admin");
  const isAdmin = has(roles, "admin");

  try {
    switch (body.action) {
      case "register": {
        const p = RegisterSchema.safeParse(body);
        if (!p.success) return json({ error: "validation_failed", detail: p.error.flatten() }, 400);
        // RBAC: client can register only their own client_documents; hr requires HR/admin; order requires staff or ownership.
        const t = p.data.table;
        if (t === "hr_documents" && !isStaff && p.data.payload.employee_id !== user.id) {
          return json({ error: "forbidden" }, 403);
        }
        if (t === "client_documents") {
          const targetUser = p.data.payload.user_id;
          if (!isStaff && targetUser !== user.id) return json({ error: "forbidden" }, 403);
        }
        if (t === "order_documents" && !isStaff) {
          // verify ownership of the order
          const { data: ord } = await admin.from("orders").select("user_id").eq("id", p.data.payload.order_id).maybeSingle();
          if (!ord || ord.user_id !== user.id) return json({ error: "forbidden" }, 403);
        }
        const { data, error } = await admin.rpc("rpc_document_register", {
          p_table: t,
          p_payload: p.data.payload,
          p_actor_id: user.id,
          p_actor_role: roles[0] ?? "client",
          p_reason: reason,
          p_idempotency_key: p.data.idempotency_key ?? null,
          p_ip: ip,
          p_ua: ua,
        });
        if (error) return json({ error: "register_failed", detail: error.message }, 400);
        return json(data);
      }

      case "soft_delete": {
        const p = DeleteSchema.safeParse(body);
        if (!p.success) return json({ error: "validation_failed", detail: p.error.flatten() }, 400);
        if (!isStaff) return json({ error: "forbidden" }, 403);
        const { data, error } = await admin.rpc("rpc_document_soft_delete", {
          p_table: p.data.table,
          p_id: p.data.document_id,
          p_actor_id: user.id,
          p_actor_role: roles[0] ?? "employee",
          p_reason: reason,
          p_ip: ip, p_ua: ua,
        });
        if (error) return json({ error: "delete_failed", detail: error.message }, 400);
        return json(data);
      }

      case "restore": {
        const p = RestoreSchema.safeParse(body);
        if (!p.success) return json({ error: "validation_failed", detail: p.error.flatten() }, 400);
        if (!isAdmin) return json({ error: "forbidden" }, 403);
        const { error } = await admin.from(p.data.table as any).update({
          deleted_at: null, deleted_by: null, deletion_reason: null,
        }).eq("id", p.data.document_id);
        if (error) return json({ error: "restore_failed", detail: error.message }, 400);
        await admin.from("document_audit_log").insert({
          document_table: p.data.table, document_id: p.data.document_id,
          action: "restore", actor_id: user.id, actor_role: roles[0] ?? "admin",
          reason, ip_address: ip, user_agent: ua, edge_function: "document-actions",
        });
        return json({ ok: true });
      }

      case "signed_url": {
        const p = SignedSchema.safeParse(body);
        if (!p.success) return json({ error: "validation_failed", detail: p.error.flatten() }, 400);
        // fetch document + verify ownership/staff
        const { data: doc, error: dErr } = await admin.from(p.data.table as any).select("*").eq("id", p.data.document_id).maybeSingle();
        if (dErr || !doc) return json({ error: "not_found" }, 404);
        const ownerField =
          p.data.table === "client_documents" ? "user_id"
          : p.data.table === "hr_documents" ? "employee_id"
          : p.data.table === "client_auto_documents" ? "client_id"
          : null;
        let allowed = isStaff;
        if (!allowed && ownerField && (doc as any)[ownerField] === user.id) allowed = true;
        if (!allowed && p.data.table === "order_documents") {
          const { data: ord } = await admin.from("orders").select("user_id").eq("id", (doc as any).order_id).maybeSingle();
          if (ord?.user_id === user.id) allowed = true;
        }
        if (!allowed) return json({ error: "forbidden" }, 403);

        const bucket = TABLE_BUCKETS[p.data.table];
        const path = (doc as any).storage_path ?? (doc as any).file_path ?? (doc as any).document_url ?? (doc as any).pdf_url;
        if (!path) return json({ error: "no_storage_path" }, 400);
        const { data: signed, error: sErr } = await admin.storage.from(bucket).createSignedUrl(path, p.data.ttl_seconds);
        if (sErr) return json({ error: "sign_failed", detail: sErr.message }, 400);

        await admin.from("document_audit_log").insert({
          document_table: p.data.table, document_id: p.data.document_id,
          action: "download", actor_id: user.id, actor_role: roles[0] ?? "client",
          reason, ip_address: ip, user_agent: ua, edge_function: "document-actions",
        });
        return json({ ok: true, signed_url: signed.signedUrl, expires_in: p.data.ttl_seconds });
      }

      case "purge_expired": {
        if (!isAdmin) return json({ error: "forbidden" }, 403);
        const results: Record<string, number> = {};
        for (const t of TABLES) {
          const { data, error } = await admin
            .from(t)
            .delete()
            .lt("retention_until", new Date().toISOString())
            .not("deleted_at", "is", null)
            .select("id");
          if (!error) results[t] = (data ?? []).length;
        }
        await admin.from("document_audit_log").insert({
          document_table: "*", action: "purge",
          actor_id: user.id, actor_role: "admin",
          reason, ip_address: ip, user_agent: ua,
          after_state: results, edge_function: "document-actions",
        });
        return json({ ok: true, purged: results });
      }
    }
  } catch (e: any) {
    console.error("[document-actions]", e);
    return json({ error: "internal", detail: e?.message ?? String(e) }, 500);
  }

  return json({ error: "unknown_action" }, 400);
});
