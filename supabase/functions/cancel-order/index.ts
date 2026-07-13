// Canonical cancel-order engine wrapper.
// Wraps public.cancel_order_v1() and orchestrates Square refunds when required.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Body {
  order_id: string;
  reason_code: string;
  reason_note: string;
  source?: string;
  idempotency_key?: string;
  dry_run?: boolean;
  process_refund?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ ok: false, error: "UNAUTHORIZED" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims?.sub) {
      return json({ ok: false, error: "UNAUTHORIZED" }, 401);
    }
    const actorId = claims.claims.sub as string;
    const actorEmail = (claims.claims.email as string | undefined) ?? null;

    const body = (await req.json()) as Body;
    if (!body?.order_id || !body?.reason_code || !body?.reason_note) {
      return json({ ok: false, error: "MISSING_FIELDS" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Authorisation : staff uniquement pour annuler côté Core.
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", actorId);
    const allowed = new Set([
      "admin", "support", "employee", "sales", "billing_admin", "supervisor",
    ]);
    const actorRole = (roles ?? []).map((r: any) => r.role).find((r: string) => allowed.has(r));
    if (!actorRole) {
      return json({ ok: false, error: "FORBIDDEN" }, 403);
    }

    // Preview only
    if (body.dry_run) {
      const { data, error } = await admin.rpc("cancel_order_preview_v1", { p_order_id: body.order_id });
      if (error) return json({ ok: false, error: error.message }, 500);
      return json(data);
    }

    // Exécution du moteur SQL (cascade transactionnelle).
    const { data: result, error } = await admin.rpc("cancel_order_v1", {
      p_order_id: body.order_id,
      p_reason_code: body.reason_code,
      p_reason_note: body.reason_note,
      p_actor_id: actorId,
      p_actor_email: actorEmail,
      p_actor_role: actorRole,
      p_source: body.source ?? "core_ui",
      p_idempotency_key: body.idempotency_key ?? null,
      p_dry_run: false,
    });
    if (error) return json({ ok: false, error: error.message }, 500);

    // Remboursement Square (facultatif — décision UI). Journalisé mais non bloquant.
    let refund_result: any = null;
    if (body.process_refund && result?.refund_required) {
      try {
        const { data: refund, error: refundErr } = await admin.functions.invoke(
          "square-refund",
          {
            body: {
              order_id: body.order_id,
              amount: result.refund_amount,
              reason: `cancel_order:${body.reason_code}`,
              actor_id: actorId,
            },
          },
        );
        refund_result = refundErr ? { ok: false, error: refundErr.message } : refund;
      } catch (e) {
        refund_result = { ok: false, error: (e as Error).message };
      }
      await admin.from("order_events").insert({
        order_id: body.order_id,
        event_type: "refund_attempted",
        actor_id: actorId,
        actor_email: actorEmail,
        actor_role: actorRole,
        source: body.source ?? "core_ui",
        payload: refund_result ?? {},
      });
    }

    return json({ ...result, refund_result });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
