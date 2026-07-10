// Module 38 — Phase B
// Privacy Requests (Loi 25) canonical Edge Function.
// - Single Door: only calls rpc_privacy_request_create / rpc_privacy_request_update_status.
// - No direct writes to public.privacy_requests.
// - JWT + server-side RBAC (admin, employee, supervisor, support, kyc_agent, billing_admin).
// - Zod validation. Legacy alias `submitted` normalized to `received`.
// - IP + User-Agent captured server-side. Idempotency enforced by RPC.
// - Reads (list) stay in EF for a single door.

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ROLES = new Set([
  "admin",
  "employee",
  "supervisor",
  "support",
  "kyc_agent",
  "billing_admin",
]);

const REQUEST_TYPES = [
  "access",
  "rectification",
  "deletion",
  "portability",
  "withdrawal_consent",
  "complaint",
] as const;

const STATUSES = [
  "received",
  "in_review",
  "awaiting_client",
  "completed",
  "refused",
  "cancelled",
] as const;

const uuidSchema = z.string().uuid();

const ListSchema = z.object({
  action: z.literal("list"),
  clientId: uuidSchema,
});

const CreateSchema = z.object({
  action: z.literal("create"),
  clientId: uuidSchema,
  accountId: uuidSchema.nullish(),
  requestType: z.enum(REQUEST_TYPES),
  description: z.string().trim().min(1).max(5000),
  reason: z.string().trim().min(1).max(2000),
  internalNotes: z.string().trim().max(5000).optional().nullable(),
  idempotencyKey: uuidSchema,
});

// Normalize legacy alias `submitted` -> `received` before validation.
const RawStatus = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const s = v.trim().toLowerCase();
  return s === "submitted" ? "received" : s;
}, z.enum(STATUSES));

const UpdateStatusSchema = z
  .object({
    action: z.literal("update_status"),
    requestId: uuidSchema,
    status: RawStatus,
    reason: z.string().trim().min(1).max(2000),
    refusalReason: z.string().trim().max(2000).optional().nullable(),
    internalNotes: z.string().trim().max(5000).optional().nullable(),
    idempotencyKey: uuidSchema,
  })
  .superRefine((val, ctx) => {
    if (val.status === "refused" && !val.refusalReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["refusalReason"],
        message: "refusalReason requis pour un refus",
      });
    }
  });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User-scoped client so RPCs see auth.uid()
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    // Server-side RBAC (defense-in-depth; RPC re-checks)
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role, is_active, status")
      .eq("user_id", user.id);
    const activeRoles = (roleRows ?? [])
      .filter((r: any) => r.is_active !== false && (r.status ?? "active") === "active")
      .map((r: any) => r.role as string);
    if (!activeRoles.some((r) => ALLOWED_ROLES.has(r))) {
      return json({ error: "Forbidden" }, 403);
    }

    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object") return json({ error: "Invalid JSON body" }, 400);

    const action = (raw as any).action;

    // ─── LIST ─────────────────────────────────────────────────────
    if (action === "list") {
      const parsed = ListSchema.safeParse(raw);
      if (!parsed.success) {
        return json({ error: "Validation failed", issues: parsed.error.flatten() }, 400);
      }
      const { data, error } = await admin
        .from("privacy_requests")
        .select("*")
        .eq("client_id", parsed.data.clientId)
        .order("received_at", { ascending: false });
      if (error) {
        console.error("[privacy-requests-actions] list error", error);
        return json({ error: "Operation failed" }, 500);
      }
      return json({ requests: data ?? [] });
    }

    // ─── CREATE ───────────────────────────────────────────────────
    if (action === "create") {
      const parsed = CreateSchema.safeParse(raw);
      if (!parsed.success) {
        return json({ error: "Validation failed", issues: parsed.error.flatten() }, 400);
      }
      const p = parsed.data;

      const rpcPayload = {
        client_id: p.clientId,
        account_id: p.accountId ?? null,
        request_type: p.requestType,
        description: p.description,
        internal_notes: p.internalNotes ?? null,
        reason: p.reason,
        idempotency_key: p.idempotencyKey,
        request_ip: getClientIp(req),
        user_agent: req.headers.get("user-agent") ?? null,
      };

      const { data, error } = await userClient.rpc("rpc_privacy_request_create", {
        p_payload: rpcPayload,
      });
      if (error) {
        console.error("[privacy-requests-actions] rpc create error", error);
        const msg = error.message ?? "";
        if (msg.includes("PRIVACY-REQ-AUTH")) return json({ error: "Unauthorized" }, 401);
        if (msg.includes("PRIVACY-REQ-RBAC")) return json({ error: "Forbidden" }, 403);
        if (msg.includes("PRIVACY-REQ-VALIDATION")) return json({ error: msg }, 400);
        return json({ error: "Operation failed" }, 500);
      }
      return json(data);
    }

    // ─── UPDATE STATUS ────────────────────────────────────────────
    if (action === "update_status") {
      const parsed = UpdateStatusSchema.safeParse(raw);
      if (!parsed.success) {
        return json({ error: "Validation failed", issues: parsed.error.flatten() }, 400);
      }
      const p = parsed.data;

      const rpcPayload = {
        request_id: p.requestId,
        status: p.status,
        reason: p.reason,
        refusal_reason: p.refusalReason ?? null,
        internal_notes: p.internalNotes ?? null,
        idempotency_key: p.idempotencyKey,
      };

      const { data, error } = await userClient.rpc("rpc_privacy_request_update_status", {
        p_payload: rpcPayload,
      });
      if (error) {
        console.error("[privacy-requests-actions] rpc update error", error);
        const msg = error.message ?? "";
        if (msg.includes("PRIVACY-REQ-AUTH")) return json({ error: "Unauthorized" }, 401);
        if (msg.includes("PRIVACY-REQ-RBAC")) return json({ error: "Forbidden" }, 403);
        if (msg.includes("PRIVACY-REQ-NOT-FOUND")) return json({ error: "Not found" }, 404);
        if (msg.includes("PRIVACY-REQ-VALIDATION") || msg.includes("PRIVACY-REQ-STATE"))
          return json({ error: msg }, 400);
        return json({ error: "Operation failed" }, 500);
      }
      return json(data);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[privacy-requests-actions] fatal", e);
    return json({ error: "Internal error" }, 500);
  }
});
