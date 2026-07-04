// regenerate-order-documents — Admin-only backfill: re-generates the V3 PDFs
// (contract + invoice + summary) for an order_id or order_number, uploads
// them to `client-documents`, and registers them in `client_auto_documents`
// so they show up in Core and Portal for older orders that predate the
// automatic persistence.
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireStaff } from "../_shared/adminAuth.ts";
import { persistOrderDocuments } from "../_shared/persistOrderDocuments.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const auth = await requireStaff(req, sb, ["admin", "super_admin", "supervisor", "billing_admin"]);
  if (auth instanceof Response) return auth;

  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  const { order_id, order_number, order_ids } = body || {};

  const targets: string[] = [];
  if (Array.isArray(order_ids)) targets.push(...order_ids.filter((x) => typeof x === "string"));
  if (typeof order_id === "string") targets.push(order_id);
  if (order_number != null) {
    const { data } = await sb.from("orders").select("id").eq("order_number", order_number).maybeSingle();
    if ((data as any)?.id) targets.push((data as any).id);
  }

  if (targets.length === 0) {
    return new Response(JSON.stringify({ error: "order_id, order_ids or order_number required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const out: any[] = [];
  for (const id of targets) {
    try {
      const r = await persistOrderDocuments(id);
      out.push({ order_id: id, ok: true, results: r.results });
    } catch (e: any) {
      out.push({ order_id: id, ok: false, error: e?.message || String(e) });
    }
  }

  return new Response(JSON.stringify({ success: true, count: out.length, results: out }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
