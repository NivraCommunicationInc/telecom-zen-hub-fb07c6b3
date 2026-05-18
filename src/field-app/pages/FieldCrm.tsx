/**
 * FieldCrm — Prospect database for field agents.
 * Lists all crm_contacts (imported leads from Shopify, etc.) with filtering,
 * search, click-to-call, and quick status update. Agents pull from the shared
 * pool of 659+ prospects. Uses RLS — field_sales role can SELECT all,
 * UPDATE when assigned to them or unassigned.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import {
  PhoneCall, Loader2, Search, Phone, MapPin, ChevronRight,
  CheckCircle2, Clock, XCircle, AlertCircle, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { fieldPath } from "@/field-app/lib/fieldPaths";

type CrmContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  postal_code: string | null;
  call_status: string | null;
  call_attempts: number | null;
  last_called_at: string | null;
  callback_scheduled_at: string | null;
  priority: number | null;
  source: string | null;
  status: string | null;
  assigned_to: string | null;
  converted_to_user_id: string | null;
  call_notes: string | null;
  created_at: string;
};

const CALL_STATUS_META: Record<string, { label: string; icon: typeof PhoneCall; cls: string }> = {
  not_called:   { label: "À appeler",      icon: PhoneCall,    cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  called:       { label: "Appelé",         icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  no_answer:    { label: "Pas de réponse", icon: AlertCircle,  cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  callback:     { label: "Rappel prévu",   icon: Clock,        cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  not_interested:{ label: "Pas intéressé", icon: XCircle,      cls: "bg-gray-500/15 text-gray-300 border-gray-500/30" },
  interested:   { label: "Intéressé",      icon: CheckCircle2, cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  converted:    { label: "Converti",       icon: CheckCircle2, cls: "bg-violet-600/20 text-violet-300 border-violet-500/40" },
};

const STATUS_FILTERS = [
  { key: "all",            label: "Tous" },
  { key: "not_called",     label: "À appeler" },
  { key: "no_answer",      label: "Pas de réponse" },
  { key: "callback",       label: "Rappel" },
  { key: "interested",     label: "Intéressé" },
  { key: "called",         label: "Appelé" },
];

export default function FieldCrm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useStaffUser();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["field-crm-contacts", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("crm_contacts")
        .select("id, first_name, last_name, full_name, phone, email, city, address, postal_code, call_status, call_attempts, last_called_at, callback_scheduled_at, priority, source, status, assigned_to, converted_to_user_id, call_notes, created_at")
        .order("priority", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1000);
      if (statusFilter !== "all") q = q.eq("call_status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CrmContact[];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const cities = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => { if (c.city) set.add(c.city); });
    return ["all", ...Array.from(set).sort()];
  }, [contacts]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (cityFilter !== "all" && c.city !== cityFilter) return false;
      if (!needle) return true;
      const hay = [c.full_name, c.first_name, c.last_name, c.phone, c.email, c.city, c.address, c.postal_code]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [contacts, search, cityFilter]);

  const stats = useMemo(() => {
    const total = contacts.length;
    const toCall = contacts.filter((c) => c.call_status === "not_called").length;
    const interested = contacts.filter((c) => c.call_status === "interested").length;
    return { total, toCall, interested };
  }, [contacts]);

  const updateStatus = async (id: string, newStatus: string) => {
    if (!user?.id) return;
    setUpdating(id);
    try {
      const patch: Record<string, any> = {
        call_status: newStatus,
        last_called_by: user.id,
      };
      if (newStatus !== "not_called") {
        patch.last_called_at = new Date().toISOString();
        patch.call_attempts = (contacts.find((c) => c.id === id)?.call_attempts ?? 0) + 1;
      }
      const { error } = await supabase.from("crm_contacts").update(patch).eq("id", id);
      if (error) throw error;
      toast.success("Statut mis à jour");
      queryClient.invalidateQueries({ queryKey: ["field-crm-contacts"] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur de mise à jour");
    } finally {
      setUpdating(null);
    }
  };

  const displayName = (c: CrmContact) =>
    c.full_name?.trim() ||
    [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
    c.email || c.phone || "Sans nom";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <PhoneCall className="h-6 w-6 text-violet-400" />
            CRM Prospects
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Base de prospects à appeler — pool partagé.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-gray-800 border border-gray-700 p-3">
          <div className="text-[11px] text-gray-400 uppercase tracking-wide">Total</div>
          <div className="text-xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="rounded-xl bg-gray-800 border border-violet-500/30 p-3">
          <div className="text-[11px] text-violet-300 uppercase tracking-wide">À appeler</div>
          <div className="text-xl font-bold text-violet-300">{stats.toCall}</div>
        </div>
        <div className="rounded-xl bg-gray-800 border border-emerald-500/30 p-3">
          <div className="text-[11px] text-emerald-300 uppercase tracking-wide">Intéressés</div>
          <div className="text-xl font-bold text-emerald-300">{stats.interested}</div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher nom, téléphone, ville, courriel…"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 min-h-[44px]"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors min-h-[36px]",
                statusFilter === f.key
                  ? "bg-violet-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {cities.length > 2 && (
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 min-h-[44px]"
            >
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city === "all" ? "Toutes les villes" : city}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-8 text-center">
          <p className="text-sm text-gray-400">Aucun prospect trouvé.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[11px] text-gray-500 px-1">
            {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
          </div>
          {filtered.map((c) => {
            const meta = CALL_STATUS_META[c.call_status || "not_called"] || CALL_STATUS_META.not_called;
            const Icon = meta.icon;
            return (
              <div
                key={c.id}
                className="rounded-xl bg-gray-800 border border-gray-700 p-3 hover:border-violet-500/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-white truncate">{displayName(c)}</h3>
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border", meta.cls)}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                      {c.converted_to_user_id && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-600/20 text-violet-300 border border-violet-500/30">
                          Client
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5 text-[12px] text-gray-400">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-violet-300 hover:text-violet-200 font-medium">
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </a>
                      )}
                      {(c.city || c.address) && (
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{[c.address, c.city, c.postal_code].filter(Boolean).join(", ")}</span>
                        </div>
                      )}
                      {c.email && <div className="truncate text-gray-500 text-[11px]">{c.email}</div>}
                      {(c.call_attempts ?? 0) > 0 && c.last_called_at && (
                        <div className="text-[10px] text-gray-500">
                          {c.call_attempts} tentative{(c.call_attempts || 0) > 1 ? "s" : ""} · dernier : {formatDistanceToNow(new Date(c.last_called_at), { addSuffix: true, locale: fr })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-semibold transition-colors min-h-[36px]"
                    >
                      <Phone className="h-3.5 w-3.5" /> Appeler
                    </a>
                  )}
                  <button
                    onClick={() => updateStatus(c.id, "no_answer")}
                    disabled={updating === c.id}
                    className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-[12px] font-medium transition-colors disabled:opacity-50 min-h-[36px]"
                  >
                    Pas de réponse
                  </button>
                  <button
                    onClick={() => updateStatus(c.id, "interested")}
                    disabled={updating === c.id}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[12px] font-medium transition-colors disabled:opacity-50 min-h-[36px]"
                  >
                    Intéressé
                  </button>
                  <button
                    onClick={() => updateStatus(c.id, "not_interested")}
                    disabled={updating === c.id}
                    className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-[12px] font-medium transition-colors disabled:opacity-50 min-h-[36px]"
                  >
                    Pas intéressé
                  </button>
                  <button
                    onClick={() => navigate(fieldPath("/sale/new") + `?prospect=${c.id}`)}
                    className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/40 text-[12px] font-semibold transition-colors min-h-[36px]"
                  >
                    Convertir <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
