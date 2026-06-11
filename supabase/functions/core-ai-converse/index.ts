/**
 * core-ai-converse — conversational AI for Nivra Core operators.
 * Streams Gemini responses via Lovable AI, with rich client context loaded server-side.
 * Auth: requires Core admin.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMsg { role: "user" | "assistant"; content: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { customerId, messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context block if client selected
    let contextBlock = "Aucun client sélectionné. Tu peux répondre de manière générale sur les opérations Nivra.";
    if (customerId && typeof customerId === "string") {
      const [{ data: cust }, { data: invs }, { data: svcs }, { data: payments }] = await Promise.all([
        admin.from("billing_customers").select("id, first_name, last_name, email, phone, user_id, created_at")
          .eq("id", customerId).maybeSingle(),
        admin.from("billing_invoices").select("id, status, total, balance, due_date, created_at")
          .eq("customer_id", customerId).order("created_at", { ascending: false }).limit(20),
        admin.from("billing_services" as any).select("id, status, service_type, plan_name, monthly_price, started_at")
          .eq("customer_id", customerId).limit(20),
        admin.from("billing_payments" as any).select("amount, status, created_at, method")
          .eq("customer_id", customerId).order("created_at", { ascending: false }).limit(10),
      ]);

      const now = Date.now();
      const overdue = (invs ?? []).filter((i: any) => Number(i.balance ?? 0) > 0 && i.due_date && new Date(i.due_date).getTime() < now);
      const balance = (invs ?? []).reduce((acc: number, i: any) => acc + Number(i.balance ?? 0), 0);

      let tickets: any[] = [];
      if (cust?.user_id) {
        const { data } = await admin.from("tickets" as any)
          .select("id, status, subject, created_at").eq("user_id", cust.user_id).limit(10);
        tickets = (data ?? []) as any[];
      }

      const maskEmail = (e: string | null) => e ? e.replace(/^(.{2}).*@/, "$1***@") : null;
      const maskPhone = (p: string | null) => p ? p.replace(/\d(?=\d{2})/g, "*") : null;

      contextBlock = JSON.stringify({
        client: cust ? {
          nom: [cust.first_name, cust.last_name].filter(Boolean).join(" "),
          email: maskEmail(cust.email),
          telephone: maskPhone(cust.phone),
          client_depuis: cust.created_at,
        } : null,
        finances: {
          balance_due_cad: Math.round(balance * 100) / 100,
          factures_total: (invs ?? []).length,
          factures_en_retard: overdue.length,
          dernieres_factures: (invs ?? []).slice(0, 5).map((i: any) => ({
            statut: i.status, total: i.total, solde: i.balance, echeance: i.due_date,
          })),
          derniers_paiements: (payments ?? []).slice(0, 5).map((p: any) => ({
            montant: p.amount, statut: p.status, date: p.created_at, methode: p.method,
          })),
        },
        services: (svcs ?? []).map((s: any) => ({
          type: s.service_type, forfait: s.plan_name, statut: s.status,
          prix_mensuel: s.monthly_price, debut: s.started_at,
        })),
        tickets_recents: tickets.map((t: any) => ({
          sujet: t.subject, statut: t.status, date: t.created_at,
        })),
      }, null, 2);
    }

    const SYSTEM = `Tu es l'assistant vocal Nivra Télécom (Québec), spécialisé pour les opérateurs Core.
Tu parles en FRANÇAIS québécois professionnel, naturel, concis (réponses de 1 à 4 phrases sauf si on te demande un détail).
Ton ton est posé, expert, légèrement chaleureux — comme un collègue senior qui aide.
Tu as accès au contexte client réel ci-dessous. Quand on te pose une question, base ta réponse sur ces données.
Tu N'INVENTES JAMAIS de chiffres ou de faits. Si une donnée manque, dis-le clairement.
Tu peux suggérer une action (suspendre, créer facture, envoyer email, ouvrir ticket) mais tu ne l'exécutes pas — l'opérateur le fera dans la page Core appropriée.
Évite les listes à puces — parle de manière naturelle comme à l'oral.
Ne dis JAMAIS "voici comment ça fonctionne" ni d'introduction méta — réponds directement à la question.

CONTEXTE CLIENT ACTUEL :
${contextBlock}`;

    const aiMessages = [
      { role: "system", content: SYSTEM },
      ...messages.slice(-20).map((m: ChatMsg) => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      const status = aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 502;
      return new Response(JSON.stringify({ error: `AI gateway ${aiRes.status}`, detail: txt }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiRes.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
