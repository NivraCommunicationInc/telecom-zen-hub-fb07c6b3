/**
 * useTransactionVisibility — Unified hook for operational transaction visibility.
 * Aggregates data from:
 *   - transaction_events (checkout lifecycle logs)
 *   - orders (incomplete, failed, abandoned)
 *   - billing_payments (orphan payments, pending confirmation)
 *   - billing_invoices (unlinked invoices)
 *
 * Provides categorized views for the Core admin Transactions page.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TransactionRow {
  id: string;
  category: "transaction_event" | "orphan_payment" | "incomplete_order" | "failed_order" | "pending_payment" | "abandoned_checkout" | "missing_invoice";
  date: string;
  customer_name: string | null;
  customer_email: string | null;
  amount: number | null;
  payment_method: string | null;
  paypal_reference: string | null;
  status: string;
  status_label: string;
  order_number: string | null;
  order_id: string | null;
  invoice_number: string | null;
  invoice_id: string | null;
  payment_number: string | null;
  failure_reason: string | null;
  action_needed: string;
  source_table: string;
  raw_id: string;
}

export type TransactionCategory =
  | "all"
  | "orphan_payment"
  | "incomplete_order"
  | "failed_order"
  | "pending_payment"
  | "abandoned_checkout"
  | "missing_invoice";

export function useTransactionVisibility() {
  return useQuery<TransactionRow[]>({
    queryKey: ["core-transaction-visibility"],
    queryFn: async () => {
      const rows: TransactionRow[] = [];

      // ═══ 1. ORPHAN PAYMENTS: Orders with PayPal capture but no billing_payment record ═══
      const { data: allOrders } = await supabase
        .from("orders")
        .select("id, order_number, status, payment_status, payment_method, provider_payment_id, payment_reference, total_amount, created_at, client_email, client_first_name, client_last_name, failure_reason")
        .order("created_at", { ascending: false })
        .limit(500);

      const { data: allPayments } = await supabase
        .from("billing_payments")
        .select("id, payment_number, amount, method, status, reference, provider_payment_id, received_at, created_at, invoice_id, customer_id, environment")
        .order("created_at", { ascending: false })
        .limit(500);

      const { data: allInvoices } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, order_id, status, total, customer_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      // Build lookup sets
      const paymentProviderIds = new Set((allPayments || []).map(p => p.provider_payment_id).filter(Boolean));
      const invoiceOrderIds = new Set((allInvoices || []).map(i => i.order_id).filter(Boolean));

      // Build a set of orders that have billing_invoices linked
      const confirmedOrderIds = new Set(
        (allInvoices || [])
          .filter(i => i.status !== "void" && i.status !== "cancelled")
          .map(i => i.order_id)
          .filter(Boolean)
      );

      for (const o of (allOrders || [])) {
        const customerName = [o.client_first_name, o.client_last_name].filter(Boolean).join(" ") || null;
        const isPaypal = (o.payment_method || "").toLowerCase().includes("paypal");

        // ANTI-REGRESSION: Skip orders that have a canonical confirmed status
        const isCanonicallyResolved = ["confirmed", "completed", "paid"].includes(o.status) && confirmedOrderIds.has(o.id);

        // ── Orphan PayPal: captured/paid but no billing_payment record
        if (isPaypal && o.provider_payment_id && !paymentProviderIds.has(o.provider_payment_id) && !isCanonicallyResolved) {
          rows.push({
            id: `orphan-${o.id}`,
            category: "orphan_payment",
            date: o.created_at,
            customer_name: customerName,
            customer_email: o.client_email,
            amount: o.total_amount,
            payment_method: o.payment_method,
            paypal_reference: o.provider_payment_id,
            status: "payment_orphaned",
            status_label: "Paiement orphelin",
            order_number: o.order_number,
            order_id: o.id,
            invoice_number: null,
            invoice_id: null,
            payment_number: null,
            failure_reason: "PayPal capturé mais aucun enregistrement billing_payment correspondant",
            action_needed: "Reconciliation manuelle requise",
            source_table: "orders",
            raw_id: o.id,
          });
        }

        // ── Orders without invoice (missing invoice link)
        if (!invoiceOrderIds.has(o.id) && !["cancelled", "draft"].includes(o.status)) {
          // Only flag if order has payment activity
          if (["captured", "paid", "pre_authorized"].includes(o.payment_status || "")) {
            rows.push({
              id: `missing-inv-${o.id}`,
              category: "missing_invoice",
              date: o.created_at,
              customer_name: customerName,
              customer_email: o.client_email,
              amount: o.total_amount,
              payment_method: o.payment_method,
              paypal_reference: o.provider_payment_id || null,
              status: "order_incomplete",
              status_label: "Facture manquante",
              order_number: o.order_number,
              order_id: o.id,
              invoice_number: null,
              invoice_id: null,
              payment_number: null,
              failure_reason: o.failure_reason || "Commande sans facture liée",
              action_needed: "Créer facture ou lier manuellement",
              source_table: "orders",
              raw_id: o.id,
            });
          }
        }

        // ── Failed orders
        if (o.failure_reason && !["completed", "cancelled"].includes(o.status)) {
          rows.push({
            id: `failed-${o.id}`,
            category: "failed_order",
            date: o.created_at,
            customer_name: customerName,
            customer_email: o.client_email,
            amount: o.total_amount,
            payment_method: o.payment_method,
            paypal_reference: o.provider_payment_id || null,
            status: "order_failed",
            status_label: "Commande échouée",
            order_number: o.order_number,
            order_id: o.id,
            invoice_number: null,
            invoice_id: null,
            payment_number: null,
            failure_reason: o.failure_reason,
            action_needed: "Vérifier et résoudre",
            source_table: "orders",
            raw_id: o.id,
          });
        }
      }

      // ═══ 2. PENDING PAYMENTS: billing_payments with status=pending ═══
      // Get customer info for payments
      const customerIds = [...new Set((allPayments || []).map(p => p.customer_id))];
      const { data: customers } = await supabase
        .from("billing_customers")
        .select("id, first_name, last_name, email")
        .in("id", customerIds.length > 0 ? customerIds : ["__none__"]);

      const customerMap = new Map((customers || []).map(c => [c.id, c]));
      const invoiceMap = new Map((allInvoices || []).map(i => [i.id, i]));

      for (const p of (allPayments || [])) {
        const cust = customerMap.get(p.customer_id);
        const inv = invoiceMap.get(p.invoice_id);
        const customerName = cust ? `${cust.first_name} ${cust.last_name}`.trim() : null;

        if (p.status === "pending") {
          rows.push({
            id: `pending-pay-${p.id}`,
            category: "pending_payment",
            date: p.received_at || p.created_at || "",
            customer_name: customerName,
            customer_email: cust?.email || null,
            amount: p.amount,
            payment_method: p.method,
            paypal_reference: p.provider_payment_id || null,
            status: "payment_pending",
            status_label: "Confirmation en attente",
            order_number: null,
            order_id: inv?.order_id || null,
            invoice_number: inv?.invoice_number || null,
            invoice_id: p.invoice_id || null,
            payment_number: p.payment_number,
            failure_reason: null,
            action_needed: "Confirmer ou rejeter le paiement",
            source_table: "billing_payments",
            raw_id: p.id,
          });
        }
      }

      // ═══ 3. TRANSACTION EVENTS: abandoned/failed checkouts from transaction_events ═══
      // CANONICAL: Exclude order_submitted — these are technical lifecycle traces.
      // Only show genuine failures/abandonments that have NO canonical confirmed order.
      const { data: events } = await supabase
        .from("transaction_events" as any)
        .select("*")
        .in("event_type", [
          "checkout_abandoned", "checkout_error", "payment_failed",
          "order_failed",
        ])
        .order("created_at", { ascending: false })
        .limit(200);

      // Build a set of order_numbers that have canonical confirmed/paid orders
      const confirmedOrderNumbers = new Set(
        (allOrders || [])
          .filter(o => ["confirmed", "completed", "paid", "processing", "shipped"].includes(o.status))
          .map(o => o.order_number)
          .filter(Boolean)
      );

      // Get user profiles for events
      const eventUserIds = [...new Set((events || []).map((e: any) => e.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", eventUserIds.length > 0 ? eventUserIds : ["__none__"]);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      for (const ev of (events || []) as any[]) {
        const profile = profileMap.get(ev.user_id);

        // ANTI-REGRESSION INVARIANT: If a canonical confirmed order exists for the
        // same order_number, suppress this technical event entirely.
        if (ev.order_number && confirmedOrderNumbers.has(ev.order_number)) continue;

        // Determine category
        let category: TransactionRow["category"] = "transaction_event";
        let statusLabel = ev.event_type;
        let actionNeeded = "Vérifier";

        if (ev.event_type === "checkout_abandoned") {
          category = "abandoned_checkout";
          statusLabel = "Checkout abandonné";
          actionNeeded = "Relance client potentielle";
        } else if (ev.event_type === "payment_failed") {
          category = "orphan_payment";
          statusLabel = "Paiement échoué";
          actionNeeded = "Vérifier avec le provider";
        } else if (ev.event_type === "order_failed") {
          category = "failed_order";
          statusLabel = "Commande échouée (event)";
          actionNeeded = "Investiguer l'erreur";
        } else if (ev.event_type === "checkout_error") {
          category = "abandoned_checkout";
          statusLabel = "Erreur checkout";
          actionNeeded = "Vérifier les logs";
        }

        // Avoid duplicates with order-based rows
        if (category === "failed_order" && ev.order_number) {
          const alreadyHasOrder = rows.some(r => r.order_number === ev.order_number && r.category === "failed_order");
          if (alreadyHasOrder) continue;
        }

        rows.push({
          id: `event-${ev.id}`,
          category,
          date: ev.created_at,
          customer_name: profile?.full_name || null,
          customer_email: profile?.email || null,
          amount: ev.amount,
          payment_method: (ev.metadata as any)?.method || null,
          paypal_reference: ev.paypal_order_id || ev.paypal_capture_id || null,
          status: ev.status || ev.event_type,
          status_label: statusLabel,
          order_number: ev.order_number || null,
          order_id: null,
          invoice_number: ev.invoice_number || null,
          invoice_id: null,
          payment_number: ev.payment_number || null,
          failure_reason: ev.error_message || null,
          action_needed: actionNeeded,
          source_table: "transaction_events",
          raw_id: ev.id,
        });
      }

      // Sort all rows by date descending
      rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return rows;
    },
    staleTime: 30_000,
  });
}

/** Compute category counts for KPIs */
export function getCategoryCounts(rows: TransactionRow[]) {
  return {
    total: rows.length,
    orphan_payment: rows.filter(r => r.category === "orphan_payment").length,
    incomplete_order: rows.filter(r => r.category === "incomplete_order").length,
    failed_order: rows.filter(r => r.category === "failed_order").length,
    pending_payment: rows.filter(r => r.category === "pending_payment").length,
    abandoned_checkout: rows.filter(r => r.category === "abandoned_checkout").length,
    missing_invoice: rows.filter(r => r.category === "missing_invoice").length,
  };
}
