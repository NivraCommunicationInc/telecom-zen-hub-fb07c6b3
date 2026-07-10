/**
 * MODULE 39 — QA RUNNER (documents client)
 *
 * Validates single-door enforcement, RBAC, idempotency, audit,
 * MIME/size guards, soft-delete, signed URLs, and cleanup on the
 * canonical `document-actions` Edge Function.
 *
 * Admin-only. Returns per-test PASS/FAIL and cleans up its own rows.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Res = { name: string; ok: boolean; detail?: unknown };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Authenticate caller (admin only)
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: userData } = await userClient.auth.getUser();
  const actor = userData?.user;
  if (!actor) return json({ error: "unauthorized" }, 401);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", actor.id);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  const runId = crypto.randomUUID();
  const results: Res[] = [];
  const cleanup: { table: string; id: string }[] = [];

  const invoke = (payload: any, headers: Record<string, string> = {}) =>
    fetch(`${SUPABASE_URL}/functions/v1/document-actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth, ...headers },
      body: JSON.stringify(payload),
    });

  async function check(name: string, fn: () => Promise<void>) {
    try { await fn(); results.push({ name, ok: true }); }
    catch (e: any) { results.push({ name, ok: false, detail: e?.message ?? String(e) }); }
  }

  // T01 — direct INSERT blocked by single-door trigger
  await check("T01 single-door blocks direct client_documents insert", async () => {
    const client = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { error } = await client.from("client_documents").insert({
      user_id: actor.id, document_name: "x", document_url: "x", uploaded_by: actor.id,
    });
    if (!error) throw new Error("expected DOCUMENT-SINGLE-DOOR error, insert succeeded");
    if (!error.message.includes("SINGLE-DOOR") && !error.message.includes("insufficient")) {
      throw new Error("unexpected error: " + error.message);
    }
  });

  // T02 — register via EF succeeds + audit written
  let regId: string | null = null;
  await check("T02 register via document-actions succeeds", async () => {
    const idem = crypto.randomUUID();
    const r = await invoke({
      action: "register", table: "client_documents",
      reason: "QA T02 register", idempotency_key: idem,
      payload: {
        user_id: actor.id, document_name: `qa-${runId}.pdf`, document_url: `qa/${runId}.pdf`,
        document_type: "test", mime_type: "application/pdf", file_size_bytes: 1024,
      },
    });
    const body = await r.json();
    if (!r.ok || !body?.ok) throw new Error("register failed: " + JSON.stringify(body));
    regId = body?.data?.data?.id ?? body?.data?.id;
    if (!regId) throw new Error("no id returned");
    cleanup.push({ table: "client_documents", id: regId });
  });

  // T03 — idempotency replay returns same result
  await check("T03 idempotency replay", async () => {
    const idem = crypto.randomUUID();
    const payload = {
      action: "register", table: "client_documents",
      reason: "QA T03 idem", idempotency_key: idem,
      payload: {
        user_id: actor.id, document_name: `qa-idem-${runId}.pdf`,
        document_url: `qa/idem-${runId}.pdf`, mime_type: "application/pdf", file_size_bytes: 512,
      },
    };
    const r1 = await (await invoke(payload)).json();
    const r2 = await (await invoke(payload)).json();
    const id1 = r1?.data?.data?.id ?? r1?.data?.id;
    const id2 = r2?.data?.data?.id ?? r2?.data?.id;
    if (!id1 || id1 !== id2) throw new Error(`ids differ: ${id1} vs ${id2}`);
    cleanup.push({ table: "client_documents", id: id1 });
  });

  // T04 — MIME validation rejects unsupported
  await check("T04 MIME validation rejects text/plain", async () => {
    const r = await invoke({
      action: "register", table: "client_documents",
      reason: "QA T04 bad mime",
      payload: {
        user_id: actor.id, document_name: "bad.txt", document_url: "bad.txt",
        mime_type: "text/plain", file_size_bytes: 10,
      },
    });
    if (r.ok) throw new Error("expected 400, got " + r.status);
  });

  // T05 — size validation rejects >20MiB
  await check("T05 size validation rejects >20MiB", async () => {
    const r = await invoke({
      action: "register", table: "client_documents",
      reason: "QA T05 big",
      payload: {
        user_id: actor.id, document_name: "big.pdf", document_url: "big.pdf",
        mime_type: "application/pdf", file_size_bytes: 30 * 1024 * 1024,
      },
    });
    if (r.ok) throw new Error("expected 400, got " + r.status);
  });

  // T06 — missing reason rejected
  await check("T06 missing reason rejected", async () => {
    const r = await invoke({
      action: "register", table: "client_documents",
      payload: { user_id: actor.id, document_name: "x", document_url: "x" },
    });
    if (r.ok) throw new Error("expected 400");
  });

  // T07 — soft_delete flags row + writes audit
  await check("T07 soft_delete works and audits", async () => {
    if (!regId) throw new Error("no regId from T02");
    const r = await invoke({
      action: "soft_delete", table: "client_documents",
      document_id: regId, reason: "QA T07 delete",
    });
    const body = await r.json();
    if (!r.ok || !body?.ok) throw new Error("soft_delete failed: " + JSON.stringify(body));
    const { data } = await admin.from("client_documents").select("deleted_at, deletion_reason").eq("id", regId).maybeSingle();
    if (!data?.deleted_at) throw new Error("deleted_at not set");
  });

  // T08 — audit log has entries for our runId
  await check("T08 audit log populated", async () => {
    if (!regId) throw new Error("no regId");
    const { data } = await admin.from("document_audit_log").select("action").eq("document_id", regId);
    const actions = (data ?? []).map((r: any) => r.action);
    if (!actions.includes("upload")) throw new Error("no upload audit");
    if (!actions.includes("delete")) throw new Error("no delete audit");
  });

  // T09 — restore requires admin (positive test as admin)
  await check("T09 restore by admin", async () => {
    if (!regId) throw new Error("no regId");
    const r = await invoke({
      action: "restore", table: "client_documents",
      document_id: regId, reason: "QA T09 restore",
    });
    const body = await r.json();
    if (!r.ok || !body?.ok) throw new Error("restore failed: " + JSON.stringify(body));
    const { data } = await admin.from("client_documents").select("deleted_at").eq("id", regId).maybeSingle();
    if (data?.deleted_at) throw new Error("deleted_at still set");
  });

  // T10 — signed_url returns URL + audits download
  await check("T10 signed_url", async () => {
    if (!regId) throw new Error("no regId");
    const r = await invoke({
      action: "signed_url", table: "client_documents",
      document_id: regId, reason: "QA T10 signed", ttl_seconds: 60,
    });
    const body = await r.json();
    if (!r.ok || !body?.signed_url) throw new Error("signed_url failed: " + JSON.stringify(body));
  });

  // T11 — unknown action rejected
  await check("T11 unknown action rejected", async () => {
    const r = await invoke({ action: "explode" as any, reason: "QA T11" });
    if (r.ok) throw new Error("expected 400");
  });

  // T12 — no orphans in audit (all rows have actor + reason)
  await check("T12 audit rows carry actor + reason", async () => {
    const { data } = await admin.from("document_audit_log")
      .select("actor_id, reason")
      .eq("edge_function", "document-actions")
      .order("created_at", { ascending: false }).limit(20);
    const bad = (data ?? []).filter((r: any) => !r.actor_id || !r.reason);
    if (bad.length) throw new Error(`${bad.length} audit rows missing actor/reason`);
  });

  // Cleanup — hard delete via service_role bypass
  for (const c of cleanup) {
    await admin.from(c.table).delete().eq("id", c.id);
  }
  await admin.from("document_audit_log").delete().eq("reason", "QA T02 register");

  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  return json({
    module: "39-documents",
    run_id: runId,
    total: results.length,
    pass, fail,
    verdict: fail === 0 ? "PASS" : "FAIL",
    results,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
