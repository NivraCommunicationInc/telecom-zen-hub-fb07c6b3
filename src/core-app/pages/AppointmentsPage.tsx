/**
 * AppointmentsPage — Nivra Core operational scheduling module.
 * Reuses the appointments table directly via supabase client.
 * Dark ops-grade list with filters, status, and links to related entities.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import {
  Calendar, Search, RefreshCw, ArrowRight,
  MapPin, User, Clock, Wrench,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { EnvironmentFilter } from "@/hooks/admin/useEnvironmentFilter";
import { CoreEnvironmentToggle, TestBadge } from "@/core-app/components/CoreEnvironmentToggle";

const STATUS_FILTERS = [
  { label: "Tous", value: "" },
  { label: "Planifié", value: "scheduled" },
  { label: "Confirmé", value: "confirmed" },
  { label: "En cours", value: "in_progress" },
  { label: "Terminé", value: "completed" },
  { label: "Annulé", value: "cancelled" },
  { label: "Replanifié", value: "rescheduled" },
];

const TYPE_FILTERS = [
  { label: "Tous", value: "" },
  { label: "Technicien", value: "technician" },
  { label: "Auto-installation", value: "auto" },
];

const AppointmentsPage = () => {
  const [envFilter, setEnvFilter] = useState<EnvironmentFilter>('live');
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ["core-appointments", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select("*")
        .order("scheduled_at", { ascending: false })
        .limit(200);

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

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
        <button
          onClick={() => refetch()}
          className="p-1.5 rounded-md text-[hsl(220,10%,45%)] hover:text-white hover:bg-[hsl(220,15%,16%)] transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
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

      {/* ── Table ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[hsl(220,10%,40%)]">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Chargement…
        </div>
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
                    {/* Number */}
                    <td className="px-3 py-2.5 font-mono text-[hsl(220,10%,50%)]">
                      {apt.appointment_number || "—"}
                    </td>

                    {/* Date */}
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

                    {/* Title */}
                    <td className="px-3 py-2.5 text-[hsl(220,10%,80%)] max-w-[200px] truncate">
                      {apt.title}
                    </td>

                    {/* Client */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 text-[hsl(220,10%,65%)]">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[160px]">{apt.client_email || "—"}</span>
                      </div>
                    </td>

                    {/* Address */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 text-[hsl(220,10%,55%)] max-w-[180px] truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {apt.service_address || "—"}
                          {apt.service_city && `, ${apt.service_city}`}
                        </span>
                      </div>
                    </td>

                    {/* Method */}
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

                    {/* Status */}
                    <td className="px-3 py-2.5">
                      <StatusBadge label={statusLabel(apt.status || "scheduled")} variant={statusToVariant(apt.status || "scheduled")} />
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {apt.order_id && (
                          <Link
                            to={`/core/orders/${apt.order_id}`}
                            className="px-2 py-1 rounded text-[10px] font-medium bg-[hsl(220,15%,16%)] text-[hsl(220,10%,60%)] hover:text-emerald-400 hover:bg-emerald-600/10 transition-colors"
                            title="Voir commande"
                          >
                            Commande
                          </Link>
                        )}
                        <Link
                          to={`/core/appointments/${apt.id}`}
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
    </div>
  );
};

export default AppointmentsPage;
