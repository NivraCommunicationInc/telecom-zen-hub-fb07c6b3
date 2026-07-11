/**
 * WorkQueuePage — Nivra Core operational work queue (rebuilt).
 * Real-time SLA-tracked view of all active orders.
 * Routed at /core/work-queue.
 */
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search, RefreshCw, ArrowRight, Package, AlertTriangle, ShieldCheck,
  Zap, Clock, X, Mail, ExternalLink, CheckCircle2, Loader2, CreditCard,
} from "lucide-react";
import { format, formatDistanceToNowStrict, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { corePath } from "@/core-app/lib/corePaths";

import { logActivityLog } from "@/lib/logActivityLog";
/* ── Types ── */
interface QueueOrder {
  id: string;
  order_number: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  status: string;
  payment_status: string | null;
  kyc_status: string | null;
  service_type: string | null;
  total_amount: number | null;
  created_at: string;
  shipping_city: string | null;
  sla_status: string | null;
  fulfillment_assigned_at: string | null;
}

const TERMINAL_STATUSES = ["completed", "cancelled", "refunded"];
const SLA_BREACH_HOURS = 72; // realistic telecom SLA threshold

/* ── Zone classification ── */
function getZone(city: string | null): string {
  if (!city) return "Autre";
  const c = city.toLowerCase().trim();
  if (c.includes("montréal") || c.includes("montreal")) return "Montréal";
  if (c.includes("laval")) return "Laval";
  if (c.includes("longueuil")) return "Longueuil";
  if (
    c.includes("terrebonne") || c.includes("repentigny") || c.includes("mascouche") ||
    c.includes("blainville") || c.includes("mirabel") || c.includes("rosemère") ||
    c.includes("rosemere") || c.includes("bois-des-filion") || c.includes("lorraine")
  ) return "Rive-Nord";
  if (
    c.includes("brossard") || c.includes("saint-hubert") || c.includes("st-hubert") ||
    c.includes("boucherville") || c.includes("saint-bruno") || c.includes("st-bruno") ||
    c.includes("chambly") || c.includes("saint-lambert") || c.includes("st-lambert")
  ) return "Rive-Sud";
  return "Autre";
}

/* ── SLA helper ── */
function getSlaInfo(createdAt: string, status: string) {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const hours = (now - created) / (1000 * 60 * 60);
  const isTerminal = TERMINAL_STATUSES.includes(status);
  if (isTerminal) {
    return { hours, label: "—", tone: "neutral" as const, severity: 0 };
  }
  let tone: "red" | "amber" | "green" = "green";
  let severity = 0;
  if (hours > SLA_BREACH_HOURS) { tone = "red"; severity = 3; }
  else if (hours > 12) { tone = "amber"; severity = 2; }
  else if (hours > 4) { tone = "amber"; severity = 1; }
  const label = formatDistanceToNowStrict(new Date(createdAt), { locale: fr, addSuffix: false });
  return { hours, label, tone, severity };
}

/* ── Translation helpers ── */
function translateSla(value: string | null): string {
  if (!value) return "—";
  const v = value.toLowerCase();
  if (v === "on_time" || v === "ontime") return "À jour";
  if (v === "overdue" || v === "breached") return "En retard";
  if (v === "urgent" || v === "at_risk") return "Urgent";
  return value;
}

function translateKyc(value: string | null): string {
  if (!value) return "—";
  const v = value.toLowerCase();
  if (v === "approved" || v === "verified") return "Approuvé";
  if (v === "pending") return "En attente";
  if (v === "rejected") return "Rejeté";
  if (v === "not_required" || v === "none") return "Non requis";
  return value;
}

function translateStatus(value: string | null): string {
  if (!value) return "—";
  const map: Record<string, string> = {
    pending_admin_review: "Révision admin",
    confirmed: "Confirmé",
    activated: "Activé",
    provisioning_failed: "Échec provisionnement",
    cancelled: "Annulé",
    submitted: "Soumis",
    pending: "En attente",
    fraud: "Fraude",
    completed: "Complété",
    in_progress: "En cours",
    processing: "Traitement",
    shipped: "Expédié",
    delivered: "Livré",
    installed: "Installé",
    on_hold: "En attente",
    hold: "En attente",
    incomplete: "Incomplet",
    failed: "Échoué",
    refunded: "Remboursé",
    invalid_payment: "Paiement invalide",
  };
  return map[value.toLowerCase()] || value;
}

/* ── Current workflow step resolver ── */
function getCurrentStep(order: {
  status: string;
  payment_status: string | null;
  kyc_status: string | null;
}): string {
  const s = (order.status || "").toLowerCase();
  // Terminal states
  if (s === "completed") return "Terminé";
  if (s === "activated") return "Service actif";
  if (s === "cancelled") return "Annulée";
  if (s === "fraud") return "Examen fraude";
  if (s === "provisioning_failed") return "Échec provisionnement";
  if (s === "invalid_payment") return "Paiement invalide";
  if (s === "on_hold" || s === "hold") return "En suspens";

  // Payment first
  const pay = (order.payment_status || "").toLowerCase();
  if (pay && pay !== "paid" && pay !== "captured" && pay !== "completed") {
    if (pay === "failed") return "Paiement échoué";
    if (pay === "pending" || pay === "unpaid") return "Paiement";
    if (pay === "authorized") return "Capture paiement";
  }

  // KYC
  const kyc = (order.kyc_status || "").toLowerCase();
  if (kyc === "pending") return "Vérification KYC";
  if (kyc === "rejected") return "KYC rejeté";

  // Status-driven
  if (s === "pending" || s === "submitted") return "Traitement initial";
  if (s === "pending_admin_review") return "Révision admin";
  if (s === "confirmed") return "Préparation activation";
  if (s === "in_progress" || s === "processing") return "Provisionnement";
  if (s === "shipped") return "Livraison";
  if (s === "delivered" || s === "installed") return "Activation";

  return translateStatus(order.status);
}

/* ── Status badge ── */
function StatusPill({ value, kind = "status" }: { value: string | null; kind?: "status" | "kyc" | "sla" }) {
  if (!value) return <span className="text-[11px] text-[hsl(220,10%,40%)]">—</span>;
  const v = value.toLowerCase();
  let cls = "bg-[hsl(220,15%,18%)] text-[hsl(220,10%,70%)] border-[hsl(220,15%,22%)]";
  if (kind === "status") {
    if (["completed", "activated", "delivered"].includes(v)) cls = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    else if (["cancelled", "refunded", "failed"].includes(v)) cls = "bg-red-500/10 text-red-400 border-red-500/20";
    else if (["pending", "submitted"].includes(v)) cls = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    else if (["in_progress", "processing", "shipped"].includes(v)) cls = "bg-violet-500/10 text-violet-400 border-violet-500/20";
    else if (["on_hold", "hold", "incomplete"].includes(v)) cls = "bg-amber-500/10 text-amber-400 border-amber-500/20";
  } else if (kind === "kyc") {
    if (v === "approved" || v === "verified") cls = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    else if (v === "pending") cls = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    else if (v === "rejected") cls = "bg-red-500/10 text-red-400 border-red-500/20";
    else if (v === "none" || v === "not_required") cls = "bg-[hsl(220,15%,18%)] text-[hsl(220,10%,55%)] border-[hsl(220,15%,22%)]";
  }
  const display = kind === "kyc" ? translateKyc(value) : kind === "sla" ? translateSla(value) : translateStatus(value);
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${cls}`}>
      {display}
    </span>
  );
}

/* ── Stat card ── */
function StatCardLocal({ icon: Icon, label, value, tone = "neutral" }: {
  icon: React.ElementType; label: string; value: number | string;
  tone?: "neutral" | "red" | "amber" | "emerald";
}) {
  const toneClasses = {
    neutral: "text-white",
    red: "text-red-400",
    amber: "text-amber-400",
    emerald: "text-emerald-400",
  };
  const iconClasses = {
    neutral: "text-[hsl(220,10%,45%)] bg-[hsl(220,15%,16%)]",
    red: "text-red-400 bg-red-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
  };
  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[#0d1421] p-3.5">
      <div className="flex items-center gap-2.5">
        <div className={`h-8 w-8 rounded-md flex items-center justify-center ${iconClasses[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className={`text-2xl font-bold tabular-nums leading-none ${toneClasses[tone]}`}>{value}</p>
          <span className="text-[11px] text-[hsl(220,10%,50%)]">{label}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
const PAGE_SIZE = 25;

const WorkQueuePage = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("tous");
  const [typeFilter, setTypeFilter] = useState<string>("tous");
  const [slaFilter, setSlaFilter] = useState<string>("tous");
  const [zoneFilter, setZoneFilter] = useState<string>("tous");
  const [kycFilter, setKycFilter] = useState<string>("tous");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Live timer for SLA refresh
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(i);
  }, []);

  const { data: cardIntents = [], refetch: refetchCards } = useQuery({
    queryKey: ["work-queue-card-intents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_payment_intents")
        .select("id, card_last4, card_brand, card_expiry, card_name, amount, currency, customer_name, customer_email, status, expires_at, created_at")
        .eq("status", "pending_processing")
        .order("created_at", { ascending: true });
return data || [];
    },
    refetchInterval: 60_000,
  });

  const processCard = useMutation({
    mutationFn: async (_intentId: string) => {
      throw new Error("PayPal décommissionné (Phase 3.B). Utilisez le flux Square pour traiter ce paiement carte.");
    },
    onError: (e: Error) => toast.error("PayPal désactivé", { description: e.message }),
  });

  const { data: orders = [], isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["work-queue-all-orders"],
    queryFn: async (): Promise<QueueOrder[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, client_first_name, client_last_name, client_email, client_phone, status, payment_status, kyc_status, service_type, total_amount, created_at, shipping_city, sla_status, fulfillment_assigned_at")
        .eq("environment", "live")
        .order("created_at", { ascending: false })
        .limit(500);
return (data || []) as QueueOrder[];
    },
    refetchInterval: 30_000,
  });

  // Stats
  const stats = useMemo(() => {
    const todayStart = startOfDay(new Date()).getTime();
    const cutoffBreach = Date.now() - SLA_BREACH_HOURS * 60 * 60 * 1000;
    let active = 0, slaBreached = 0, kycPending = 0, activatedToday = 0;
    for (const o of orders) {
      const isTerminal = TERMINAL_STATUSES.includes(o.status);
      if (!isTerminal) {
        active++;
        if (new Date(o.created_at).getTime() < cutoffBreach) slaBreached++;
        if (o.kyc_status === "pending") kycPending++;
      }
      if ((o.status === "activated" || o.status === "completed") && new Date(o.created_at).getTime() >= todayStart) {
        activatedToday++;
      }
    }
    return { active, slaBreached, kycPending, activatedToday };
  }, [orders]);

  // Apply filters + sort by SLA desc
  const filtered = useMemo(() => {
    void tick; // re-evaluate when tick changes
    const q = search.trim().toLowerCase();
    return orders
      .filter(o => {
        if (statusFilter !== "tous" && o.status !== statusFilter) return false;
        if (typeFilter !== "tous" && o.service_type !== typeFilter) return false;
        if (zoneFilter !== "tous" && getZone(o.shipping_city) !== zoneFilter) return false;
        if (kycFilter !== "tous") {
          const k = (o.kyc_status || "").toLowerCase();
          if (kycFilter === "pending" && k !== "pending") return false;
          if (kycFilter === "approved" && k !== "approved" && k !== "verified") return false;
          if (kycFilter === "rejected" && k !== "rejected") return false;
          if (kycFilter === "not_required" && k !== "not_required" && k !== "none" && k !== "") return false;
        }
        if (slaFilter !== "tous") {
          const { hours } = getSlaInfo(o.created_at, o.status);
          if (slaFilter === "depasse" && hours <= 24) return false;
          if (slaFilter === "urgent" && (hours > 4 || hours <= 0)) return false;
          if (slaFilter === "normal" && hours > 4) return false;
        }
        if (q) {
          const fullName = `${o.client_first_name || ""} ${o.client_last_name || ""}`.toLowerCase();
          const hay = `${o.order_number || ""} ${fullName} ${o.client_email || ""} ${o.client_phone || ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const sa = getSlaInfo(a.created_at, a.status).hours;
        const sb = getSlaInfo(b.created_at, b.status).hours;
        return sb - sa;
      });
  }, [orders, search, statusFilter, typeFilter, slaFilter, zoneFilter, kycFilter, tick]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter, slaFilter, zoneFilter, kycFilter]);

  const selectedOrder = selectedId ? orders.find(o => o.id === selectedId) || null : null;

  const clearFilters = () => {
    setSearch(""); setStatusFilter("tous"); setTypeFilter("tous");
    setSlaFilter("tous"); setZoneFilter("tous"); setKycFilter("tous");
  };

  const hasActiveFilter = search || statusFilter !== "tous" || typeFilter !== "tous" ||
    slaFilter !== "tous" || zoneFilter !== "tous" || kycFilter !== "tous";

  return (
    <div className="min-h-screen bg-[#111827] -m-6 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">File de travail</h1>
          <p className="text-[12px] text-[hsl(220,10%,50%)] mt-0.5">
            Suivi en temps réel · {filtered.length} commande{filtered.length !== 1 ? "s" : ""}
            {dataUpdatedAt > 0 && (
              <span className="ml-2 opacity-60">
                · maj {format(new Date(dataUpdatedAt), "HH:mm:ss")}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-md border border-[hsl(220,15%,20%)] bg-[#0d1421] px-3 py-1.5 text-[11px] font-medium text-[hsl(220,10%,60%)] hover:text-white hover:border-emerald-500/40 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Rafraîchir
        </button>
      </div>

      {/* SECTION 1 — Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCardLocal icon={Package} label="Commandes actives" value={isLoading ? "—" : stats.active} tone="neutral" />
        <StatCardLocal icon={AlertTriangle} label={`SLA dépassés (>${SLA_BREACH_HOURS}h)`} value={isLoading ? "—" : stats.slaBreached} tone={stats.slaBreached > 0 ? "red" : "neutral"} />
        <StatCardLocal icon={ShieldCheck} label="En attente KYC" value={isLoading ? "—" : stats.kycPending} tone={stats.kycPending > 0 ? "amber" : "neutral"} />
        <StatCardLocal icon={Zap} label="Activations aujourd'hui" value={isLoading ? "—" : stats.activatedToday} tone="emerald" />
      </div>

      {/* SECTION 1b — Card payment intents */}
      {cardIntents.length > 0 && (
        <div className="rounded-lg border border-violet-500/30 bg-gradient-to-br from-[#13102a] to-[#0d1421] p-4 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-violet-400" />
              <h2 className="text-sm font-semibold text-white">
                💳 Paiements carte en attente ({cardIntents.length})
              </h2>
            </div>
            <span className="text-[10px] text-violet-400">
              {cardIntents.reduce((s, c) => s + Number(c.amount), 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} à traiter
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,45%)] border-b border-[hsl(220,15%,16%)]">
                  <th className="pb-1.5 text-left pl-1">Client</th>
                  <th className="pb-1.5 text-left">Carte</th>
                  <th className="pb-1.5 text-left">Expiration</th>
                  <th className="pb-1.5 text-right">Montant</th>
                  <th className="pb-1.5 text-right">Date</th>
                  <th className="pb-1.5 text-right pr-1"></th>
                </tr>
              </thead>
              <tbody>
                {cardIntents.map(ci => {
                  const isProcessing = processCard.isPending && processCard.variables === ci.id;
                  const expiresMs = new Date(ci.expires_at).getTime() - Date.now();
                  const hoursLeft = Math.max(0, Math.floor(expiresMs / 3600000));
                  return (
                    <tr key={ci.id} className="border-b border-[hsl(220,15%,14%)] last:border-0">
                      <td className="py-2 pl-1">
                        <div className="text-white font-medium">{ci.customer_name}</div>
                        <div className="text-[10px] text-[hsl(220,10%,45%)] truncate max-w-[160px]">{ci.customer_email}</div>
                      </td>
                      <td className="py-2">
                        <span className="font-mono text-white">{(ci.card_brand || "card").toUpperCase()} •••• {ci.card_last4}</span>
                      </td>
                      <td className="py-2 text-[hsl(220,10%,65%)] font-mono">{ci.card_expiry}</td>
                      <td className="py-2 text-right tabular-nums font-semibold text-white">
                        {Number(ci.amount).toLocaleString("fr-CA", { style: "currency", currency: ci.currency || "CAD" })}
                      </td>
                      <td className="py-2 text-right text-[10px] text-[hsl(220,10%,50%)] whitespace-nowrap">
                        <div>{format(new Date(ci.created_at), "d MMM", { locale: fr })}</div>
                        <div className="text-[9px] text-amber-400">expire {hoursLeft}h</div>
                      </td>
                      <td className="py-2 pr-1 text-right">
                        <button
                          disabled
                          title="PayPal décommissionné — migrer vers Square"
                          className="inline-flex items-center gap-1 rounded-md bg-[#3a2f52] px-2.5 py-1 text-[11px] font-semibold text-white/60 cursor-not-allowed"
                        >
                          <CreditCard className="h-3 w-3" />
                          Square requis
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 2 — Filters */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[#0d1421] p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(220,10%,40%)]" />
            <input
              type="text"
              placeholder="Rechercher # commande, nom, email, téléphone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,18%)] rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-[hsl(220,10%,35%)] focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-md border border-[hsl(220,15%,20%)] px-2 py-1.5 text-[11px] text-[hsl(220,10%,60%)] hover:text-white hover:border-red-500/40 transition-colors"
            >
              <X className="h-3 w-3" /> Effacer
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          <FilterSelect label="Statut" value={statusFilter} onChange={setStatusFilter}
            options={["tous", "submitted", "pending", "in_progress", "activated", "completed", "cancelled"]} />
          <FilterSelect label="Type" value={typeFilter} onChange={setTypeFilter}
            options={["tous", "internet", "mobile", "tv", "bundle"]} />
          <FilterSelect label="SLA" value={slaFilter} onChange={setSlaFilter}
            options={["tous", "depasse", "urgent", "normal"]}
            renderOption={(v) => v === "depasse" ? `dépassé (>${SLA_BREACH_HOURS}h)` : v === "urgent" ? "urgent (<4h)" : v === "normal" ? "normal" : v} />
          <FilterSelect label="KYC" value={kycFilter} onChange={setKycFilter}
            options={["tous", "pending", "approved", "not_required", "rejected"]}
            renderOption={(v) => v === "tous" ? "tous" : translateKyc(v)} />
          <FilterSelect label="Zone" value={zoneFilter} onChange={setZoneFilter}
            options={["tous", "Montréal", "Laval", "Longueuil", "Rive-Nord", "Rive-Sud", "Autre"]} />
        </div>
      </div>

      {/* Body: table + side panel */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-3">
        {/* SECTION 3 — Table */}
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[#0d1421] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(220,20%,9%)] border-b border-[hsl(220,15%,16%)]">
                <tr className="text-left text-[10px] uppercase tracking-wider text-[hsl(220,10%,45%)]">
                  <th className="px-3 py-2 font-semibold">Commande</th>
                  <th className="px-3 py-2 font-semibold">Client</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Statut</th>
                  <th className="px-3 py-2 font-semibold">KYC</th>
                  <th className="px-3 py-2 font-semibold text-right">Montant</th>
                  <th className="px-3 py-2 font-semibold">SLA</th>
                  <th className="px-3 py-2 font-semibold">Étape</th>
                  <th className="px-3 py-2 font-semibold w-[80px]"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-[hsl(220,15%,14%)]">
                      <td colSpan={9} className="px-3 py-3">
                        <div className="h-4 w-full rounded bg-[hsl(220,15%,12%)] animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-12 text-center text-[hsl(220,10%,40%)] text-xs">
                      Aucune commande ne correspond aux filtres.
                    </td>
                  </tr>
                ) : (
                  pageRows.map(o => {
                    const sla = getSlaInfo(o.created_at, o.status);
                    const slaClass = sla.tone === "red" ? "text-red-400" : sla.tone === "amber" ? "text-amber-400" : sla.tone === "green" ? "text-emerald-400" : "text-[hsl(220,10%,40%)]";
                    const fullName = `${o.client_first_name || ""} ${o.client_last_name || ""}`.trim();
                    const isSelected = o.id === selectedId;
                    return (
                      <tr
                        key={o.id}
                        onClick={() => setSelectedId(o.id)}
                        className={`border-b border-[hsl(220,15%,14%)] last:border-0 cursor-pointer transition-colors ${isSelected ? "bg-[hsl(220,20%,13%)]" : "hover:bg-[hsl(220,15%,12%)]"}`}
                      >
                        <td className="px-3 py-2.5">
                          <Link to={corePath(`/orders/${o.id}`)} onClick={(e) => e.stopPropagation()} className="font-mono font-semibold text-white hover:text-emerald-400">
                            {o.order_number || o.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-white truncate max-w-[180px]">{fullName || "—"}</div>
                          <div className="text-[10px] text-[hsl(220,10%,45%)] truncate max-w-[180px]">{o.client_email || "—"}</div>
                        </td>
                        <td className="px-3 py-2.5 text-[hsl(220,10%,65%)] capitalize">{o.service_type || "—"}</td>
                        <td className="px-3 py-2.5"><StatusPill value={o.status} kind="status" /></td>
                        <td className="px-3 py-2.5"><StatusPill value={o.kyc_status} kind="kyc" /></td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[hsl(220,10%,75%)]">
                          {o.total_amount != null
                            ? o.total_amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })
                            : "—"}
                        </td>
                        <td className={`px-3 py-2.5 ${slaClass} font-medium tabular-nums whitespace-nowrap`}>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {sla.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[hsl(220,10%,65%)]">
                          {getCurrentStep(o)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Link
                            to={corePath(`/orders/${o.id}`)}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-md border border-[hsl(220,15%,20%)] px-2 py-1 text-[10px] font-medium text-[hsl(220,10%,65%)] hover:text-white hover:border-emerald-500/40 transition-colors"
                          >
                            Ouvrir
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-[hsl(220,15%,16%)] px-3 py-2 bg-[hsl(220,20%,9%)]">
              <span className="text-[11px] text-[hsl(220,10%,50%)]">
                Page {pageSafe} / {totalPages} · {filtered.length} résultats
              </span>
              <div className="flex gap-1">
                <button
                  disabled={pageSafe === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="rounded-md border border-[hsl(220,15%,20%)] px-2 py-1 text-[11px] text-[hsl(220,10%,65%)] hover:text-white hover:border-emerald-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >Préc.</button>
                <button
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="rounded-md border border-[hsl(220,15%,20%)] px-2 py-1 text-[11px] text-[hsl(220,10%,65%)] hover:text-white hover:border-emerald-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >Suiv.</button>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4 — Side preview */}
        <div className="hidden xl:block">
          {selectedOrder ? (
            <SidePreview order={selectedOrder} onClose={() => setSelectedId(null)} />
          ) : (
            <div className="rounded-lg border border-dashed border-[hsl(220,15%,18%)] bg-[#0d1421] p-6 text-center">
              <Package className="h-8 w-8 mx-auto text-[hsl(220,10%,30%)] mb-2" />
              <p className="text-xs text-[hsl(220,10%,45%)]">Sélectionnez une commande pour voir l'aperçu rapide</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Filter select component ── */
function FilterSelect({ label, value, onChange, options, renderOption }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  renderOption?: (v: string) => string;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-[hsl(220,10%,45%)] font-semibold mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,18%)] rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 capitalize"
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{renderOption ? renderOption(opt) : opt}</option>
        ))}
      </select>
    </div>
  );
}

/* ── Side preview ── */
function SidePreview({ order, onClose }: { order: QueueOrder; onClose: () => void }) {
  const sla = getSlaInfo(order.created_at, order.status);
  const fullName = `${order.client_first_name || ""} ${order.client_last_name || ""}`.trim();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const currentStep = getCurrentStep(order);

  // Step state derivation
  const stepStateLabel: string =
    ["completed", "activated"].includes(order.status?.toLowerCase()) ? "Complété"
    : ["cancelled", "fraud", "provisioning_failed", "invalid_payment", "on_hold", "hold"].includes(order.status?.toLowerCase()) ? "Bloqué"
    : "En cours";
  const stepStateColor =
    stepStateLabel === "Complété" ? "text-emerald-400"
    : stepStateLabel === "Bloqué" ? "text-red-400"
    : "text-blue-400";

  // Account number from canonical accounts table (via order user)
  const { data: accountInfo } = useQuery({
    queryKey: ["wq-account", order.id],
    queryFn: async () => {
      // Try via order.account_id first, then via client_email
      const { data: ord } = await supabase
        .from("orders")
        .select("account_id, user_id, client_email")
        .eq("id", order.id)
        .maybeSingle();
      if (ord?.account_id) {
        const { data: acc } = await supabase
          .from("accounts")
          .select("account_number")
          .eq("id", ord.account_id)
          .maybeSingle();
        if (acc?.account_number) return acc.account_number;
      }
      if (ord?.user_id) {
        const { data: acc } = await supabase
          .from("accounts")
          .select("account_number")
          .eq("client_id", ord.user_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (acc?.account_number) return acc.account_number;
      }
      return null;
    },
    staleTime: 60_000,
  });

  // Last activity entry
  const { data: lastActivity } = useQuery({
    queryKey: ["wq-last-activity", order.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("action, created_at, actor_name, actor_role")
        .eq("entity_type", "order")
        .eq("entity_id", order.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 30_000,
  });

  // Approve KYC mutation
  const approveKyc = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const reason = "Approuvé depuis la file de travail";

      // Try edge function if a session exists
      const { data: ord } = await supabase
        .from("orders")
        .select("identity_verification_session_id")
        .eq("id", order.id)
        .maybeSingle();

      if (ord?.identity_verification_session_id) {
        const resp = await supabase.functions.invoke("admin-review-verification", {
          body: {
            session_id: ord.identity_verification_session_id,
            decision: "approved",
            reason,
            idempotency_key: `kyc_approve_${ord.identity_verification_session_id}_${Date.now()}`,
          },
        });
        if (resp.error) throw resp.error;
      }

      const { error } = await supabase
        .from("orders")
        .update({
          kyc_status: "approved",
          id_verification_status: "verified",
          id_verified_at: now,
          id_verification_notes: reason,
          updated_at: now,
        })
        .eq("id", order.id);
await logActivityLog({
        entity_type: "order",
        entity_id: order.id,
        action: "kyc_approved",
        reason,
        user_id: order.id, // user_id is required, fallback to order id (RLS-safe)
        details: { source: "work_queue_panel", order_kyc_status: "approved" },
      });
    },
    onSuccess: () => {
      toast.success("KYC approuvé");
      qc.invalidateQueries({ queryKey: ["work-queue-all-orders"] });
      qc.invalidateQueries({ queryKey: ["wq-last-activity", order.id] });
    },
    onError: (err: any) => {
      toast.error(`Erreur: ${err?.message || "Approbation KYC échouée"}`);
    },
  });

  const notifyClient = () => {
    if (!order.client_email) {
      toast.error("Aucun email pour ce client");
      return;
    }
    const subject = encodeURIComponent(`Nivra Telecom — Commande ${order.order_number || ""}`);
    const body = encodeURIComponent(`Bonjour ${order.client_first_name || ""},\n\nNous vous contactons au sujet de votre commande #${order.order_number || order.id.slice(0, 8)}.\n\nCordialement,\nÉquipe Nivra`);
    window.location.href = `mailto:${order.client_email}?subject=${subject}&body=${body}`;
  };

  const payStatusFr =
    order.payment_status?.toLowerCase() === "paid" ? "Payé"
    : order.payment_status?.toLowerCase() === "pending" ? "En attente"
    : order.payment_status?.toLowerCase() === "failed" ? "Échoué"
    : order.payment_status?.toLowerCase() === "authorized" ? "Autorisé"
    : order.payment_status || "—";
  const payStatusColor =
    payStatusFr === "Payé" ? "text-emerald-400"
    : payStatusFr === "Échoué" ? "text-red-400"
    : payStatusFr === "En attente" ? "text-amber-400"
    : "text-[hsl(220,10%,70%)]";

  const slaBadge =
    sla.tone === "red" ? { label: "En retard", cls: "bg-red-500/15 text-red-400 border-red-500/30" }
    : sla.tone === "amber" ? { label: "Urgent", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" }
    : { label: "À jour", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };

  const isKycPending = (order.kyc_status || "").toLowerCase() === "pending";

  return (
    <div
      key={order.id}
      className="rounded-lg border border-slate-700 bg-[#0d1421] sticky top-4 animate-in slide-in-from-right-4 fade-in duration-200"
    >
      {/* HEADER */}
      <div className="flex items-start justify-between gap-2 px-3 py-2.5 border-b border-slate-700">
        <div className="min-w-0 flex-1">
          <div className="font-mono font-semibold text-white text-sm">
            {order.order_number || order.id.slice(0, 8)}
          </div>
          <div className="text-[11px] text-slate-400 truncate">{fullName || "—"}</div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <StatusPill value={order.status} kind="status" />
            <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${slaBadge.cls}`}>
              <Clock className="h-2.5 w-2.5 mr-1" />
              {slaBadge.label}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-white hover:bg-slate-800 shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Open button */}
      <div className="px-3 pt-3">
        <button
          onClick={() => navigate(corePath(`/orders/${order.id}`))}
          className="w-full flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ouvrir la commande
        </button>
      </div>

      <div className="p-3 space-y-3.5">
        {/* SECTION 1 — Client */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Client</p>
          <div className="space-y-0.5 text-[11px]">
            <div className="text-white">{fullName || "—"}</div>
            <div className="text-slate-400">{order.client_email || "—"}</div>
            <div className="text-slate-400">{order.client_phone || "—"}</div>
            <div className="text-slate-400 font-mono">
              {accountInfo ? `Compte #${accountInfo}` : "Aucun compte lié"}
            </div>
          </div>
        </div>

        {/* SECTION 2 — Commande */}
        <div className="border-t border-slate-800 pt-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Commande</p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <div className="text-slate-500 text-[10px]">Service</div>
              <div className="text-white capitalize">{order.service_type || "—"}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px]">Montant</div>
              <div className="text-white tabular-nums font-semibold">
                {order.total_amount != null
                  ? order.total_amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px]">Paiement</div>
              <div className={`font-medium ${payStatusColor}`}>{payStatusFr}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[10px]">KYC</div>
              <StatusPill value={order.kyc_status} kind="kyc" />
            </div>
          </div>
        </div>

        {/* SECTION 3 — Étape actuelle */}
        <div className="border-t border-slate-800 pt-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Étape actuelle</p>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-white">{currentStep}</span>
            <span className={`text-[10px] font-medium ${stepStateColor}`}>{stepStateLabel}</span>
          </div>
          <div className="text-[10px] text-slate-500 mb-2">
            Créée {format(new Date(order.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })} · {sla.label}
          </div>
          <div className="rounded-md bg-slate-800/40 border border-slate-700/40 px-2 py-1.5">
            <div className="text-[10px] text-slate-500">Dernière activité</div>
            {lastActivity ? (
              <>
                <div className="text-[11px] text-slate-200 truncate">{lastActivity.action}</div>
                <div className="text-[10px] text-slate-500">
                  {formatDistanceToNowStrict(new Date(lastActivity.created_at), { locale: fr, addSuffix: true })}
                  {lastActivity.actor_name && ` · ${lastActivity.actor_name}`}
                </div>
              </>
            ) : (
              <div className="text-[11px] text-slate-500 italic">Aucune activité enregistrée</div>
            )}
          </div>
        </div>

        {/* SECTION 4 — Actions rapides */}
        <div className="border-t border-slate-800 pt-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Actions rapides</p>

          {isKycPending && (
            <button
              onClick={() => approveKyc.mutate()}
              disabled={approveKyc.isPending}
              className="w-full flex items-center justify-center gap-1.5 rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-xs font-semibold text-white transition-colors"
            >
              {approveKyc.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Approuver KYC
            </button>
          )}

          <button
            onClick={notifyClient}
            disabled={!order.client_email}
            className="w-full flex items-center justify-center gap-1.5 rounded-md border border-slate-700 hover:border-blue-500/40 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 text-xs font-medium text-slate-300 transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
            Notifier client
          </button>

          <button
            onClick={() => navigate(corePath(`/orders/${order.id}`))}
            className="w-full flex items-center justify-center gap-1.5 rounded-md border border-slate-700 hover:border-emerald-500/40 hover:text-white px-3 py-2 text-xs font-medium text-slate-300 transition-colors"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Ouvrir commande
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkQueuePage;
