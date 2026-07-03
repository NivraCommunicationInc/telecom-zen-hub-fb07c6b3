/**
 * AppointmentsPage — Nivra Core operational scheduling module.
 * List + Month calendar views over `appointments`. Row/day actions:
 * déplacer, annuler (raison obligatoire), compléter, no-show, assigner tech.
 * Every action writes an automatic system note to client_internal_notes,
 * and DB triggers push the client email for status/date changes.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { AppointmentActionsMenu } from "@/core-app/components/appointments/AppointmentActionsMenu";
import { AppointmentCalendarView } from "@/core-app/components/appointments/AppointmentCalendarView";
import {
  Calendar, Search, RefreshCw, ArrowRight, Plus, Loader2,
  MapPin, User, Wrench, Settings, LayoutGrid, List,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { EnvironmentFilter } from "@/core-app/hooks/useEnvironmentFilter";
import { CoreEnvironmentToggle } from "@/core-app/components/CoreEnvironmentToggle";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const STATUS_FILTERS = [
  { label: "Tous", value: "" },
  { label: "Planifié", value: "scheduled" },
  { label: "Confirmé", value: "confirmed" },
  { label: "En cours", value: "in_progress" },
  { label: "Terminé", value: "completed" },
  { label: "Annulé", value: "cancelled" },
  { label: "No-show", value: "no_show" },
  { label: "Replanifié", value: "rescheduled" },
];

const TYPE_FILTERS = [
  { label: "Tous", value: "" },
  { label: "Technicien", value: "technician" },
  { label: "Auto-installation", value: "auto" },
];

const TIME_SLOTS = ["09h - 12h", "12h - 15h", "15h - 18h", "18h - 20h"];

const scheduledAtFromSlot = (date: string, slot: string) => {
  const hour = slot.match(/(\d{1,2})h/)?.[1] || "9";
  const d = new Date(`${date}T${hour.padStart(2, "0")}:00:00`);
  return d.toISOString();
};

const AppointmentsPage = () => {
  const [envFilter, setEnvFilter] = useState<EnvironmentFilter>('live');
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [view, setView] = useState<"list" | "calendar">("calendar");
  const [newOpen, setNewOpen] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newSlot, setNewSlot] = useState(TIME_SLOTS[0]);
  const [newServiceType, setNewServiceType] = useState("Internet");
  const [newTechId, setNewTechId] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ["core-appointments", statusFilter, envFilter],
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select("*")
        .order("scheduled_at", { ascending: false })
        .limit(500);

      if (envFilter !== 'all') query = query.eq("environment", envFilter);
      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clientOptions = [], isFetching: clientsLoading } = useQuery({
    queryKey: ["appointment-client-search", clientSearch],
    enabled: newOpen && clientSearch.trim().length >= 2,
    queryFn: async () => {
      const q = clientSearch.trim();
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, full_name, email, phone, service_address, service_city, service_postal_code")
        .or(`email.ilike.%${q}%,full_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .limit(8);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: techs = [] } = useQuery({
    queryKey: ["core-technicians-active-inline"],
    enabled: newOpen,
    queryFn: async () => {
      const { data, error } = await supabase.from("technicians").select("id, full_name, status").order("full_name");
      if (error) throw error;
      return (data || []).filter((t: any) => t.status !== "inactive");
    },
  });

  const createManualAppointment = async () => {
    if (!selectedClient?.user_id) return toast.error("Sélectionnez un client existant");
    if (!newDate || !newSlot) return toast.error("Date et créneau requis");
    setSavingNew(true);
    try {
      const { error } = await supabase.from("appointments").insert({
        client_id: selectedClient.user_id,
        client_email: selectedClient.email || null,
        client_phone: selectedClient.phone || null,
        title: `Installation Technicien - ${newServiceType}`,
        description: newSlot,
        scheduled_at: scheduledAtFromSlot(newDate, newSlot),
        duration_minutes: 180,
        status: "scheduled",
        service_type: newServiceType,
        service_address: selectedClient.service_address || null,
        service_city: selectedClient.service_city || null,
        service_postal_code: selectedClient.service_postal_code || null,
        installation_method: "technician",
        technician_id: newTechId || null,
        internal_notes: newNotes || null,
        environment: "live",
      } as any);
      if (error) throw error;
      toast.success("Rendez-vous créé");
      setNewOpen(false);
      setSelectedClient(null);
      setClientSearch("");
      setNewNotes("");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setSavingNew(false);
    }
  };

  const filtered = useMemo(() => {
    if (!appointments) return [];
    let list = appointments;
    if (typeFilter) {
      list = list.filter(a => a.installation_method === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.appointment_number?.toLowerCase().includes(q) ||
        a.title?.toLowerCase().includes(q) ||
        a.client_email?.toLowerCase().includes(q) ||
        a.service_address?.toLowerCase().includes(q) ||
        a.service_city?.toLowerCase().includes(q) ||
        a.order_id?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [appointments, search, typeFilter]);

  const counts = useMemo(() => {
    if (!appointments) return { total: 0, scheduled: 0, completed: 0, today: 0 };
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return {
      total: appointments.length,
      scheduled: appointments.filter(a => a.status === "scheduled" || a.status === "confirmed").length,
      completed: appointments.filter(a => a.status === "completed").length,
      today: appointments.filter(a => a.scheduled_at?.startsWith(todayStr)).length,
    };
  }, [appointments]);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      scheduled: "Planifié", confirmed: "Confirmé", in_progress: "En cours",
      completed: "Terminé", cancelled: "Annulé", rescheduled: "Replanifié",
    };
    return map[s] || s;
  };

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-400" />
            Rendez-vous
          </h1>
          <p className="text-xs text-[hsl(220,10%,50%)]">
            Planification opérationnelle — installations, livraisons, service
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CoreEnvironmentToggle value={envFilter} onChange={setEnvFilter} />
          <div className="flex items-center gap-1 rounded-md border border-[hsl(220,15%,18%)] p-0.5 bg-[hsl(220,20%,10%)]">
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition ${view === "list" ? "bg-emerald-600/20 text-emerald-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              <List className="h-3 w-3" /> Liste
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition ${view === "calendar" ? "bg-emerald-600/20 text-emerald-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              <LayoutGrid className="h-3 w-3" /> Calendrier
            </button>
          </div>
          <Link
            to={corePath("/appointments/slots")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-800/50 transition"
          >
            <Settings className="h-3 w-3" /> Disponibilités
          </Link>
          <Button
            size="sm"
            onClick={() => setNewOpen(true)}
            className="h-8 text-xs bg-[#0066CC] hover:bg-[#0052A3] text-white"
          >
            <Plus className="h-3 w-3 mr-1" /> Nouveau rendez-vous
          </Button>
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-md text-[hsl(220,10%,45%)] hover:text-white hover:bg-[hsl(220,15%,16%)] transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "TOTAL", value: counts.total, color: "text-white" },
          { label: "AUJOURD'HUI", value: counts.today, color: "text-amber-400" },
          { label: "PLANIFIÉS", value: counts.scheduled, color: "text-blue-400" },
          { label: "TERMINÉS", value: counts.completed, color: "text-emerald-400" },
        ].map(k => (
          <div key={k.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] p-3">
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,40%)]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(220,10%,40%)]" />
          <input
            type="text"
            placeholder="Rechercher par numéro, client, adresse…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-md text-sm bg-[hsl(220,20%,12%)] border border-[hsl(220,15%,18%)] text-[hsl(220,10%,85%)] placeholder:text-[hsl(220,10%,35%)] focus:outline-none focus:border-emerald-600/50"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === f.value
                  ? "bg-emerald-600/20 text-emerald-400"
                  : "text-[hsl(220,10%,50%)] hover:bg-[hsl(220,15%,14%)] hover:text-[hsl(220,10%,75%)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                typeFilter === f.value
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-[hsl(220,10%,50%)] hover:bg-[hsl(220,15%,14%)] hover:text-[hsl(220,10%,75%)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Count ── */}
      <div className="text-xs text-[hsl(220,10%,40%)] border-b border-[hsl(220,15%,14%)] pb-2">
        {filtered.length} rendez-vous
      </div>

      {/* ── Content: List or Calendar ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[hsl(220,10%,40%)]">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Chargement…
        </div>
      ) : view === "calendar" ? (
        <AppointmentCalendarView
          appointments={filtered}
          onSelect={(a) => { window.location.href = corePath(`/appointments/${a.id}`); }}
        />
      ) : filtered.length === 0 ? (
        <p className="text-center py-12 text-[hsl(220,10%,40%)] text-sm">Aucun rendez-vous trouvé</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[hsl(220,15%,16%)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)]">
                <th className="text-left px-3 py-2.5 font-medium text-[hsl(220,10%,50%)]">Nº</th>
                <th className="text-left px-3 py-2.5 font-medium text-[hsl(220,10%,50%)]">Date / Heure</th>
                <th className="text-left px-3 py-2.5 font-medium text-[hsl(220,10%,50%)]">Titre</th>
                <th className="text-left px-3 py-2.5 font-medium text-[hsl(220,10%,50%)]">Client</th>
                <th className="text-left px-3 py-2.5 font-medium text-[hsl(220,10%,50%)]">Adresse</th>
                <th className="text-left px-3 py-2.5 font-medium text-[hsl(220,10%,50%)]">Méthode</th>
                <th className="text-left px-3 py-2.5 font-medium text-[hsl(220,10%,50%)]">Statut</th>
                <th className="text-right px-3 py-2.5 font-medium text-[hsl(220,10%,50%)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220,15%,14%)]">
              {filtered.map(apt => {
                const scheduled = apt.scheduled_at ? new Date(apt.scheduled_at) : null;
                const isPast = scheduled ? scheduled < new Date() : false;

                return (
                  <tr
                    key={apt.id}
                    className={`hover:bg-[hsl(220,15%,12%)] transition-colors ${isPast ? "opacity-60" : ""}`}
                  >
                    <td className="px-3 py-2.5 font-mono text-[hsl(220,10%,50%)]">
                      {apt.appointment_number || "—"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {scheduled ? (
                        <div>
                          <span className="text-white font-medium">
                            {format(scheduled, "d MMM yyyy", { locale: fr })}
                          </span>
                          <span className="ml-1.5 text-[hsl(220,10%,50%)]">
                            {format(scheduled, "HH:mm")}
                          </span>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[hsl(220,10%,80%)] max-w-[200px] truncate">
                      {apt.title}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 text-[hsl(220,10%,65%)]">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[160px]">{apt.client_email || "—"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 text-[hsl(220,10%,55%)] max-w-[180px] truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {apt.service_address || "—"}
                          {apt.service_city && `, ${apt.service_city}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {apt.installation_method === "technician" ? (
                        <span className="inline-flex items-center gap-1 text-amber-400">
                          <Wrench className="h-3 w-3" /> Tech
                        </span>
                      ) : apt.installation_method === "auto" ? (
                        <span className="text-blue-400">Auto</span>
                      ) : (
                        <span className="text-[hsl(220,10%,40%)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge label={statusLabel(apt.status || "scheduled")} variant={statusToVariant(apt.status || "scheduled")} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <AppointmentActionsMenu appointment={apt} onRefresh={refetch} />
                        <Link
                          to={corePath(`/appointments/${apt.id}`)}
                          className="p-1 rounded text-[hsl(220,10%,45%)] hover:text-emerald-400 hover:bg-emerald-600/10 transition-colors"
                          title="Détail"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)] text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Nouveau rendez-vous manuel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-slate-400">Client existant</Label>
              <Input
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setSelectedClient(null); }}
                placeholder="Rechercher nom ou courriel…"
                className="h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1"
              />
              {selectedClient ? (
                <div className="mt-2 rounded border border-emerald-700/40 bg-emerald-950/20 p-2 text-xs text-emerald-200">
                  Sélectionné: {selectedClient.full_name || `${selectedClient.first_name || ""} ${selectedClient.last_name || ""}`.trim() || selectedClient.email} · {selectedClient.email}
                </div>
              ) : clientSearch.trim().length >= 2 && (
                <div className="mt-2 max-h-44 overflow-auto rounded border border-slate-800 bg-[#0d1421]">
                  {clientsLoading ? <div className="p-3 text-xs text-slate-500">Recherche…</div> : clientOptions.map((c: any) => (
                    <button
                      key={c.user_id}
                      type="button"
                      onClick={() => setSelectedClient(c)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800/70 border-b border-slate-800 last:border-b-0"
                    >
                      <span className="block text-slate-100">{c.full_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email}</span>
                      <span className="block text-slate-500">{c.email} · {[c.service_address, c.service_city].filter(Boolean).join(", ")}</span>
                    </button>
                  ))}
                  {!clientsLoading && clientOptions.length === 0 && <div className="p-3 text-xs text-slate-500">Aucun client trouvé</div>}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-400">Date</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1" />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Créneau</Label>
                <select value={newSlot} onChange={(e) => setNewSlot(e.target.value)} className="w-full mt-1 bg-[#0d1421] border border-slate-700 text-slate-100 text-sm rounded-md h-9 px-2">
                  {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-slate-400">Forfait / service</Label>
                <Input value={newServiceType} onChange={(e) => setNewServiceType(e.target.value)} className="h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Technicien</Label>
              <select value={newTechId} onChange={(e) => setNewTechId(e.target.value)} className="w-full mt-1 bg-[#0d1421] border border-slate-700 text-slate-100 text-sm rounded-md h-9 px-2">
                <option value="">— Non assigné —</option>
                {techs.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Notes</Label>
              <Textarea rows={3} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className="text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1" />
            </div>
            <p className="text-[11px] text-slate-500">Ce rendez-vous consomme immédiatement la capacité du créneau public grâce à la lecture des rendez-vous actifs par le checkout.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} className="h-9 text-xs">Annuler</Button>
            <Button onClick={createManualAppointment} disabled={savingNew} className="h-9 text-xs bg-[#0066CC] hover:bg-[#0052A3] text-white">
              {savingNew && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppointmentsPage;
