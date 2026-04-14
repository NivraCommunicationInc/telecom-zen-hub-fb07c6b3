/**
 * field-commission-engine — Commission summary, detail, and dispute API.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { requireAuth, checkBodySize, sanitizeString } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const cors = handleCorsPreflightRequest(req);
  if (cors) return cors;

  const origin = req.headers.get("origin");
  const headers = { ...getCorsHeaders(origin), "Content-Type": "application/json" };

  try {
    checkBodySize(req);
    const { userId } = await requireAuth(req);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "summary";

    // ── Summary ──
    if (action === "summary") {
      const { data: commissions } = await admin
        .from("sales_commissions")
        .select("commission_amount, status, bonus_amount")
        .eq("salesperson_id", userId);

      const summary = {
        pending: 0,
        awaiting_activation: 0,
        approved: 0,
        paid: 0,
        disputed: 0,
        total: 0,
        count_by_status: {} as Record<string, number>,
      };

      for (const c of commissions || []) {
        const amount = Number(c.commission_amount || 0) + Number(c.bonus_amount || 0);
        summary.total += amount;

        const status = c.status || "pending";
        summary.count_by_status[status] = (summary.count_by_status[status] || 0) + 1;

        if (["pending", "pending_activation"].includes(status)) {
          summary.pending += amount;
        } else if (["validated", "approved", "payable"].includes(status)) {
          summary.approved += amount;
        } else if (status === "paid" || status === "included_in_payroll") {
          summary.paid += amount;
        }
      }

      // Get disputes
      const { data: disputes } = await admin
        .from("commission_disputes")
        .select("id, status")
        .eq("agent_id", userId)
        .eq("status", "open");

      summary.disputed = disputes?.length || 0;

      // Get payouts
      const { data: payouts } = await admin
        .from("field_commission_payouts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      return new Response(JSON.stringify({
        summary,
        recent_payouts: payouts || [],
      }), { headers });
    }

    // ── List commissions ──
    if (action === "list") {
      const status = url.searchParams.get("status");

      let query = admin
        .from("sales_commissions")
        .select("*, field_sales_orders!field_order_id(customer_name, services)")
        .eq("salesperson_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) throw error;

      // Add status explanation to each commission
      const enriched = (data || []).map((c: any) => ({
        ...c,
        status_explanation: getStatusExplanation(c.status),
        next_action: getNextAction(c.status),
      }));

      return new Response(JSON.stringify({ commissions: enriched }), { headers });
    }

    // ── Detail ──
    if (action === "detail") {
      const commissionId = url.searchParams.get("commission_id");
      if (!commissionId) return new Response(JSON.stringify({ error: "commission_id requis" }), { status: 400, headers });

      const { data: commission } = await admin
        .from("sales_commissions")
        .select("*")
        .eq("id", commissionId)
        .eq("salesperson_id", userId)
        .single();

      if (!commission) {
        return new Response(JSON.stringify({ error: "Commission introuvable" }), { status: 404, headers });
      }

      // Get related disputes
      const { data: disputes } = await admin
        .from("commission_disputes")
        .select("*")
        .eq("commission_id", commissionId)
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify({
        commission: {
          ...commission,
          status_explanation: getStatusExplanation(commission.status),
          next_action: getNextAction(commission.status),
        },
        disputes: disputes || [],
      }), { headers });
    }

    // ── Create dispute (POST) ──
    if (action === "dispute" && req.method === "POST") {
      const body = await req.json();
      const commissionId = body.commission_id;
      const reason = sanitizeString(body.reason || "", 2000);

      if (!commissionId || !reason) {
        return new Response(JSON.stringify({ error: "commission_id et reason requis" }), { status: 400, headers });
      }

      // Verify the commission belongs to this agent
      const { data: commission } = await admin
        .from("sales_commissions")
        .select("id")
        .eq("id", commissionId)
        .eq("salesperson_id", userId)
        .single();

      if (!commission) {
        return new Response(JSON.stringify({ error: "Commission introuvable" }), { status: 404, headers });
      }

      const { data: dispute, error } = await admin
        .from("commission_disputes")
        .insert({
          commission_id: commissionId,
          agent_id: userId,
          reason,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, dispute }), { headers });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers });

  } catch (err: any) {
    const status = err.status || 500;
    return new Response(JSON.stringify({ error: err.message || "Erreur serveur" }), { status, headers });
  }
});

function getStatusExplanation(status: string): string {
  const explanations: Record<string, string> = {
    pending: "En attente de validation par un superviseur.",
    pending_activation: "La commission sera validée quand le service du client sera activé.",
    validated: "Commission validée, en attente d'inclusion dans le prochain cycle de paie.",
    approved: "Approuvée et prête pour le versement.",
    payable: "Montant confirmé, en file d'attente pour paiement.",
    included_in_payroll: "Incluse dans la prochaine fiche de paie.",
    paid: "Versée avec succès.",
    rejected: "Refusée. Consultez la raison pour plus de détails.",
    disputed: "Contestation en cours de traitement.",
  };
  return explanations[status] || "Statut en cours de traitement.";
}

function getNextAction(status: string): string {
  const actions: Record<string, string> = {
    pending: "Aucune action requise. Un superviseur doit valider.",
    pending_activation: "Le service client doit être activé pour débloquer la commission.",
    validated: "Sera automatiquement incluse dans le prochain cycle.",
    approved: "En attente du prochain traitement de paie.",
    payable: "Sera versée au prochain cycle de paiement.",
    included_in_payroll: "Vérifiez votre fiche de paie.",
    paid: "Aucune action. Montant versé.",
    rejected: "Vous pouvez contester si vous pensez que c'est une erreur.",
    disputed: "Un superviseur traitera votre contestation.",
  };
  return actions[status] || "";
}
