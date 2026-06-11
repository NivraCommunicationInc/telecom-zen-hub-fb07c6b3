import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * core-ai-suggest — Nivra AI Console suggestion engine.
 * Reads a small context (balance, overdue, services, tickets) and asks Lovable AI
 * for a short summary + 3 recommended actions from the Core action registry.
 * NO MUTATIONS.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACTION_IDS = [
  "account-360","account-notes","account-history","billing-overview","billing-invoices",
  "billing-payments","billing-recouvrement","billing-contested-payments","billing-subscriptions",
  "services-list","services-pause","services-plan-changes","services-cancellations","services-orders",
  "field-installations","field-appointments","field-tech-map","field-coverage","field-dispatch",
  "support-tickets","support-sla","support-metrics","equip-returns","equip-phones",
  "comm-email","comm-sms","comp-kyc","comp-contracts","comp-documents",
  "com-quotes","com-promotions","com-pos","sec-events","sec-guardian",
];

const SYSTEM = `Tu es l'assistant IA Nivra Télécom (Québec) pour les opérateurs Core.
À partir du contexte client fourni, produis:
1) Un résumé en 2-3 phrases en français (situation actuelle, points d'attention).
2) Exactement 3 actions recommandées (les plus pertinentes) parmi ces IDs:
${ACTION_IDS.join(", ")}

Réponds STRICTEMENT en JSON valide:
{"summary":"...","actions":[{"id":"<action-id>","reason":"<raison courte>"},{...},{...}]}
Aucun texte hors JSON.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth gate: require admin/supervisor JWT — this endpoint reads full customer financial data
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const _callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: callerErr } = await _callerClient.auth.getUser();
    if (callerErr || !callerUser?.id) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const _sb = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: _role } = await _sb
      .from("user_roles").select("role").eq("user_id", callerUser.id).eq("status", "active").maybeSingle();
    const _coreRoles = ["admin", "super_admin", "owner", "supervisor", "employee", "billing_admin"];
    if (!_role || !_coreRoles.includes(_role.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { customerId } = await req.json();
    if (!customerId || typeof customerId !== "string") {
      return new Response(JSON.stringify({ error: "customerId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: cust }, { data: invs }, { data: svcs }] = await Promise.all([
      sb.from("billing_customers").select("id, first_name, last_name, email, user_id").eq("id", customerId).maybeSingle(),
      sb.from("billing_invoices").select("status, total, balance, due_date").eq("customer_id", customerId).limit(100),
      sb.from("billing_services" as any).select("status, service_type, plan_name").eq("customer_id", customerId).limit(50),
    ]);

    const now = Date.now();
    const overdue = (invs ?? []).filter((i: any) => Number(i.balance ?? 0) > 0 && i.due_date && new Date(i.due_date).getTime() < now);
    const balance = (invs ?? []).reduce((acc: number, i: any) => acc + Number(i.balance ?? 0), 0);
    const activeSvcs = (svcs ?? []).filter((s: any) => ["active","activated"].includes(String(s.status ?? "").toLowerCase()));

    const ctx = {
      client: cust ? { name: [cust.first_name, cust.last_name].filter(Boolean).join(" "), email: cust.email } : null,
      balance_due: Math.round(balance * 100) / 100,
      overdue_invoices: overdue.length,
      invoices_total: (invs ?? []).length,
      active_services: activeSvcs.map((s: any) => ({ type: s.service_type, plan: s.plan_name, status: s.status })),
      services_total: (svcs ?? []).length,
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Contexte client:\n${JSON.stringify(ctx, null, 2)}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: `AI gateway ${aiRes.status}`, detail: txt }), {
        status: aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await aiRes.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = { summary: content, actions: [] }; }

    const safeActions = Array.isArray(parsed.actions)
      ? parsed.actions
          .filter((a: any) => a && typeof a.id === "string" && ACTION_IDS.includes(a.id))
          .slice(0, 3)
          .map((a: any) => ({ id: a.id, reason: String(a.reason ?? "").slice(0, 200) }))
      : [];

    return new Response(JSON.stringify({
      summary: String(parsed.summary ?? "").slice(0, 800),
      actions: safeActions,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
