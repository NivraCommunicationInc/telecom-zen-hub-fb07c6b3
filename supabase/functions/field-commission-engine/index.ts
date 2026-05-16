/**
 * field-commission-engine — Commission summary, list, detail, dispute, withdrawals.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkBodySize, sanitizeString } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const cors = handleCorsPreflightRequest(req);
  if (cors) return cors;

  const origin = req.headers.get("origin");
  const headers = { ...getCorsHeaders(origin), "Content-Type": "application/json" };

  try {
    checkBodySize(req);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw { status: 401, message: "Non authentifié" };
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw { status: 401, message: "Session invalide" };
    }

    const userId = user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "summary";
    console.log('[commission-engine] userId:', userId);
    console.log('[commission-engine] action:', action);

    if (action === "summary" && req.method === "GET") {
      const [commissionsRes, withdrawalsRes] = await Promise.all([
        admin.from("field_commissions").select("amount, status").eq("agent_id", userId),
        admin.from("commission_withdrawal_requests").select("amount, status").eq("agent_id", userId),
      ]);

      console.log('[commission-engine] rows:', commissionsRes.data);
      console.log('[commission-engine] error:', commissionsRes.error);

      const commissions = commissionsRes.data || [];
      const withdrawals = withdrawalsRes.data || [];

      let pending = 0, approved = 0, paid = 0, total = 0;
      const countByStatus: Record<string, number> = {};

      for (const commission of commissions) {
        const amount = Number(commission.amount || 0);
        total += amount;
        const status = commission.status || "pending";
        countByStatus[status] = (countByStatus[status] || 0) + 1;
        if (["pending", "pending_activation"].includes(status)) pending += amount;
        else if (["validated", "approved", "payable"].includes(status)) approved += amount;
        else if (status === "paid" || status === "included_in_payroll") paid += amount;
      }

      const pendingWithdrawals = withdrawals
        .filter((withdrawal: any) => ["pending", "approved", "processing"].includes(withdrawal.status))
        .reduce((sum: number, withdrawal: any) => sum + Number(withdrawal.amount), 0);

      const effectiveAvailable = Math.max(0, approved - pendingWithdrawals);
      const disputedCount = commissions.filter((commission: any) => ["disputed", "clawback", "rejected"].includes(commission.status)).length;

      return new Response(JSON.stringify({
        summary: { pending, approved, paid, total, effectiveAvailable, pendingWithdrawals, disputedCount, countByStatus, totalCommissions: commissions.length },
      }), { headers });
    }

    if (action === "list" && req.method === "GET") {
      const status = url.searchParams.get("status");
      let query = admin
        .from("field_commissions")
        .select("*")
        .eq("agent_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (status && status !== "all") query = query.eq("status", status);

      const { data, error } = await query;
      if (error) throw error;

      // Enrich with order_number + first forfait service type
      const orderIds = Array.from(
        new Set((data || []).map((c: any) => c.order_id).filter(Boolean))
      );
      const ordersMap: Record<string, { order_number: string | null; service_type: string | null }> = {};
      if (orderIds.length > 0) {
        const { data: orders } = await admin
          .from("orders")
          .select("id, order_number, order_items(service_type)")
          .in("id", orderIds);
        for (const o of orders || []) {
          const firstItem = Array.isArray((o as any).order_items) ? (o as any).order_items[0] : null;
          ordersMap[(o as any).id] = {
            order_number: (o as any).order_number || null,
            service_type: firstItem?.service_type || null,
          };
        }
      }

      const enriched = (data || []).map((commission: any) => {
        const oi = commission.order_id ? ordersMap[commission.order_id] : null;
        return {
          ...commission,
          order_number: oi?.order_number || null,
          order_service_type: oi?.service_type || null,
          status_explanation: getStatusExplanation(commission.status),
          next_action: getNextAction(commission.status),
        };
      });

      return new Response(JSON.stringify({ commissions: enriched }), { headers });
    }

    if (action === "detail" && req.method === "GET") {
      const commissionId = url.searchParams.get("commission_id");
      if (!commissionId) return new Response(JSON.stringify({ error: "commission_id requis" }), { status: 400, headers });

      const { data } = await admin.from("field_commissions").select("*").eq("id", commissionId).eq("agent_id", userId).single();
      if (!data) return new Response(JSON.stringify({ error: "Commission introuvable" }), { status: 404, headers });

      const { data: disputes } = await admin.from("commission_disputes").select("*").eq("commission_id", commissionId).order("created_at", { ascending: false });

      return new Response(JSON.stringify({
        commission: { ...data, status_explanation: getStatusExplanation(data.status), next_action: getNextAction(data.status) },
        disputes: disputes || [],
      }), { headers });
    }

    if (action === "withdrawals" && req.method === "GET") {
      const { data, error } = await admin
        .from("commission_withdrawal_requests")
        .select("*")
        .eq("agent_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return new Response(JSON.stringify({ withdrawals: data || [] }), { headers });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Méthode non supportée" }), { status: 405, headers });
    }

    const body = await req.json();

    if (action === "dispute") {
      const commissionId = body.commission_id;
      const reason = sanitizeString(body.reason || "", 2000);
      if (!commissionId || !reason) return new Response(JSON.stringify({ error: "commission_id et reason requis" }), { status: 400, headers });

      const { data: commission } = await admin.from("field_commissions").select("id").eq("id", commissionId).eq("agent_id", userId).single();
      if (!commission) return new Response(JSON.stringify({ error: "Commission introuvable" }), { status: 404, headers });

      const { data: dispute, error } = await admin
        .from("commission_disputes")
        .insert({ commission_id: commissionId, agent_id: userId, reason, status: "open" })
        .select()
        .single();
      if (error) throw error;

      await admin.from("field_commissions").update({ status: "disputed" as any, clawback_reason: `[CONTESTATION] ${reason}` }).eq("id", commissionId);

      return new Response(JSON.stringify({ success: true, dispute }), { headers });
    }

    if (action === "withdraw") {
      const amount = Number(body.amount);
      const method = sanitizeString(body.method || "paypal", 50).toLowerCase();
      const destination = sanitizeString(body.destination || "", 500);
      const notesInput = sanitizeString(body.notes || "", 2000);

      if (!amount || amount <= 0 || !destination) {
        return new Response(JSON.stringify({ error: "Montant et destination requis" }), { status: 400, headers });
      }

      if (method !== "paypal") {
        return new Response(JSON.stringify({ error: "PayPal uniquement" }), { status: 400, headers });
      }

      const { data: commissionsRes, error: commissionsError } = await admin
        .from("field_commissions")
        .select("amount, status")
        .eq("agent_id", userId);
      if (commissionsError) throw commissionsError;

      const { data: withdrawalsRes, error: withdrawalsError } = await admin
        .from("commission_withdrawal_requests")
        .select("amount, status")
        .eq("agent_id", userId);
      if (withdrawalsError) throw withdrawalsError;

      const approved = (commissionsRes || [])
        .filter((commission: any) => ["validated", "approved", "payable"].includes(commission.status))
        .reduce((sum: number, commission: any) => sum + Number(commission.amount || 0), 0);

      const pendingWithdrawals = (withdrawalsRes || [])
        .filter((withdrawal: any) => ["pending", "approved", "processing"].includes(withdrawal.status))
        .reduce((sum: number, withdrawal: any) => sum + Number(withdrawal.amount || 0), 0);

      const available = Math.max(0, approved - pendingWithdrawals);
      if (amount > available) {
        return new Response(JSON.stringify({ error: "Montant supérieur au solde disponible" }), { status: 400, headers });
      }

      const notes = [
        "Méthode: PayPal",
        `Destination: ${destination}`,
        notesInput || null,
      ].filter(Boolean).join(" | ");

      const { error } = await admin.from("commission_withdrawal_requests").insert({
        agent_id: userId,
        amount,
        status: "pending",
        notes,
      } as any);
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
  const messages: Record<string, string> = {
    pending: "En attente de validation.",
    pending_activation: "En attente d'activation du service client.",
    validated: "Validée, en attente de versement.",
    approved: "Approuvée, prête pour paiement.",
    paid: "Versée.",
    rejected: "Refusée.",
    disputed: "Contestation en cours.",
  };
  return messages[status] || "Statut en traitement.";
}

function getNextAction(status: string): string {
  const messages: Record<string, string> = {
    pending: "Un superviseur doit valider.",
    pending_activation: "Le service client doit être activé.",
    validated: "Sera incluse au prochain cycle.",
    approved: "En attente du prochain paiement.",
    paid: "Aucune action.",
    rejected: "Vous pouvez contester.",
    disputed: "Un superviseur traitera.",
  };
  return messages[status] || "";
}
