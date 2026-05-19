/**
 * CrmCenter — Outbound Call Center main UI.
 * Shared by Field, OneView CS (Employee), and Core portals.
 *
 * Features:
 * - Realtime contact list with filters, search, lock indicators
 * - "Commencer l'appel" → locks contact 30 min, opens call dialog
 * - Outcome selection logs call + auto-routes (sold → sale form)
 * - Leaderboard sidebar
 * - Business hours warning
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { useCrmContacts } from "../hooks/useCrmContacts";
import { useCrmLock } from "../hooks/useCrmLock";
import { useCrmDuplicates } from "../hooks/useCrmDuplicates";
import { CrmCallDialog } from "./CrmCallDialog";
import { CrmContactDrawer } from "./CrmContactDrawer";
import { CrmLeaderboard } from "./CrmLeaderboard";
import { CrmSaleModal } from "./CrmSaleModal";
import { CrmAssignDialog } from "./CrmAssignDialog";
import { CrmQuickActions } from "./CrmQuickActions";
import { CrmQuickNoteDialog } from "./CrmQuickNoteDialog";
import { CrmScheduleCallbackDialog } from "./CrmScheduleCallbackDialog";
import { CrmKanbanView } from "./CrmKanbanView";
import { CrmTransferDialog } from "./CrmTransferDialog";
import { CrmFollowUpEmailDialog } from "./CrmFollowUpEmailDialog";
import { CrmAgentStatusToggle } from "./CrmAgentStatusToggle";
import { CrmQuotaCard } from "./CrmQuotaCard";
import { CrmManagerDashboard } from "./CrmManagerDashboard";
import { CrmOptimalHours } from "./CrmOptimalHours";
import { CrmScriptsAdmin } from "./CrmScriptsAdmin";
import { CrmCsvImport } from "./CrmCsvImport";
import { supabase } from "@/integrations/supabase/client";
import { AppPagination } from "@/components/ui/app-pagination";
import { CALL_STATUS_META, displayName, isWithinBusinessHours, type CrmContact } from "../lib/crmTypes";
import { exportContactsCsv } from "../lib/crmCsv";
import {
  PhoneCall, Search, Phone, MapPin, Filter, Loader2, Lock, AlertTriangle, Eye, PhoneCall as PhonePlus, Timer,
  UserPlus, Download, ShieldAlert, Tag, ShoppingBag, Rocket, LayoutGrid, List, AlertOctagon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";


const PER_PAGE = 10;
const COOLDOWN_HOURS = 48;

/** Returns ms remaining in cooldown (>0 means active), or 0 if no cooldown. */
function cooldownRemainingMs(c: CrmContact): number {
  const attempts = c.call_attempts ?? 0;
  if (c.call_status === "sold") return 0;
  if (attempts < 1 || attempts > 2) return 0;
  if (!c.last_called_at) return 0;
  const elapsed = Date.now() - new Date(c.last_called_at).getTime();
  const cooldown = COOLDOWN_HOURS * 3600 * 1000;
  return Math.max(0, cooldown - elapsed);
}

const STATUS_FILTERS = [
  { key: "all",            label: "Tous" },
  { key: "not_called",     label: "Pas encore appelé" },
  { key: "callback",       label: "Rappel prévu" },
  { key: "message_left",   label: "Message laissé" },
  { key: "no_answer",      label: "Pas de réponse" },
  { key: "sold",           label: "Vendu" },
  { key: "not_interested", label: "Pas intéressé" },
];

export interface CrmCenterProps {
  portal: "field" | "employee" | "core";
  /** Where to navigate when a sale is started ('Vendu' outcome). */
  saleRouteBuilder?: (contactId: string) => string;
  /** dark = Field-style banking dark UI; light = Core/Employee internal UI */
  variant?: "dark" | "light";
  /** Show admin-only controls (assign, export, view all). */
  isAdmin?: boolean;
}

export function CrmCenter({
  portal,
  saleRouteBuilder,
  variant = "light",
  isAdmin = false,
}: CrmCenterProps) {
  const navigate = useNavigate();
  const { user } = useStaffUser();
  const { lock, pending: lockPending } = useCrmLock();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"priority" | "callback" | "city">("priority");
  const [activeCall, setActiveCall] = useState<CrmContact | null>(null);
  const [viewing, setViewing] = useState<CrmContact | null>(null);
  const [saleContact, setSaleContact] = useState<CrmContact | null>(null);
  const [assignContact, setAssignContact] = useState<CrmContact | null>(null);
  const [noteContact, setNoteContact] = useState<CrmContact | null>(null);
  const [callbackContact, setCallbackContact] = useState<CrmContact | null>(null);
  const [transferContact, setTransferContact] = useState<CrmContact | null>(null);
  const [emailContact, setEmailContact] = useState<CrmContact | null>(null);


  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [powerDialer, setPowerDialer] = useState(false);

  // Auto-release stale locks every 2 min (admin tick; safe for all users).
  useEffect(() => {
    if (!isAdmin) return;
    const tick = () => { (supabase.rpc as any)("crm_release_stale_locks").then(() => {}); };
    tick();
    const id = setInterval(tick, 120_000);
    return () => clearInterval(id);
  }, [isAdmin]);

  const { contacts, cities, stats, isLoading } = useCrmContacts({
    search,
    status: statusFilter,
    city: cityFilter,
  });

  const sorted = useMemo(() => {
    const copy = [...contacts];
    if (sortKey === "callback") {
      copy.sort((a, b) => {
        const ax = a.next_callback_at ? new Date(a.next_callback_at).getTime() : Infinity;
        const bx = b.next_callback_at ? new Date(b.next_callback_at).getTime() : Infinity;
        return ax - bx;
      });
    } else if (sortKey === "city") {
      copy.sort((a, b) => (a.city ?? "").localeCompare(b.city ?? ""));
    }
    return copy;
  }, [contacts, sortKey]);

  // Reset to page 1 whenever filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, cityFilter, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PER_PAGE;
  const paged = sorted.slice(pageStart, pageStart + PER_PAGE);

  const duplicateIds = useCrmDuplicates(sorted.slice(0, 100));

  const startCall = async (c: CrmContact) => {
    if (!user?.id) return;
    if (c.is_dnc) {
      const ok = window.confirm(
        `⚠️ LNNTE / DNC\n\nCe contact est sur la liste « Ne pas appeler ».\nRaison : ${c.dnc_reason ?? "—"}\n\nAppeler quand même ? (responsabilité légale)`
      );
      if (!ok) return;
    }
    if (!isWithinBusinessHours()) {
      const ok = window.confirm("Hors heures d'appel (9h-20h). Continuer quand même ?");
      if (!ok) return;
    }
    const locked = await lock(c.id);
    if (!locked) return;
    setActiveCall({
      ...c,
      is_locked: true,
      locked_by: user.id,
      locked_until: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
  };

  /** Pick next callable contact for Power Dialer. */
  const pickNextDialable = (): CrmContact | null => {
    return sorted.find((x) => {
      if (x.is_dnc) return false;
      if (x.call_status === "sold" || x.call_status === "do_not_call") return false;
      if (cooldownRemainingMs(x) > 0) return false;
      const lockedByOther = x.is_locked && x.locked_by && x.locked_by !== user?.id
        && x.locked_until && new Date(x.locked_until).getTime() > Date.now();
      if (lockedByOther) return false;
      return !!x.phone;
    }) ?? null;
  };

  const handleCallClose = () => {
    setActiveCall(null);
    if (powerDialer) {
      setTimeout(() => {
        const next = pickNextDialable();
        if (next) startCall(next);
        else { setPowerDialer(false); }
      }, 500);
    }
  };


  const handleSold = (c: CrmContact) => {
    // Open integrated sale modal instead of navigating away
    setSaleContact(c);
  };
  // saleRouteBuilder retained for backwards-compat
  void saleRouteBuilder;
  void navigate;

  const isDark = variant === "dark";

  // Theme helpers
  const cardCls = isDark ? "rounded-xl bg-gray-800 border border-gray-700" : "rounded-xl bg-card border border-border";
  const inputCls = isDark
    ? "w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 min-h-[44px]"
    : "w-full bg-background border border-border rounded-xl pl-10 pr-3 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-violet-500 min-h-[44px]";
  const titleCls = isDark ? "text-white" : "text-foreground";
  const mutedCls = isDark ? "text-gray-400" : "text-muted-foreground";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className={cn("text-2xl font-bold flex items-center gap-2", titleCls)}>
            <PhoneCall className="h-6 w-6 text-violet-500" />
            CRM Outbound Call Center
          </h1>
          <p className={cn("text-sm mt-1", mutedCls)}>
            Base de prospects à appeler · Pool partagé · {stats.total} contacts
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Agent presence */}
          <CrmAgentStatusToggle userId={user?.id} />

          {/* View mode toggle */}
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={cn("inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold", viewMode === "list" ? "bg-violet-600 text-white" : "bg-background text-foreground hover:bg-muted")}
            >
              <List className="h-3.5 w-3.5" /> Liste
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={cn("inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold border-l border-border", viewMode === "kanban" ? "bg-violet-600 text-white" : "bg-background text-foreground hover:bg-muted")}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </button>
          </div>

          {/* Power Dialer */}
          <button
            onClick={() => {
              if (powerDialer) { setPowerDialer(false); return; }
              const next = pickNextDialable();
              if (!next) { return; }
              setPowerDialer(true);
              startCall(next);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors",
              powerDialer
                ? "bg-red-600 border-red-600 text-white animate-pulse"
                : "bg-orange-500 border-orange-500 text-white hover:bg-orange-600"
            )}
            title="Auto-numérotation séquentielle des prospects disponibles"
          >
            <Rocket className="h-3.5 w-3.5" />
            {powerDialer ? "⏹ Stop Power Dialer" : "🚀 Power Dialer"}
          </button>

          {isAdmin && (
            <button
              onClick={() => exportContactsCsv(sorted, `crm-${new Date().toISOString().slice(0,10)}.csv`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-violet-500/40 bg-violet-500/10 text-violet-600 hover:bg-violet-500/20"
            >
              <Download className="h-3.5 w-3.5" /> Exporter CSV ({sorted.length})
            </button>
          )}
          {!isWithinBusinessHours() && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs font-medium">
              <AlertTriangle className="h-4 w-4" />
              Hors heures (9h-20h Québec)
            </div>
          )}
        </div>
      </div>



      {/* Layout: list + leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4 min-w-0">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className={cn(cardCls, "p-3")}>
              <div className={cn("text-[11px] uppercase tracking-wide", mutedCls)}>Total</div>
              <div className={cn("text-xl font-bold", titleCls)}>{stats.total}</div>
            </div>
            <div className={cn(cardCls, "p-3 border-violet-500/30")}>
              <div className="text-[11px] uppercase tracking-wide text-violet-500">À appeler</div>
              <div className="text-xl font-bold text-violet-500">{stats.to_call}</div>
            </div>
            <div className={cn(cardCls, "p-3 border-red-500/30")}>
              <div className="text-[11px] uppercase tracking-wide text-red-500">En appel</div>
              <div className="text-xl font-bold text-red-500">{stats.in_progress}</div>
            </div>
            <div className={cn(cardCls, "p-3 border-cyan-500/30")}>
              <div className="text-[11px] uppercase tracking-wide text-cyan-500">Rappels</div>
              <div className="text-xl font-bold text-cyan-500">{stats.callback}</div>
            </div>
            <div className={cn(cardCls, "p-3 border-emerald-500/30")}>
              <div className="text-[11px] uppercase tracking-wide text-emerald-500">Vendus</div>
              <div className="text-xl font-bold text-emerald-500">{stats.sold}</div>
            </div>
          </div>

          {/* Search */}
          <div className="space-y-2">
            <div className="relative">
              <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4", mutedCls)} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher nom, téléphone, ville, courriel…"
                className={inputCls}
              />
            </div>

            {/* Status filters */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors min-h-[36px] border",
                    statusFilter === f.key
                      ? "bg-violet-600 border-violet-600 text-white"
                      : isDark
                      ? "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
                      : "bg-card text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* City + sort */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className={cn("h-3.5 w-3.5 shrink-0", mutedCls)} />
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className={cn(
                  "border rounded-lg px-3 py-2 text-sm min-h-[40px]",
                  isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-background border-border text-foreground"
                )}
              >
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city === "all" ? "Toutes les villes" : city}
                  </option>
                ))}
              </select>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
                className={cn(
                  "border rounded-lg px-3 py-2 text-sm min-h-[40px]",
                  isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-background border-border text-foreground"
                )}
              >
                <option value="priority">Tri : priorité</option>
                <option value="callback">Tri : date de rappel</option>
                <option value="city">Tri : ville</option>
              </select>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            </div>
          ) : sorted.length === 0 ? (
            <div className={cn(cardCls, "p-8 text-center")}>
              <p className={cn("text-sm", mutedCls)}>Aucun prospect trouvé.</p>
            </div>
          ) : viewMode === "kanban" ? (
            <CrmKanbanView
              contacts={sorted}
              isDark={isDark}
              onOpen={setViewing}
              onStartCall={startCall}
              duplicateIds={duplicateIds}
            />
          ) : (
            <div className="space-y-2">
              {paged.map((c) => {
                const meta = CALL_STATUS_META[c.call_status ?? "not_called"] ?? CALL_STATUS_META.not_called;
                const lockedByOther =
                  c.is_locked &&
                  c.locked_by &&
                  c.locked_by !== user?.id &&
                  c.locked_until &&
                  new Date(c.locked_until).getTime() > Date.now();
                const cooldownMs = cooldownRemainingMs(c);
                const inCooldown = cooldownMs > 0 && !lockedByOther;
                const cooldownLabel = inCooldown
                  ? formatDistanceToNow(new Date(Date.now() + cooldownMs), { addSuffix: true, locale: fr })
                  : null;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      cardCls,
                      "p-3 transition-colors",
                      lockedByOther && "opacity-70 border-red-500/40",
                      inCooldown && "border-orange-500/50",
                      !lockedByOther && !inCooldown && "hover:border-violet-500/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={cn("text-sm font-semibold truncate", titleCls)}>{displayName(c)}</h3>
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
                            meta.cls
                          )}>
                            {meta.label}
                          </span>
                          {lockedByOther && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-500/15 text-red-500 border-red-500/40 animate-pulse">
                              <Lock className="h-3 w-3" />
                              🔴 En appel par {c.locked_by_name ?? "Agent"}
                            </span>
                          )}
                          {inCooldown && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/40">
                              <Timer className="h-3 w-3" />
                              Cooldown actif · libre {cooldownLabel}
                            </span>
                          )}
                          {c.is_dnc && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/50">
                              <ShieldAlert className="h-3 w-3" />
                              LNNTE / DNC
                            </span>
                          )}
                          {(c.interest_tags ?? []).slice(0, 3).map((t) => (
                            <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-violet-500/10 text-violet-600 border-violet-500/30">
                              <Tag className="h-2.5 w-2.5" />{t}
                            </span>
                          ))}
                        </div>

                        <div className={cn("mt-1 space-y-0.5 text-[12px]", mutedCls)}>
                          {c.phone && (
                            <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-violet-500 hover:text-violet-400 font-medium">
                              <Phone className="h-3 w-3" />
                              {c.phone}
                            </a>
                          )}
                          {(c.city || c.address) && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{[c.address, c.city, c.postal_code].filter(Boolean).join(", ")}</span>
                            </div>
                          )}
                          {c.email && <div className="truncate text-[11px] opacity-80">{c.email}</div>}
                          {(c.call_attempts ?? 0) > 0 && c.last_called_at && (
                            <div className="text-[10px] opacity-75">
                              {c.call_attempts} tentative{(c.call_attempts || 0) > 1 ? "s" : ""} · dernier {formatDistanceToNow(new Date(c.last_called_at), { addSuffix: true, locale: fr })}
                            </div>
                          )}
                          {c.next_callback_at && (
                            <div className="text-[10px] text-cyan-500 font-medium">
                              ⏰ Rappel : {formatDistanceToNow(new Date(c.next_callback_at), { addSuffix: true, locale: fr })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button
                        disabled={lockedByOther || lockPending || inCooldown}
                        onClick={() => startCall(c)}
                        title={inCooldown ? `Cooldown actif — libre ${cooldownLabel}` : undefined}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-[12px] font-semibold transition-colors min-h-[40px] disabled:opacity-50 disabled:cursor-not-allowed",
                          "bg-violet-600 hover:bg-violet-500"
                        )}
                      >
                        <PhonePlus className="h-3.5 w-3.5" />
                        Commencer l'appel
                      </button>
                      <button
                        onClick={() => setViewing(c)}
                        className={cn(
                          "inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors min-h-[40px] border",
                          isDark
                            ? "bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600"
                            : "bg-background text-foreground border-border hover:bg-muted"
                        )}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Fiche
                      </button>
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className={cn(
                            "inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors min-h-[40px] border",
                            isDark
                              ? "bg-gray-700 text-violet-300 border-violet-500/40 hover:bg-gray-600"
                              : "bg-background text-violet-600 border-violet-500/40 hover:bg-muted"
                          )}
                        >
                          <Phone className="h-3.5 w-3.5" />
                          Tél direct
                        </a>
                      )}
                      <button
                        onClick={() => setSaleContact(c)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-bold transition-colors min-h-[40px] border border-emerald-500/60 bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm"
                      >
                        <ShoppingBag className="h-3.5 w-3.5" />
                        🟢 Vendre
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setAssignContact(c)}
                          className={cn(
                            "inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors min-h-[40px] border border-violet-500/40 text-violet-600 hover:bg-violet-500/10",
                          )}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          {c.assigned_to ? "Réassigner" : "Assigner"}
                        </button>
                      )}
                      <CrmQuickActions
                        contact={c}
                        isDark={isDark}
                        onOpenNote={setNoteContact}
                        onOpenCallback={setCallbackContact}
                        onStartCall={startCall}
                        onSell={setSaleContact}
                        onOpenTransfer={setTransferContact}
                        onOpenEmail={setEmailContact}
                      />
                    </div>
                  </div>
                );
              })}

              <AppPagination
                total={sorted.length}
                page={safePage}
                perPage={PER_PAGE}
                onPageChange={(p) => {
                  setCurrentPage(p);
                  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                variant={isDark ? "dark" : "light"}
              />
            </div>
          )}
        </div>

        {/* Sidebar : quota + leaderboard */}
        <aside className="space-y-4">
          <CrmQuotaCard isDark={isDark} />
          <CrmLeaderboard darkPortal={isDark} />
          {isAdmin && (
            <div className={cn(cardCls, "p-3 text-xs", mutedCls)}>
              <strong className={titleCls}>Vue admin</strong>
              <p className="mt-1">Exports, assignations et statistiques globales disponibles depuis Nivra Core.</p>
            </div>
          )}
        </aside>
      </div>

      <CrmCallDialog
        contact={activeCall}
        portal={portal}
        onClose={handleCallClose}
        onSold={handleSold}
      />
      <CrmContactDrawer contact={viewing} onClose={() => setViewing(null)} />
      <CrmSaleModal contact={saleContact} onClose={() => setSaleContact(null)} />
      <CrmAssignDialog contact={assignContact} onClose={() => setAssignContact(null)} />
      <CrmQuickNoteDialog contact={noteContact} onClose={() => setNoteContact(null)} />
      <CrmScheduleCallbackDialog contact={callbackContact} onClose={() => setCallbackContact(null)} />
      <CrmTransferDialog contact={transferContact} onClose={() => setTransferContact(null)} />
      <CrmFollowUpEmailDialog contact={emailContact} onClose={() => setEmailContact(null)} />
    </div>

  );
}
