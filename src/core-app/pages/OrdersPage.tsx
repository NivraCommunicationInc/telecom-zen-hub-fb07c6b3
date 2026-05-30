/**
 * OrdersPage — Nivra Core ops queue (rebuilt visual layer per spec).
 *
 * Layout:
 *   [3 KPI cards: Dans les délais / À risque / En retard]
 *   [Search + status filters]
 *   [Vertical list of order rows]
 *     - Red left border on overdue
 *     - Order number, client, products, status, SLA, "Traiter →" pill button
 *
 * All data wiring (useAdminOrders, env filter, search, SLA computation) preserved.
 */
import { useState, useMemo } from "react";
import { useAdminOrders } from "@/core-app/hooks/useAdminOrders";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { Link, useNavigate } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import type { EnvironmentFilter } from "@/core-app/hooks/useEnvironmentFilter";
import { CoreEnvironmentToggle, TestBadge } from "@/core-app/components/CoreEnvironmentToggle";
import { Search, ShoppingCart, RefreshCw, Timer, AlertTriangle } from "lucide-react";
import { differenceInMinutes } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

/* ── SLA badge ── */
function getSlaBadge(
  deadline: string | null,
  status: string | null,
  orderStatus: string,
): { label: string; className: string; urgency: "ok" | "warning" | "overdue" } | null {
  if (["activated", "completed", "cancelled", "installation_completed", "delivered"].includes(orderStatus)) {
    return null;
  }
  if (!deadline) return null;
  const minsLeft = differenceInMinutes(new Date(deadline), new Date());
  if (status === "overdue" || minsLeft < 0) {
    const overdue = Math.abs(minsLeft);
    const label = overdue >= 60 ? `DÉPASSÉ ${Math.floor(overdue / 60)}h` : `DÉPASSÉ ${overdue}min`;
    return { label, className: "bg-core-danger/15 text-core-danger border-core-danger/30", urgency: "overdue" };
  }
  if (minsLeft < 60 || status === "warning") {
    return { label: `${minsLeft} min`, className: "bg-core-warning/15 text-core-warning border-core-warning/30", urgency: "warning" };
  }
  const hoursLeft = Math.floor(minsLeft / 60);
  return {
    label: `${hoursLeft}h restantes`,
    className: "bg-core-success/15 text-core-success border-core-success/30",
    urgency: "ok",
  };
}

const STATUS_FILTERS = [
  { label: "Tous", value: "" },
  { label: "Field Sales", value: "__source_field_sales" },
  { label: "Pending", value: "pending" },
  { label: "Validated", value: "validated" },
  { label: "Paid", value: "paid" },
  { label: "Pending Payment", value: "pending_payment" },
  { label: "Processing", value: "processing" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Activated", value: "activated" },
  { label: "Completed", value: "completed" },
  { label: "On Hold", value: "on_hold" },
  { label: "Cancelled", value: "cancelled" },
];

const OrdersPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function setOrderStatus(orderId: string, status: string, extra?: Record<string, any>) {
    const { error } = await supabase.from("orders").update({ status, ...(extra || {}) }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    toast.success(
      status === "activated" ? "Service activé — commission approuvée"
      : status === "on_hold" ? "Commande mise en attente"
      : status === "cancelled" ? "Commande annulée — commission révoquée"
      : "Statut mis à jour"
    );
    qc.invalidateQueries({ queryKey: ["admin-orders-v2"] });
  }

  async function cancelWithReason(orderId: string) {
    const reason = window.prompt("Raison de l'annulation (obligatoire) :");
    if (!reason || !reason.trim()) return;
    await setOrderStatus(orderId, "cancelled", { cancellation_reason: reason.trim() });
  }

  const [envFilter, setEnvFilter] = useState<EnvironmentFilter>("live");
  const { data: orders, isLoading, refetch } = useAdminOrders(envFilter);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Realtime: refresh when orders or field_payment_intents change
  usePortalRealtime(
    ["orders", "field_payment_intents"],
    [["admin-orders-v2", envFilter]],
  );

  const filtered = useMemo(() => {
    if (!orders) return [];
    let list = orders;
    if (statusFilter === "__source_field_sales") {
      list = list.filter((o) => o.source === "field_sales");
    } else if (statusFilter) {
      list = list.filter((o) => o.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.order_number?.toLowerCase().includes(q) ||
          o.client_full_name?.toLowerCase().includes(q) ||
          o.client_email?.toLowerCase().includes(q) ||
          o.account_number?.toLowerCase().includes(q) ||
          o.invoice_number?.toLowerCase().includes(q),
      );
    }
    // Sort: SLA ascending (most urgent first)
    return [...list].sort((a, b) => {
      const da = a.sla_deadline ? new Date(a.sla_deadline).getTime() : Number.POSITIVE_INFINITY;
      const db = b.sla_deadline ? new Date(b.sla_deadline).getTime() : Number.POSITIVE_INFINITY;
      return da - db;
    });
  }, [orders, search, statusFilter]);

  const counts = useMemo(() => {
    if (!orders) return { total: 0, onTime: 0, warning: 0, overdue: 0 };
    const terminal = ["activated", "completed", "cancelled", "installation_completed", "delivered"];
    const tracked = orders.filter((o) => o.sla_deadline && !terminal.includes(o.status));
    const now = Date.now();
    return {
      total: orders.length,
      onTime: tracked.filter((o) => {
        const dl = new Date(o.sla_deadline!).getTime();
        return o.sla_status !== "overdue" && dl - now > 60 * 60 * 1000;
      }).length,
      warning: tracked.filter((o) => {
        const dl = new Date(o.sla_deadline!).getTime();
        const minsLeft = (dl - now) / 60000;
        return o.sla_status === "warning" || (minsLeft >= 0 && minsLeft < 60);
      }).length,
      overdue: tracked.filter((o) => {
        const dl = new Date(o.sla_deadline!).getTime();
        return o.sla_status === "overdue" || dl < now;
      }).length,
    };
  }, [orders]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-core-fg tracking-tight">Commandes</h1>
          <p className="text-[12px] text-core-muted mt-0.5">
            Hub opérationnel · {counts.total} commande{counts.total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CoreEnvironmentToggle value={envFilter} onChange={setEnvFilter} />
          <Link
            to={corePath("/orders/manual")}
            className="inline-flex items-center gap-1.5 rounded-full border border-core-accent/50 bg-core-accent/15 px-3.5 py-1.5 text-[11px] font-semibold text-core-accent hover:bg-core-accent/25 transition-colors"
          >
            + Nouvelle commande manuelle
          </Link>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-full border border-core-border bg-core-card px-3.5 py-1.5 text-[11px] font-medium text-core-muted hover:text-core-fg hover:border-core-accent/40 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </button>
        </div>
      </div>

      {/* ═══ TOP — 3 KPI CARDS ═══ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            background: "#0D0D1A",
            border: "1px solid #1E1E2E",
            borderRadius: "10px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#10B981" }}>
            {isLoading ? "—" : counts.onTime}
          </div>
          <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>Dans les délais</div>
        </div>
        <div
          style={{
            background: "#0D0D1A",
            border: "1px solid #1E1E2E",
            borderRadius: "10px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#F59E0B" }}>
            {isLoading ? "—" : counts.warning}
          </div>
          <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>À risque</div>
        </div>
        <div
          style={{
            background: "#0D0D1A",
            border: "1px solid #1E1E2E",
            borderRadius: "10px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#EF4444" }}>
            {isLoading ? "—" : counts.overdue}
          </div>
          <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>En retard</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-lg border border-core-border bg-core-card px-3 py-2">
          <Search className="h-4 w-4 text-core-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par numéro, client, courriel, compte, facture…"
            className="flex-1 bg-transparent text-xs text-core-fg placeholder:text-core-muted-soft outline-none"
          />
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-core-border bg-core-card px-1 py-1 overflow-x-auto">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                statusFilter === f.value
                  ? "bg-core-accent/20 text-core-accent"
                  : "text-core-muted hover:text-core-fg"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ ORDER ROWS (vertical list) ═══ */}
      <div className="space-y-1.5">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-core-border bg-core-card h-[58px] animate-pulse"
              style={{ borderLeft: "3px solid transparent" }}
            />
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-core-border bg-core-card p-12 text-center text-core-muted">
            <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">
              {search || statusFilter
                ? "Aucune commande ne correspond aux filtres."
                : "Aucune commande trouvée."}
            </p>
          </div>
        ) : (
          filtered.map((o) => {
            const sla = getSlaBadge(o.sla_deadline, o.sla_status, o.status);
            const isOverdue = sla?.urgency === "overdue";
            const productSummary = [o.service_type, o.order_type].filter(Boolean).join(" · ") || "—";
            const amountLabel =
              o.total_amount != null
                ? `${Number(o.total_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`
                : "—";

            return (
              <div
                key={o.id}
                onClick={() => navigate(corePath(`/orders/${o.id}`))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  background: "#0D0D1A",
                  border: "1px solid #1E1E2E",
                  borderRadius: "8px",
                  cursor: "pointer",
                  borderLeft: isOverdue ? "3px solid #EF4444" : "3px solid transparent",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#12121F")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#0D0D1A")}
              >
                <div style={{ minWidth: "90px", color: "white", fontWeight: 700, fontSize: "13px" }}>
                  #{o.order_number || o.id.slice(0, 8)}
                  {o.environment === "test" && (
                    <span className="ml-1.5">
                      <TestBadge />
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      color: "white",
                      fontSize: "13px",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {o.client_full_name || "—"}
                  </div>
                  <div style={{ color: "#666", fontSize: "11px", marginTop: "2px" }}>
                    {productSummary} · {amountLabel}
                    {o.source === "field_sales" && o.agent_full_name && (
                      <> · <span style={{ color: "#A78BFA" }}>Agent: {o.agent_full_name}</span></>
                    )}
                  </div>
                </div>

                {o.source === "field_sales" && (
                  <span
                    className="shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap bg-[#7C3AED]/15 text-[#A78BFA] border-[#7C3AED]/40"
                    title="Vente terrain — Porte-à-porte"
                  >
                    🚪 Field Sales — Porte-à-porte
                  </span>
                )}

                <div className="shrink-0">
                  <StatusBadge label={o.status} variant={statusToVariant(o.status)} size="sm" />
                </div>

                {o.payment_method === "card_manual" && (
                  <span
                    className="shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap bg-[#7C3AED]/15 text-[#A78BFA] border-[#7C3AED]/40"
                    title="Paiement carte manuelle en attente de traitement"
                  >
                    💳 Carte manuelle
                  </span>
                )}

                {sla ? (
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${sla.className}`}
                  >
                    <Timer className="h-2.5 w-2.5" />
                    {sla.label}
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] text-core-muted-soft w-[60px] text-center">—</span>
                )}

                {o.source === "field_sales" && (
                  <div className="shrink-0 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {o.status !== "activated" && (
                      <button
                        onClick={() => setOrderStatus(o.id, "activated")}
                        className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1"
                        title="Active le service et déclenche la commission"
                      >
                        Activer le service
                      </button>
                    )}
                    {o.status !== "on_hold" && o.status !== "cancelled" && (
                      <button
                        onClick={() => setOrderStatus(o.id, "on_hold")}
                        className="rounded-full bg-orange-500 hover:bg-orange-400 text-white text-[10px] font-bold px-2.5 py-1"
                      >
                        Mettre en attente
                      </button>
                    )}
                    {o.status !== "cancelled" && (
                      <button
                        onClick={() => cancelWithReason(o.id)}
                        className="rounded-full bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold px-2.5 py-1"
                      >
                        Annuler
                      </button>
                    )}
                    {o.user_id && (
                      <button
                        onClick={() => navigate(corePath(`/clients/${o.user_id}`))}
                        className="rounded-full border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 text-[10px] font-bold px-2.5 py-1"
                      >
                        Voir le client
                      </button>
                    )}
                    {o.created_by_agent_id && (
                      <button
                        onClick={() => navigate(corePath(`/field-agents/${o.created_by_agent_id}`))}
                        className="rounded-full border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 text-[10px] font-bold px-2.5 py-1"
                      >
                        Contacter l'agent
                      </button>
                    )}
                  </div>
                )}

                <Link
                  to={corePath(`/orders/${o.id}`)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ textDecoration: "none" }}
                >
                  <button
                    style={{
                      background: "#7C3AED",
                      color: "white",
                      border: "none",
                      borderRadius: "50px",
                      padding: "6px 16px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Traiter →
                  </button>
                </Link>
              </div>
            );
          })
        )}
      </div>

      {/* Footer alert if overdue items present */}
      {!isLoading && counts.overdue > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-core-danger/30 bg-core-danger/5 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-core-danger shrink-0" />
          <p className="text-[11px] text-core-danger font-medium">
            {counts.overdue} commande{counts.overdue > 1 ? "s" : ""} en retard SLA — action requise
          </p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <p className="text-[11px] text-core-muted-soft text-center">
          {filtered.length} commande{filtered.length !== 1 ? "s" : ""} affichée
          {filtered.length !== 1 ? "s" : ""}
          {(search || statusFilter) && ` sur ${counts.total}`}
        </p>
      )}
    </div>
  );
};

export default OrdersPage;
