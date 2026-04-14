/**
 * field-commission-engine — Commission summary, list, detail, dispute, withdrawals.
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
    if (action === "summary" && req.method === "GET") {
      const [commissionsRes, withdrawalsRes] = await Promise.all([
        admin.from("sales_commissions").select("commission_amount, status, bonus_amount").eq("salesperson_id", userId),
        admin.from("commission_withdrawal_requests").select("amount, status").eq("agent_id", userId),
      ]);

      const commissions = commissionsRes.data || [];
      const withdrawals = withdrawalsRes.data || [];

      let pending = 0, approved = 0, paid = 0, total = 0;
      const countByStatus: Record<string, number> = {};

      for (const c of commissions) {
        const amt = Number(c.commission_amount || 0) + Number(c.bonus_amount || 0);
        total += amt;
        const s = c.status || "pending";
        countByStatus[s] = (countByStatus[s] || 0) + 1;
        if (["pending", "pending_activation"].includes(s)) pending += amt;
        else if (["validated", "approved", "payable"].includes(s)) approved += amt;
        else if (s === "paid" || s === "included_in_payroll") paid += amt;
      }

      const pendingWithdrawals = withdrawals.filter((w: any) => ["pending", "approved", "processing"].includes(w.status)).reduce((s: number, w: any) => s + Number(w.amount), 0);
      const effectiveAvailable = Math.max(0, approved - pendingWithdrawals);
      const disputedCount = commissions.filter((c: any) => ["disputed", "clawback", "rejected"].includes(c.status)).length;

      return new Response(JSON.stringify({
        summary: { pending, approved, paid, total, effectiveAvailable, pendingWithdrawals, disputedCount, countByStatus, totalCommissions: commissions.length },
      }), { headers });
    }

    // ── List commissions ──
    if (action === "list" && req.method === "GET") {
      const status = url.searchParams.get("status");
      let query = admin.from("sales_commissions").select("*, field_sales_orders!sales_commissions_field_order_id_fkey(customer_name, customer_email)").eq("salesperson_id", userId).order("created_at", { ascending: false }).limit(200);
      if (status && status !== "all") query = query.eq("status", status);

      const { data, error } = await query;
      if (error) throw error;

      const enriched = (data || []).map((c: any) => ({
        ...c,
        status_explanation: getStatusExplanation(c.status),
        next_action: getNextAction(c.status),
      }));

      return new Response(JSON.stringify({ commissions: enriched }), { headers });
    }

    // ── Detail ──
    if (action === "detail" && req.method === "GET") {
      const commissionId = url.searchParams.get("commission_id");
      if (!commissionId) return new Response(JSON.stringify({ error: "commission_id requis" }), { status: 400, headers });

      const { data } = await admin.from("sales_commissions").select("*").eq("id", commissionId).eq("salesperson_id", userId).single();
      if (!data) return new Response(JSON.stringify({ error: "Commission introuvable" }), { status: 404, headers });

      const { data: disputes } = await admin.from("commission_disputes").select("*").eq("commission_id", commissionId).order("created_at", { ascending: false });

      return new Response(JSON.stringify({ commission: { ...data, status_explanation: getStatusExplanation(data.status), next_action: getNextAction(data.status) }, disputes: disputes || [] }), { headers });
    }

    // ── Withdrawals list ──
    if (action === "withdrawals" && req.method === "GET") {
      const { data, error } = await admin.from("commission_withdrawal_requests").select("*").eq("agent_id", userId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return new Response(JSON.stringify({ withdrawals: data || [] }), { headers });
    }

    // POST actions
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "Méthode non supportée" }), { status: 405, headers });

    const body = await req.json();

    // ── Dispute ──
    if (action === "dispute") {
      const commissionId = body.commission_id;
      const reason = sanitizeString(body.reason || "", 2000);
      if (!commissionId || !reason) return new Response(JSON.stringify({ error: "commission_id et reason requis" }), { status: 400, headers });

      const { data: commission } = await admin.from("sales_commissions").select("id").eq("id", commissionId).eq("salesperson_id", userId).single();
      if (!commission) return new Response(JSON.stringify({ error: "Commission introuvable" }), { status: 404, headers });

      const { data: dispute, error } = await admin.from("commission_disputes").insert({ commission_id: commissionId, agent_id: userId, reason, status: "open" }).select().single();
      if (error) throw error;

      // Update commission status
      await admin.from("sales_commissions").update({ status: "disputed" as any, rejection_reason: `[CONTESTATION] ${reason}` }).eq("id", commissionId);

      return new Response(JSON.stringify({ success: true, dispute }), { headers });
    }

    // ── Withdraw ──
    if (action === "withdraw") {
      const amount = Number(body.amount);
      const destination = sanitizeString(body.destination || "", 500);
      if (!amount || amount <= 0 || !destination) return new Response(JSON.stringify({ error: "Montant et destination requis" }), { status: 400, headers });

      const notes = [body.method ? `Méthode: ${body.method}` : null, `Destination: ${destination}`, body.notes?.trim() || null].filter(Boolean).join(" | ");

      const { error } = await admin.from("commission_withdrawal_requests").insert({ agent_id: userId, amount, notes } as any);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers });
  } catch (err: any) {
    const status = err.status || 500;
    return new Response(JSON.stringify({ error: err.message || "Erreur serveur" }), { status, headers });
  }
});

function getStatusExplanation(status: string): string {
  const m: Record<string, string> = { pending: "En attente de validation.", pending_activation: "En attente d'activation du service client.", validated: "Validée, en attente de versement.", approved: "Approuvée, prête pour paiement.", paid: "Versée.", rejected: "Refusée.", disputed: "Contestation en cours." };
  return m[status] || "Statut en traitement.";
}

function getNextAction(status: string): string {
  const m: Record<string, string> = { pending: "Un superviseur doit valider.", pending_activation: "Le service client doit être activé.", validated: "Sera incluse au prochain cycle.", approved: "En attente du prochain paiement.", paid: "Aucune action.", rejected: "Vous pouvez contester.", disputed: "Un superviseur traitera." };
  return m[status] || "";
}
