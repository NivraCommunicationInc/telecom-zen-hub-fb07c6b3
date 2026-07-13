/**
 * TechAssignments — Two-tab page:
 *   "Mes Missions"  — assigned missions with status actions
 *   "Disponibles"   — dispatch pool: self-attribution with 15-min Uber-style lock,
 *                     5 verifications (order status, no other tech, no active reservation),
 *                     priority queue (URGENT / VIP / ENTREPRISE / NORMAL)
 */
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock, MapPin, Package, Wrench, Truck, PlayCircle, XCircle,
  Loader2, AlertCircle, Phone, Zap, Crown, Building2,
  CheckCircle2, Lock, Timer, Calendar, ChevronDown, ChevronUp,
  ListChecks, Radio,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TechHeader from "../components/TechHeader";
import { useTechAssignments, type TechAssignment } from "../lib/useTechAssignments";
import { useAvailableAssignments, type DispatchJob } from "../lib/useAvailableAssignments";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  accepted:    "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  scheduled:   "bg-slate-700/50 text-slate-200 border-slate-600",
  confirmed:   "bg-blue-500/20 text-blue-300 border-blue-500/40",
  en_route:    "bg-orange-500/20 text-orange-300 border-orange-500/40 animate-pulse",
  arrived:     "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
  in_progress: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  completed:   "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  missed:      "bg-red-500/20 text-red-300 border-red-500/40",
  rescheduled: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  cancelled:   "bg-slate-500/20 text-slate-300 border-slate-500/40",
};

const STATUS_LABELS: Record<string, string> = {
  accepted:    "Accepté ✅",
  scheduled:   "Planifié",
  confirmed:   "Confirmé",
  en_route:    "En route 🚗",
  arrived:     "Arrivé 📍",
  in_progress: "En cours 🔧",
  completed:   "Complété ✅",
  missed:      "Manqué ❌",
  rescheduled: "Replanifié",
  cancelled:   "Annulé",
};

const PRIORITY_CONFIG = {
  urgent:     { label: "URGENT",     color: "bg-red-600 text-white",           icon: Zap },
  vip:        { label: "VIP",        color: "bg-amber-500 text-black",         icon: Crown },
  enterprise: { label: "ENTREPRISE", color: "bg-blue-600 text-white",          icon: Building2 },
  normal:     { label: "Normal",     color: "bg-slate-700 text-slate-300",     icon: CheckCircle2 },
};

type DayFilter = "today" | "tomorrow" | "week" | "all";
type Tab = "missions" | "dispatch";

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

function formatCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Dispatch Job Card ────────────────────────────────────────────────────────

interface DispatchCardProps {
  job: DispatchJob;
  uid: string | null;
  onClaim: (job: DispatchJob) => void;
  claimPending: boolean;
}

function DispatchCard({ job, uid, onClaim, claimPending }: DispatchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [tick, setTick] = useState(0);
  const pCfg = PRIORITY_CONFIG[job.dispatch_priority] ?? PRIORITY_CONFIG.normal;
  const PIcon = pCfg.icon;

  useEffect(() => {
    if (!job.reservation_expires_at) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [job.reservation_expires_at]);

  const isLockedByOther = !!job.reservation_expires_at && !job.reserved_by_me;
  const isLockedByMe = !!job.reservation_expires_at && job.reserved_by_me;
  const countdown = job.reservation_expires_at ? formatCountdown(job.reservation_expires_at) : null;

  return (
    <li className={`tp-job-card p-4 space-y-3 ${
      isLockedByOther ? "bg-slate-900/50 border-slate-700 opacity-70" :
      job.dispatch_priority === "urgent" ? "bg-red-950/30 border-red-600/40" :
      job.dispatch_priority === "vip" ? "bg-amber-950/30 border-amber-600/40" :
      "bg-slate-900 border-slate-800"
    }`}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${pCfg.color}`}>
          <PIcon className="h-3 w-3" /> {pCfg.label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{job.estimated_duration_minutes} min</span>
          {isLockedByOther && countdown && (
            <span className="flex items-center gap-1 text-xs text-orange-400 font-mono">
              <Lock className="h-3 w-3" /> {countdown}
            </span>
          )}
          {isLockedByMe && countdown && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
              <Timer className="h-3 w-3" /> Réservé {countdown}
            </span>
          )}
        </div>
      </div>

      {/* Client + service */}
      <div className="space-y-1.5">
        <p className="text-base font-bold text-white">
          {[job.client_first_name, job.client_last_name].filter(Boolean).join(" ") || "Client"}
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Wrench className="h-3.5 w-3.5 text-violet-400 shrink-0" />
          <span className="capitalize">{job.service_type ?? "Service"}{job.category ? ` · ${job.category}` : ""}</span>
        </div>
        {job.client_full_address && (
          <div className="flex items-start gap-2 text-sm text-slate-300">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-violet-400" />
            <span>{job.client_full_address}</span>
          </div>
        )}
        {job.client_phone && (
          <a href={`tel:${job.client_phone}`} className="flex items-center gap-2 text-sm text-violet-300">
            <Phone className="h-3.5 w-3.5 shrink-0" /> {job.client_phone}
          </a>
        )}
      </div>

      {/* Dispatch notes (internal) */}
      {job.dispatch_notes && (
        <div className="rounded-xl bg-amber-900/30 border border-amber-600/30 px-3 py-2">
          <p className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Notes internes
          </p>
          <p className="text-xs text-amber-200 mt-1">{job.dispatch_notes}</p>
        </div>
      )}

      {/* Equipment (expandable) */}
      {job.equipment_details && (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            <Package className="h-3.5 w-3.5" />
            Équipements requis
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {expanded && (
            <div className="mt-2 rounded-xl bg-slate-950 border border-slate-800 p-3">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                {typeof job.equipment_details === "string"
                  ? job.equipment_details
                  : JSON.stringify(job.equipment_details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      {!isLockedByOther && (
        <button
          onClick={() => !claimPending && onClaim(job)}
          disabled={claimPending}
          className={`w-full min-h-[52px] rounded-full text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 ${
            isLockedByMe
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-violet-600 hover:bg-violet-700 text-white"
          }`}
        >
          {claimPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {isLockedByMe ? "Confirmer l'attribution" : "Prendre cette mission"}
        </button>
      )}
      {isLockedByOther && (
        <div className="text-center text-xs text-slate-500 py-2">
          Réservée par un autre technicien — disponible dans {countdown}
        </div>
      )}
    </li>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TechAssignments() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: assignments = [], isLoading: loadingAssignments } = useTechAssignments();
  const { data: available = [], isLoading: loadingDispatch } = useAvailableAssignments();
  const [activeTab, setActiveTab] = useState<Tab>("missions");
  const [filter, setFilter] = useState<DayFilter>("today");
  const [uid, setUid] = useState<string | null>(null);
  const [missingFor, setMissingFor] = useState<TechAssignment | null>(null);
  const [missReason, setMissReason] = useState("");
  const [claimJob, setClaimJob] = useState<DispatchJob | null>(null);
  const [claimDate, setClaimDate] = useState(new Date().toISOString().slice(0, 10));
  const [claimTimeStart, setClaimTimeStart] = useState("09:00");
  const [claimTimeEnd, setClaimTimeEnd] = useState("11:00");
  const reservationRef = useRef<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const filtered = useMemo(() => {
    const today = isoDate(new Date());
    const tomorrow = isoDate(new Date(Date.now() + 86_400_000));
    const weekEnd = isoDate(new Date(Date.now() + 7 * 86_400_000));
    if (filter === "today")    return assignments.filter((a) => a.scheduled_date === today);
    if (filter === "tomorrow") return assignments.filter((a) => a.scheduled_date === tomorrow);
    if (filter === "week")     return assignments.filter((a) => a.scheduled_date >= today && a.scheduled_date <= weekEnd);
    return assignments;
  }, [assignments, filter]);

  const urgentCount = useMemo(
    () => available.filter((j) => j.dispatch_priority === "urgent").length,
    [available],
  );

  const stopGps = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startGpsForAssignment = useCallback((assignmentId: string) => {
    if (!navigator.geolocation) {
      toast.warning("GPS non disponible sur cet appareil");
      return;
    }
    stopGps();
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy, heading, speed } = pos.coords;
        const speedKmh = typeof speed === "number" && Number.isFinite(speed) ? speed * 3.6 : null;
        const { error } = await (supabase.rpc as any)("upsert_my_technician_location", {
          p_assignment_id: assignmentId,
          p_latitude: lat,
          p_longitude: lng,
          p_accuracy_meters: accuracy ?? null,
          p_heading: heading ?? null,
          p_speed_kmh: speedKmh,
        });
        if (error) {
          await supabase
            .from("technician_assignments")
            .update({ live_location: { lat, lng, accuracy, updated_at: new Date().toISOString() } } as any)
            .eq("id", assignmentId);
        }
      },
      () => toast.warning("Position GPS non autorisée — le technicien restera visible à l'adresse du RDV"),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
  }, [stopGps]);

  useEffect(() => () => stopGps(), [stopGps]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const setStatus = useMutation({
    mutationFn: async ({ a, status, note }: { a: TechAssignment; status: string; note?: string }) => {
      const { error } = await (supabase.rpc as any)("tech_update_assignment_status", {
        p_assignment_id: a.id,
        p_status: status,
        p_note: note ?? null,
        p_eta: null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["tech-assignments-all"] });
      if (vars.status === "en_route") startGpsForAssignment(vars.a.id);
      if (["arrived", "in_progress", "completed", "missed", "cancelled"].includes(vars.status)) stopGps();
      toast.success(vars.status === "en_route" ? "Client notifié ✅" : "Statut mis à jour");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const reserveMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!uid) throw new Error("Non authentifié");
      const result = await (supabase.rpc as any)("reserve_dispatch_slot", {
        p_order_id: orderId,
        p_technician_id: uid,
      });
      if (result.error) throw result.error;
      const data = result.data as any;
      if (!data?.success) throw new Error(data?.error ?? "Réservation échouée");
      reservationRef.current = orderId;
      return data;
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Erreur de réservation");
      setClaimJob(null);
    },
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!claimJob || !uid) throw new Error("Données manquantes");
      const result = await (supabase.rpc as any)("claim_dispatch_assignment", {
        p_order_id:      claimJob.id,
        p_technician_id: uid,
        p_scheduled_date: claimDate,
        p_time_start:     claimTimeStart + ":00",
        p_time_end:       claimTimeEnd + ":00",
      });
      if (result.error) throw result.error;
      const data = result.data as any;
      if (!data?.success) throw new Error(data?.error ?? "Attribution échouée");
      if (data.assignment_id) {
        const { error: statusError } = await (supabase.rpc as any)("tech_update_assignment_status", {
          p_assignment_id: data.assignment_id,
          p_status: "accepted",
          p_note: "Mission acceptée par le technicien depuis le portail terrain",
          p_eta: null,
        });
        if (statusError) throw statusError;
      }
      return data.assignment_id as string;
    },
    onSuccess: (assignmentId) => {
      qc.invalidateQueries({ queryKey: ["dispatch-available"] });
      qc.invalidateQueries({ queryKey: ["tech-assignments-all"] });
      toast.success("Mission acceptée ✅ Courriel client envoyé.");
      setClaimJob(null);
      reservationRef.current = null;
      if (assignmentId) navigate(`/tech/installation/${assignmentId}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Attribution échouée"),
  });

  const openClaimDialog = (job: DispatchJob) => {
    setClaimJob(job);
    setClaimDate(new Date().toISOString().slice(0, 10));
    setClaimTimeStart("09:00");
    setClaimTimeEnd("11:00");
    // Reserve immediately when dialog opens
    if (uid) reserveMutation.mutate(job.id);
  };

  function confirmMissed() {
    if (!missingFor || !missReason.trim()) return;
    setStatus.mutate({ a: missingFor, status: "missed", note: missReason.trim() }, {
      onSuccess: () => { setMissingFor(null); setMissReason(""); },
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <TechHeader title="Missions" />
      <div className="px-4 py-4">

        <section className="tp-core-hero rounded-2xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase text-sky-300">Nivra Core · Portail technicien</p>
              <h1 className="text-xl font-black text-white mt-1">Tableau terrain</h1>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/65 px-3 py-2 text-right">
              <p className="text-[10px] font-bold uppercase text-slate-400">Actives</p>
              <p className="tp-kpi text-2xl text-white">
                {assignments.filter((a) => !["completed","cancelled","missed"].includes(a.status)).length}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-700 bg-slate-950/55 p-2">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Dispatch</p>
              <p className="text-lg font-black text-sky-300">{available.length}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/55 p-2">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Urgent</p>
              <p className="text-lg font-black text-amber-300">{urgentCount}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-950/55 p-2">
              <p className="text-[10px] text-slate-400 uppercase font-bold">GPS</p>
              <p className="text-lg font-black text-emerald-300">Live</p>
            </div>
          </div>
        </section>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-2 mb-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-1">
          <button
            onClick={() => setActiveTab("missions")}
            className={`min-h-[48px] rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-colors ${
              activeTab === "missions"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                : "bg-slate-900 border border-slate-800 text-slate-300"
            }`}
          >
            <ListChecks className="h-4 w-4" />
            Mes Missions
            {assignments.filter((a) => !["completed","cancelled","missed"].includes(a.status)).length > 0 && (
              <span className="rounded-full bg-violet-400/20 px-2 py-0.5 text-xs font-bold">
                {assignments.filter((a) => !["completed","cancelled","missed"].includes(a.status)).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("dispatch")}
            className={`min-h-[48px] rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-colors relative ${
              activeTab === "dispatch"
                ? "bg-orange-600 text-white shadow-lg shadow-orange-500/30"
                : "bg-slate-900 border border-slate-800 text-slate-300"
            }`}
          >
            <Radio className="h-4 w-4" />
            Disponibles
            {available.length > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                urgentCount > 0 ? "bg-red-500 text-white animate-pulse" : "bg-orange-400/20 text-orange-300"
              }`}>
                {available.length}
              </span>
            )}
          </button>
        </div>

        {/* ── MISSIONS TAB ─────────────────────────────────────────────────── */}
        {activeTab === "missions" && (
          <>
            {/* Day filters */}
            <div role="tablist" className="grid grid-cols-4 gap-2 mb-4">
              {([
                ["today",    "Aujourd'hui"],
                ["tomorrow", "Demain"],
                ["week",     "Semaine"],
                ["all",      "Toutes"],
              ] as const).map(([k, lbl]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={filter === k}
                  onClick={() => setFilter(k)}
                  className={`min-h-[44px] px-2 rounded-lg text-xs font-black whitespace-nowrap transition-colors ${
                    filter === k ? "bg-blue-600 text-white" : "bg-slate-900 border border-slate-800 text-slate-300"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {loadingAssignments ? (
              <div className="text-center py-16 flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <span className="text-slate-400">Chargement...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <AlertCircle className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-base font-semibold text-white">Aucune mission</p>
                <p className="text-sm text-slate-400 mt-1">Consultez l'onglet Disponibles.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {filtered.map((a) => {
                  const terminal = ["completed","cancelled","missed","no_show"].includes(a.status);
                  return (
                    <li key={a.id} className={`tp-job-card p-4 space-y-3 ${["accepted", "en_route", "arrived", "in_progress"].includes(a.status) ? "tp-live-card" : ""}`}>
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-950/55 px-3 py-2">
                        <span className="text-[10px] font-black uppercase text-sky-300">Mission terrain</span>
                        <span className="text-[10px] font-black uppercase text-slate-400">Email statut actif</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center text-xs font-bold px-3 py-1 rounded-full border ${STATUS_STYLES[a.status] ?? STATUS_STYLES.scheduled}`}>
                          {STATUS_LABELS[a.status] ?? a.status}
                        </span>
                        <span className="text-sm font-bold text-white flex items-center gap-1">
                          <Clock className="h-4 w-4 text-violet-400" />
                          {a.scheduled_time_start?.slice(0, 5)}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-base font-bold text-white">👤 {a.client_name || "Client"}</p>
                        {a.client_address && (
                          <p className="text-sm text-slate-300 flex items-start gap-2">
                            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-violet-400" />
                            <span>{a.client_address}</span>
                          </p>
                        )}
                        {a.client_phone && (
                          <a href={`tel:${a.client_phone}`} className="text-sm text-violet-300 flex items-center gap-2">
                            <Phone className="h-4 w-4 shrink-0" /> {a.client_phone}
                          </a>
                        )}
                      </div>
                      {a.order_items && a.order_items.length > 0 && (
                        <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 space-y-1.5">
                          {a.order_items.map((i: any) => (
                            <p key={i.id} className="text-xs text-slate-300 flex items-start gap-2">
                              {i.fulfillment_type === "equipment" ? <Wrench className="h-3.5 w-3.5 mt-0.5 text-orange-400 shrink-0" /> : <Package className="h-3.5 w-3.5 mt-0.5 text-violet-400 shrink-0" />}
                              <span>{i.plan_name || i.description}{i.quantity > 1 ? ` × ${i.quantity}` : ""}</span>
                            </p>
                          ))}
                        </div>
                      )}
                      {!terminal && (
                        <div className="space-y-2 pt-1">
                          {["scheduled", "accepted", "confirmed"].includes(a.status) && (
                            <button
                              onClick={() => setStatus.mutate({ a, status: "en_route" })}
                              disabled={setStatus.isPending}
                              className="tp-action-btn tp-action-warning w-full"
                            >
                              <Truck className="h-4 w-4" /> En route + email client
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/tech/installation/${a.id}`)}
                            className="tp-action-btn tp-action-primary w-full"
                          >
                            <PlayCircle className="h-4 w-4" /> Démarrer l'installation
                          </button>
                          <button
                            onClick={() => setMissingFor(a)}
                            className="tp-action-btn tp-action-danger w-full"
                          >
                            <XCircle className="h-4 w-4" /> Rendez-vous manqué
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {/* ── DISPATCH TAB ─────────────────────────────────────────────────── */}
        {activeTab === "dispatch" && (
          <>
            {/* Info banner */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 mb-4 space-y-1">
              <p className="text-sm font-semibold text-white">Missions disponibles</p>
              <p className="text-xs text-slate-400">
                Cliquez "Prendre cette mission" pour la réserver 15 minutes.
                Les missions URGENT et VIP nécessitent une validation superviseur.
              </p>
            </div>

            {loadingDispatch ? (
              <div className="text-center py-16 flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                <span className="text-slate-400">Chargement du dispatch...</span>
              </div>
            ) : available.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="h-12 w-12 text-emerald-500/40 mx-auto mb-3" />
                <p className="text-base font-semibold text-white">Aucune mission disponible</p>
                <p className="text-sm text-slate-400 mt-1">Revenez plus tard ou contactez le dispatcher.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {available.map((job) => (
                  <DispatchCard
                    key={job.id}
                    job={job}
                    uid={uid}
                    onClaim={openClaimDialog}
                    claimPending={claimMutation.isPending || reserveMutation.isPending}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* ── Missed dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!missingFor} onOpenChange={(o) => !o && setMissingFor(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmer le rendez-vous manqué</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-300">Cette action notifiera le client par courriel. Raison obligatoire.</p>
          <Textarea
            placeholder="Ex: client absent, accès refusé..."
            value={missReason}
            onChange={(e) => setMissReason(e.target.value)}
            className="min-h-[100px] bg-slate-950 border-slate-700 text-white"
          />
          <DialogFooter className="gap-2">
            <button onClick={() => setMissingFor(null)} className="min-h-[44px] px-5 rounded-full bg-slate-800 text-slate-200 text-sm font-semibold">Annuler</button>
            <button onClick={confirmMissed} disabled={setStatus.isPending || !missReason.trim()} className="min-h-[44px] px-5 rounded-full bg-red-600 text-white text-sm font-bold disabled:opacity-60">
              {setStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer manqué"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Claim dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!claimJob} onOpenChange={(o) => { if (!o) { setClaimJob(null); reservationRef.current = null; } }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-violet-300">
              <Calendar className="h-5 w-5" /> Planifier la mission
            </DialogTitle>
          </DialogHeader>
          {claimJob && (
            <div className="space-y-4">
              {/* Job summary */}
              <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-3 space-y-1">
                <p className="text-sm font-bold text-white">
                  {[claimJob.client_first_name, claimJob.client_last_name].filter(Boolean).join(" ") || "Client"}
                </p>
                <p className="text-xs text-slate-400 capitalize">{claimJob.service_type}</p>
                {claimJob.client_full_address && (
                  <p className="text-xs text-slate-400">{claimJob.client_full_address}</p>
                )}
              </div>

              {reserveMutation.isPending && (
                <div className="flex items-center gap-2 text-xs text-orange-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Réservation en cours...
                </div>
              )}
              {reserveMutation.isSuccess && (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <Timer className="h-3.5 w-3.5" /> Mission réservée — 15 min pour confirmer
                </div>
              )}

              {/* Date picker */}
              <label className="block">
                <span className="text-xs text-slate-400 block mb-1">Date d'installation</span>
                <input
                  type="date"
                  value={claimDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setClaimDate(e.target.value)}
                  className="w-full min-h-[48px] rounded-lg bg-slate-950 border border-slate-700 text-white px-3 text-base"
                />
              </label>

              {/* Time pickers */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-slate-400 block mb-1">Heure début</span>
                  <input
                    type="time"
                    min="07:00"
                    max="20:00"
                    value={claimTimeStart}
                    onChange={(e) => {
                      setClaimTimeStart(e.target.value);
                      // Auto-set end = start + estimated duration
                      const [hh, mm] = e.target.value.split(":").map(Number);
                      const endMin = hh * 60 + mm + (claimJob.estimated_duration_minutes ?? 90);
                      const endH = String(Math.floor(endMin / 60) % 24).padStart(2, "0");
                      const endM = String(endMin % 60).padStart(2, "0");
                      setClaimTimeEnd(`${endH}:${endM}`);
                    }}
                    className="w-full min-h-[48px] rounded-lg bg-slate-950 border border-slate-700 text-white px-3 text-base"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-400 block mb-1">Heure fin</span>
                  <input
                    type="time"
                    min="07:00"
                    max="22:00"
                    value={claimTimeEnd}
                    onChange={(e) => setClaimTimeEnd(e.target.value)}
                    className="w-full min-h-[48px] rounded-lg bg-slate-950 border border-slate-700 text-white px-3 text-base"
                  />
                </label>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => { setClaimJob(null); reservationRef.current = null; }}
              className="w-full min-h-[52px] rounded-full bg-slate-700 text-white font-semibold"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={claimMutation.isPending || reserveMutation.isPending || !claimDate || !claimTimeStart}
              onClick={() => claimMutation.mutate()}
              className="w-full min-h-[52px] rounded-full bg-violet-600 hover:bg-violet-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {claimMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirmer la mission
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
