/**
 * CoreTechnicianMobilePage — Mobile-first view for field technicians.
 * Route: /core/technician
 *
 * Layout: max-width 430px, centered. Dark theme matching the rest of Core.
 * Sections: Header (status toggle), Today's interventions, History, Profile,
 * and a fixed bottom navigation bar with 4 tabs.
 *
 * Design tokens used inline (bg-[#0d1421], bg-[#111827]) match the Core
 * dashboard's mobile/console palette already in use elsewhere.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOptionalAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  User,
  MessageCircle,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Truck,
  PlayCircle,
  Loader2,
} from "lucide-react";
import TechnicianLocationShare from "@/core-app/components/TechnicianLocationShare";

/* ─── Helpers ─── */
const todayBoundsIso = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

const fmtTimeRange = (scheduledAt: string | null, durationMin = 120): string => {
  if (!scheduledAt) return "—";
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMin * 60_000);
  const f = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${f(start)} — ${f(end)}`;
};

const fmtDateLong = (d: Date): string =>
  d.toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const statusLabelFr: Record<string, string> = {
  scheduled: "Confirmé",
  confirmed: "Confirmé",
  pending: "En attente",
  en_route: "En route",
  on_the_way: "En route",
  in_progress: "En cours",
  completed: "Complété",
  cancelled: "Annulé",
  no_show: "Absent",
};

const statusBadgeClass = (s: string): string => {
  const k = (s || "").toLowerCase();
  if (k === "completed") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (k === "in_progress") return "bg-blue-500/15 text-blue-300 border-blue-500/30";
  if (k === "en_route" || k === "on_the_way") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  if (k === "cancelled" || k === "no_show") return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  return "bg-slate-500/15 text-slate-300 border-slate-500/30";
};

const ISSUE_REASONS = [
  "Accès refusé",
  "Client absent",
  "Problème technique",
  "Équipement manquant",
  "Autre",
] as const;

/* ─── Tabs ─── */
type TabId = "today" | "history" | "profile" | "support";

type TechnicianSelfRecord = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  specializations: string[] | null;
  notes?: string | null;
};

type TechnicianPickerRecord = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  user_id?: string | null;
};

export default function CoreTechnicianMobilePage() {
  const { user } = useOptionalAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("today");

  /* ─── Manual technician selection (persisted) ─── */
  const LS_KEY = "nivra.core.technician.selectedId";
  const [selectedTechId, setSelectedTechId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(LS_KEY);
  });

  /* ─── Resolve technician record:
   *    1. Try linked user_id match (if technicians.user_id is set)
   *    2. Fall back to email match against auth user's email
   *    3. Fall back to manual selection persisted in localStorage
   */
  const technicianQuery = useQuery({
    queryKey: ["technician-self", user?.id, user?.email, selectedTechId],
    enabled: !!user?.id,
    queryFn: async () => {
      try {
        const { data, error } = await (supabase.rpc as any)("get_technician_mobile_self", {
          p_selected_id: selectedTechId,
        });

        console.info("[TechnicianMobilePage] technician self RPC", {
          selectedTechId,
          data,
          error,
        });

        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : data;
        return (row ?? null) as TechnicianSelfRecord | null;
      } catch (error) {
        console.error("[TechnicianMobilePage] technician self lookup failed", error);
        return null;
      }
    },
  });

  /* ─── Active technicians list (only loaded when no profile resolved) ─── */
  const activeTechniciansQuery = useQuery({
    queryKey: ["technicians-active-list"],
    enabled: !!user?.id && !technicianQuery.isLoading && !technicianQuery.data,
    queryFn: async () => {
      const { data: rawData, error: rawError } = await supabase
        .from("technicians")
        .select("id, full_name, email, status, user_id")
        .order("full_name", { ascending: true });

      console.info("[TechnicianMobilePage] technicians raw query (no status filter)", {
        data: rawData,
        error: rawError,
      });

      const { data, error } = await (supabase.rpc as any)("list_active_technicians_for_mobile");

      console.info("[TechnicianMobilePage] technicians picker RPC result", {
        data,
        error,
      });

      if (error) throw error;

      return ((data as TechnicianPickerRecord[] | null) || []).filter(
        (tech) => (tech.status || "").toLowerCase() === "active"
      );
    },
  });

  const handleSelectTechnician = (id: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_KEY, id);
    }
    setSelectedTechId(id);
  };

  const handleClearSelection = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LS_KEY);
    }
    setSelectedTechId(null);
    queryClient.invalidateQueries({ queryKey: ["technician-self"] });
  };

  const technician = technicianQuery.data;
  const technicianId: string | null = technician?.id ?? null;

  /* ─── Today's interventions ─── */
  const todayQuery = useQuery({
    queryKey: ["technician-today", technicianId],
    enabled: !!technicianId && activeTab === "today",
    refetchInterval: 30_000,
    queryFn: async () => {
      const { startIso, endIso } = todayBoundsIso();
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, appointment_number, scheduled_at, status, service_type, service_address, service_city, service_postal_code, client_phone, internal_notes, order_id, equipment_details, client_id, client_email, title"
        )
        .eq("technician_id", technicianId!)
        .gte("scheduled_at", startIso)
        .lte("scheduled_at", endIso)
        .not("status", "in", "(cancelled,completed)")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const todayAppointments = todayQuery.data || [];

  /* ─── Hydrate client/order labels for visible appointments ─── */
  const clientIds = useMemo(
    () => Array.from(new Set(todayAppointments.map((a) => a.client_id).filter(Boolean) as string[])),
    [todayAppointments]
  );
  const orderIds = useMemo(
    () => Array.from(new Set(todayAppointments.map((a) => a.order_id).filter(Boolean) as string[])),
    [todayAppointments]
  );

  const clientsMap = useQuery({
    queryKey: ["technician-clients-map", clientIds.join(",")],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, first_name, last_name")
        .in("user_id", clientIds);
      const m = new Map<string, string>();
      (data || []).forEach((p: any) => {
        const name = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Client";
        m.set(p.user_id, name);
      });
      return m;
    },
  });

  const ordersMap = useQuery({
    queryKey: ["technician-orders-map", orderIds.join(",")],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, service_type")
        .in("id", orderIds);
      const m = new Map<string, any>();
      (data || []).forEach((o: any) => m.set(o.id, o));
      return m;
    },
  });

  /* ─── History (past completed) ─── */
  const historyQuery = useQuery({
    queryKey: ["technician-history", technicianId],
    enabled: !!technicianId && activeTab === "history",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, appointment_number, scheduled_at, status, service_type, service_address, service_city, order_id, client_id"
        )
        .eq("technician_id", technicianId!)
        .eq("status", "completed")
        .order("scheduled_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  /* ─── Mutations ─── */
  const setTechStatus = useMutation({
    mutationFn: async (newStatus: "available" | "busy") => {
      if (!user?.id) throw new Error("Session non authentifiée");
      if (!technicianId) {
        // No technician row — nothing to update. Surface a soft warning instead of crashing.
        throw new Error("Aucun profil technicien associé à votre compte");
      }
      // Use upsert keyed on user_id so we never silently fail when the row is missing.
      const { error } = await supabase
        .from("technicians")
        .upsert(
          {
            id: technicianId,
            user_id: user.id,
            status: newStatus,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ["technician-self"] });
      toast.success(s === "available" ? "Statut: Disponible" : "Statut: Occupé");
    },
    onError: (e: any) => toast.error(e?.message || "Erreur de mise à jour du statut"),
  });

  const setApptStatus = useMutation({
    mutationFn: async (params: { id: string; status: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({
          status: params.status,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        })
        .eq("id", params.id);
      if (error) throw error;
      return params;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician-today"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur de mise à jour"),
  });

  /* ─── Activity log helper (best-effort, never throws to UI) ─── */
  const logActivity = async (params: {
    action: string;
    entity_type: string;
    entity_id: string | null;
    details?: Record<string, any>;
  }) => {
    if (!user?.id || !params.entity_id) return;
    try {
      await supabase.from("activity_logs").insert({
        action: params.action,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        user_id: user.id,
        actor_name: technician?.full_name || user.email || "Technicien",
        actor_role: "technician",
        actor_email: user.email || null,
        details: params.details || {},
      });
    } catch (e: any) {
      console.warn("[Technician] activity log failed:", e?.message);
    }
  };

  /* ─── Email queue helper (best-effort) ─── */
  const queueClientEmail = async (params: {
    to_email: string;
    template_key: string;
    event_key: string;
    subject: string;
    entity_id: string;
    template_vars: Record<string, any>;
  }) => {
    try {
      await supabase.from("email_queue").insert({
        to_email: params.to_email,
        template_key: params.template_key,
        event_key: params.event_key,
        idempotency_key: `${params.event_key}_${params.entity_id}`,
        subject: params.subject,
        entity_type: "appointment",
        entity_id: params.entity_id,
        template_vars: params.template_vars,
        status: "queued",
      });
    } catch (e: any) {
      console.warn("[Technician] email queue failed:", e?.message);
    }
  };

  /* ─── Action handlers ─── */
  const handleEnRoute = async (appt: any) => {
    await setApptStatus.mutateAsync({ id: appt.id, status: "en_route" });
    await logActivity({
      action: "technician_en_route",
      entity_type: "appointment",
      entity_id: appt.id,
      details: { appointment_number: appt.appointment_number },
    });
    if (appt.client_email) {
      await queueClientEmail({
        to_email: appt.client_email,
        template_key: "appointment_technician_en_route",
        event_key: `appt_en_route_${appt.id}`,
        subject: "Votre technicien est en route — Nivra",
        entity_id: appt.id,
        template_vars: {
          client_name: clientsMap.data?.get(appt.client_id || "") || "Client",
          technician_name: technician?.full_name || "Notre technicien",
          appointment_time: fmtTimeRange(appt.scheduled_at),
          service_address: appt.service_address || "",
        },
      });
    }
    toast.success("Statut « En route » enregistré");
  };

  const handleArrived = async (appt: any) => {
    await setApptStatus.mutateAsync({ id: appt.id, status: "in_progress" });
    await logActivity({
      action: "technician_arrived",
      entity_type: "appointment",
      entity_id: appt.id,
      details: { appointment_number: appt.appointment_number },
    });
    toast.success("Arrivée enregistrée");
  };

  /* ─── Completion modal ─── */
  const [completeFor, setCompleteFor] = useState<any | null>(null);
  const [cNotes, setCNotes] = useState("");
  const [cEquip, setCEquip] = useState(true);
  const [cClientInformed, setCClientInformed] = useState(true);
  const [cTested, setCTested] = useState(true);
  const [cSubmitting, setCSubmitting] = useState(false);

  const openComplete = (appt: any) => {
    setCompleteFor(appt);
    setCNotes("");
    setCEquip(true);
    setCClientInformed(true);
    setCTested(true);
  };

  const submitComplete = async () => {
    if (!completeFor) return;
    setCSubmitting(true);
    try {
      // 1. Update appointment
      await setApptStatus.mutateAsync({ id: completeFor.id, status: "completed" });
      // 2. Append completion note
      try {
        const noteParts: string[] = [`Complétion: ${cNotes || "—"}`];
        noteParts.push(`Équipement installé: ${cEquip ? "oui" : "non"}`);
        noteParts.push(`Client informé: ${cClientInformed ? "oui" : "non"}`);
        noteParts.push(`Test connexion: ${cTested ? "oui" : "non"}`);
        const completionNote = noteParts.join(" · ");
        const merged = completeFor.internal_notes
          ? `${completeFor.internal_notes}\n${completionNote}`
          : completionNote;
        await supabase
          .from("appointments")
          .update({ internal_notes: merged })
          .eq("id", completeFor.id);
      } catch (e: any) {
        console.warn("[Technician] note append failed:", e?.message);
      }
      // 3. Update related order to installation_completed
      if (completeFor.order_id) {
        try {
          await supabase
            .from("orders")
            .update({
              status: "installation_completed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", completeFor.order_id);
        } catch (e: any) {
          console.warn("[Technician] order status update failed:", e?.message);
        }
      }
      // 4. Activity log
      await logActivity({
        action: "appointment_completed",
        entity_type: "appointment",
        entity_id: completeFor.id,
        details: {
          appointment_number: completeFor.appointment_number,
          notes: cNotes,
          equipment_installed: cEquip,
          client_informed: cClientInformed,
          connection_tested: cTested,
        },
      });
      // 5. Email
      if (completeFor.client_email) {
        await queueClientEmail({
          to_email: completeFor.client_email,
          template_key: "installation_completed",
          event_key: `installation_completed_${completeFor.id}`,
          subject: "Votre installation est complétée — Nivra",
          entity_id: completeFor.id,
          template_vars: {
            client_name: clientsMap.data?.get(completeFor.client_id || "") || "Client",
            technician_name: technician?.full_name || "Notre technicien",
            service_address: completeFor.service_address || "",
            notes: cNotes || "",
          },
        });
      }
      toast.success("Intervention complétée");
      setCompleteFor(null);
    } catch (e: any) {
      toast.error(e?.message || "Erreur de complétion");
    } finally {
      setCSubmitting(false);
    }
  };

  /* ─── Issue modal ─── */
  const [issueFor, setIssueFor] = useState<any | null>(null);
  const [iReason, setIReason] = useState<string>("");
  const [iNotes, setINotes] = useState("");
  const [iSubmitting, setISubmitting] = useState(false);

  const openIssue = (appt: any) => {
    setIssueFor(appt);
    setIReason("");
    setINotes("");
  };

  const submitIssue = async () => {
    if (!issueFor || !iReason) {
      toast.error("Sélectionnez une raison");
      return;
    }
    setISubmitting(true);
    try {
      await logActivity({
        action: "technician_issue_reported",
        entity_type: "appointment",
        entity_id: issueFor.id,
        details: {
          appointment_number: issueFor.appointment_number,
          reason: iReason,
          notes: iNotes,
        },
      });
      // Append note to appointment
      try {
        const stamp = new Date().toLocaleDateString("fr-CA");
        const issueNote = `[Problème ${stamp}] ${iReason}${iNotes ? ` — ${iNotes}` : ""}`;
        const merged = issueFor.internal_notes
          ? `${issueFor.internal_notes}\n${issueNote}`
          : issueNote;
        await supabase
          .from("appointments")
          .update({ internal_notes: merged })
          .eq("id", issueFor.id);
      } catch {
        // non-fatal
      }
      toast.success("Problème signalé à Core");
      setIssueFor(null);
    } catch (e: any) {
      toast.error(e?.message || "Erreur de signalement");
    } finally {
      setISubmitting(false);
    }
  };

  /* ─── Render guards ─── */
  if (technicianQuery.isLoading) {
    return (
      <MobileShell activeTab={activeTab} setActiveTab={setActiveTab}>
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement…
        </div>
      </MobileShell>
    );
  }

  if (!technician) {
    const techs = activeTechniciansQuery.data || [];
    return (
      <MobileShell activeTab={activeTab} setActiveTab={setActiveTab}>
        <div className="px-4 py-8">
          <div className="text-center mb-5">
            <User className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <h2 className="text-base font-semibold text-slate-100">Identifiez-vous</h2>
            <p className="text-xs text-slate-400 mt-1">
              Sélectionnez votre fiche technicien pour accéder à vos interventions.
            </p>
          </div>

          {activeTechniciansQuery.isLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement…
            </div>
          ) : techs.length === 0 ? (
            <div className="bg-[#111827] border border-slate-700 rounded-xl p-5 text-center">
              <AlertTriangle className="w-7 h-7 text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-slate-200">Aucun technicien actif</p>
              <p className="text-xs text-slate-500 mt-1">
                Contactez un administrateur pour créer votre fiche.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {techs.map((t: any) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTechnician(t.id)}
                  className="w-full text-left bg-[#111827] border border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/60 rounded-xl p-4 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-slate-200" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-100 truncate">
                        Je suis {t.full_name}
                      </div>
                      <div className="text-xs text-slate-400 truncate">{t.email}</div>
                    </div>
                  </div>
                </button>
              ))}
              <p className="text-[11px] text-slate-500 text-center pt-2">
                Votre choix est mémorisé sur cet appareil.
              </p>
            </div>
          )}
        </div>
      </MobileShell>
    );
  }

  const techStatus = (technician.status || "available").toLowerCase();
  const isAvailable = techStatus === "available";

  /* ─── Current in-progress installation job (for GPS sharing link) ─── */
  const activeJobQuery = useQuery({
    queryKey: ["technician-active-job", technicianId],
    enabled: !!technicianId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("installation_jobs")
        .select("id")
        .eq("technician_id", technicianId!)
        .in("status", ["scheduled", "en_route", "on_the_way", "in_progress", "started"])
        .order("scheduled_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      return (data?.id as string | undefined) ?? null;
    },
  });
  const activeJobId = activeJobQuery.data ?? null;

  /* ─── Section: Today ─── */
  const TodayView = () => (
    <div className="px-4 pb-24 pt-3 space-y-3">
      {user?.id && (
        <TechnicianLocationShare userId={user.id} installationJobId={activeJobId} />
      )}
      <div>
        <h2 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
          Interventions du jour
        </h2>
        {todayQuery.isLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement…
          </div>
        ) : todayAppointments.length === 0 ? (
          <div className="bg-[#111827] border border-slate-700 rounded-xl p-6 text-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-slate-300">Aucune intervention prévue aujourd'hui</p>
            <p className="text-xs text-slate-500 mt-1">Profitez de votre journée 👋</p>
          </div>
        ) : (
          todayAppointments.map((appt) => {
            const clientName = clientsMap.data?.get(appt.client_id || "") || "Client";
            const order = ordersMap.data?.get(appt.order_id || "");
            const status = (appt.status || "").toLowerCase();
            return (
              <div
                key={appt.id}
                className="bg-[#111827] border border-slate-700 rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 text-slate-100">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-semibold">
                      {fmtTimeRange(appt.scheduled_at)}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 border rounded-full ${statusBadgeClass(status)}`}
                  >
                    {statusLabelFr[status] || status || "—"}
                  </span>
                </div>

                <div className="text-sm text-slate-100 font-medium">{clientName}</div>
                {appt.service_address && (
                  <div className="text-xs text-slate-400 flex items-start gap-1 mt-1">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>
                      {appt.service_address}
                      {appt.service_city ? `, ${appt.service_city}` : ""}
                      {appt.service_postal_code ? ` ${appt.service_postal_code}` : ""}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(appt.service_type || order?.service_type) && (
                    <span className="text-[10px] px-2 py-0.5 bg-slate-700/60 text-slate-200 rounded-full border border-slate-600">
                      {appt.service_type || order?.service_type}
                    </span>
                  )}
                  {order?.order_number && (
                    <span className="text-[10px] px-2 py-0.5 bg-slate-700/40 text-slate-300 rounded-full border border-slate-600 font-mono">
                      #{order.order_number}
                    </span>
                  )}
                  {appt.appointment_number && (
                    <span className="text-[10px] px-2 py-0.5 bg-slate-700/40 text-slate-300 rounded-full border border-slate-600 font-mono">
                      RDV {appt.appointment_number}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Button
                    onClick={() => handleEnRoute(appt)}
                    disabled={setApptStatus.isPending || status === "en_route" || status === "in_progress"}
                    className="h-11 text-sm bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Truck className="w-4 h-4 mr-1.5" /> En route
                  </Button>
                  <Button
                    onClick={() => handleArrived(appt)}
                    disabled={setApptStatus.isPending || status === "in_progress"}
                    className="h-11 text-sm bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <PlayCircle className="w-4 h-4 mr-1.5" /> Arrivé
                  </Button>
                  <Button
                    onClick={() => openComplete(appt)}
                    className="h-11 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" /> Compléter
                  </Button>
                  <Button
                    onClick={() => openIssue(appt)}
                    variant="outline"
                    className="h-11 text-sm border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800"
                  >
                    <AlertTriangle className="w-4 h-4 mr-1.5" /> Problème
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  /* ─── Section: History ─── */
  const HistoryView = () => (
    <div className="px-4 pb-24 pt-3 space-y-3">
      <h2 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
        Historique — Interventions complétées
      </h2>
      {historyQuery.isLoading ? (
        <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement…
        </div>
      ) : (historyQuery.data || []).length === 0 ? (
        <div className="bg-[#111827] border border-slate-700 rounded-xl p-6 text-center">
          <p className="text-sm text-slate-300">Aucun historique</p>
        </div>
      ) : (
        (historyQuery.data || []).map((a: any) => (
          <div
            key={a.id}
            className="bg-[#111827] border border-slate-700 rounded-xl p-3"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">
                {a.scheduled_at
                  ? new Date(a.scheduled_at).toLocaleDateString("fr-CA", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </div>
              <span className="text-[10px] px-2 py-0.5 border rounded-full bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                Complété
              </span>
            </div>
            <div className="text-sm text-slate-100 mt-1">
              {a.service_type || "Intervention"}
            </div>
            {(a.service_address || a.service_city) && (
              <div className="text-xs text-slate-400 mt-0.5">
                {[a.service_address, a.service_city].filter(Boolean).join(", ")}
              </div>
            )}
            {a.appointment_number && (
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                RDV {a.appointment_number}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  /* ─── Section: Profile ─── */
  const ProfileView = () => (
    <div className="px-4 pb-24 pt-3 space-y-3">
      <h2 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Mon profil</h2>
      <div className="bg-[#111827] border border-slate-700 rounded-xl p-4 space-y-3">
        <ProfileRow label="Nom" value={technician.full_name || "—"} />
        <ProfileRow label="Courriel" value={technician.email || user?.email || "—"} />
        <ProfileRow label="Téléphone" value={technician.phone || "—"} />
        <ProfileRow
          label="Statut"
          value={isAvailable ? "Disponible" : "Occupé"}
        />
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
            Spécialisations
          </div>
          {Array.isArray(technician.specializations) && technician.specializations.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {(technician.specializations as string[]).map((s) => (
                <span
                  key={s}
                  className="text-[10px] px-2 py-0.5 bg-slate-700/60 text-slate-200 rounded-full border border-slate-600"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500">—</div>
          )}
        </div>
        {technician.notes && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
              Notes
            </div>
            <div className="text-xs text-slate-300 whitespace-pre-wrap">{technician.notes}</div>
          </div>
        )}
      </div>
      {selectedTechId && (
        <Button
          onClick={handleClearSelection}
          variant="outline"
          className="w-full h-11 border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800"
        >
          Changer de technicien
        </Button>
      )}
    </div>
  );

  /* ─── Section: Support (mailto fallback view) ─── */
  const SupportView = () => (
    <div className="px-4 pb-24 pt-3">
      <h2 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Support</h2>
      <div className="bg-[#111827] border border-slate-700 rounded-xl p-4 text-center">
        <MessageCircle className="w-7 h-7 text-blue-400 mx-auto mb-2" />
        <p className="text-sm text-slate-200">Contacter le support</p>
        <a
          href="mailto:support@nivratelecom.ca"
          className="text-xs text-blue-300 underline mt-1 inline-block"
        >
          support@nivratelecom.ca
        </a>
      </div>
    </div>
  );

  // Trigger mail client when Support tab opens
  useEffect(() => {
    if (activeTab === "support") {
      window.location.href = "mailto:support@nivratelecom.ca";
    }
  }, [activeTab]);

  return (
    <MobileShell activeTab={activeTab} setActiveTab={setActiveTab}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-100">Mes interventions</h1>
            <p className="text-xs text-slate-400 capitalize">{fmtDateLong(new Date())}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center">
              <User className="w-4 h-4 text-slate-200" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-100">
                {technician.full_name || user?.email || "Technicien"}
              </div>
              <div className="text-[11px] text-slate-500">
                {isAvailable ? "Prêt à intervenir" : "Indisponible"}
              </div>
            </div>
          </div>

          {/* Status toggle */}
          <div className="flex bg-slate-800 rounded-full p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => setTechStatus.mutate("available")}
              disabled={setTechStatus.isPending}
              className={`px-3 h-8 text-xs rounded-full transition-colors ${
                isAvailable
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Disponible
            </button>
            <button
              type="button"
              onClick={() => setTechStatus.mutate("busy")}
              disabled={setTechStatus.isPending}
              className={`px-3 h-8 text-xs rounded-full transition-colors ${
                !isAvailable
                  ? "bg-amber-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Occupé
            </button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "today" && <TodayView />}
      {activeTab === "history" && <HistoryView />}
      {activeTab === "profile" && <ProfileView />}
      {activeTab === "support" && <SupportView />}

      {/* ─── Completion modal ─── */}
      <Dialog open={!!completeFor} onOpenChange={(o) => !o && setCompleteFor(null)}>
        <DialogContent className="bg-[#0d1421] border-slate-700 text-slate-100 max-w-sm">
          <DialogHeader>
            <DialogTitle>Compléter l'intervention</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-400">Notes de complétion</Label>
              <Textarea
                value={cNotes}
                onChange={(e) => setCNotes(e.target.value)}
                placeholder="Détails de l'installation, observations…"
                className="bg-slate-900 border-slate-700 text-sm min-h-[80px]"
              />
            </div>
            <CheckRow
              checked={cEquip}
              onChange={setCEquip}
              label="Équipement installé"
            />
            <CheckRow
              checked={cClientInformed}
              onChange={setCClientInformed}
              label="Client informé"
            />
            <CheckRow
              checked={cTested}
              onChange={setCTested}
              label="Test de connexion effectué"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-slate-600 bg-transparent text-slate-200"
              onClick={() => setCompleteFor(null)}
            >
              Annuler
            </Button>
            <Button
              onClick={submitComplete}
              disabled={cSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {cSubmitting ? "Enregistrement…" : "Confirmer complétion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Issue modal ─── */}
      <Dialog open={!!issueFor} onOpenChange={(o) => !o && setIssueFor(null)}>
        <DialogContent className="bg-[#0d1421] border-slate-700 text-slate-100 max-w-sm">
          <DialogHeader>
            <DialogTitle>Signaler un problème</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-400">Raison</Label>
              <Select value={iReason} onValueChange={setIReason}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-sm h-10">
                  <SelectValue placeholder="Choisir une raison…" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                  {ISSUE_REASONS.map((r) => (
                    <SelectItem key={r} value={r} className="text-sm">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Notes</Label>
              <Textarea
                value={iNotes}
                onChange={(e) => setINotes(e.target.value)}
                placeholder="Détails additionnels…"
                className="bg-slate-900 border-slate-700 text-sm min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-slate-600 bg-transparent text-slate-200"
              onClick={() => setIssueFor(null)}
            >
              Annuler
            </Button>
            <Button
              onClick={submitIssue}
              disabled={iSubmitting || !iReason}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {iSubmitting ? "Envoi…" : "Signaler"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobileShell>
  );
}

/* ─── Shell + bottom nav ─── */
function MobileShell({
  children,
  activeTab,
  setActiveTab,
}: {
  children: React.ReactNode;
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
}) {
  return (
    <div className="min-h-screen w-full bg-[#0d1421] text-slate-100">
      <div className="mx-auto w-full max-w-[430px] min-h-screen relative">
        {children}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#0d1421] border-t border-slate-700 grid grid-cols-4 z-30">
          <BottomTab
            id="today"
            current={activeTab}
            onClick={setActiveTab}
            label="Aujourd'hui"
            icon={<Calendar className="w-5 h-5" />}
          />
          <BottomTab
            id="history"
            current={activeTab}
            onClick={setActiveTab}
            label="Historique"
            icon={<Clock className="w-5 h-5" />}
          />
          <BottomTab
            id="profile"
            current={activeTab}
            onClick={setActiveTab}
            label="Profil"
            icon={<User className="w-5 h-5" />}
          />
          <BottomTab
            id="support"
            current={activeTab}
            onClick={setActiveTab}
            label="Support"
            icon={<MessageCircle className="w-5 h-5" />}
          />
        </nav>
      </div>
    </div>
  );
}

function BottomTab({
  id,
  current,
  onClick,
  label,
  icon,
}: {
  id: TabId;
  current: TabId;
  onClick: (t: TabId) => void;
  label: string;
  icon: React.ReactNode;
}) {
  const active = current === id;
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`flex flex-col items-center justify-center py-2.5 min-h-[56px] text-[11px] transition-colors ${
        active ? "text-blue-400" : "text-slate-400"
      }`}
    >
      {icon}
      <span className="mt-0.5">{label}</span>
    </button>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100 font-medium text-right">{value}</span>
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
        className="border-slate-600 data-[state=checked]:bg-emerald-600"
      />
      <span className="text-sm text-slate-200">{label}</span>
    </label>
  );
}
