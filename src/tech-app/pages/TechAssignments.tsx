/**
 * TechAssignments — Mobile-first list of missions with status actions.
 * Day filters (Today / Tomorrow / Week), full client info, large touch buttons.
 */
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock, MapPin, Package, Wrench, Truck, PlayCircle, XCircle,
  UserPlus, Loader2, AlertCircle, Phone,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TechHeader from "../components/TechHeader";
import { useTechAssignments, type TechAssignment } from "../lib/useTechAssignments";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-slate-700/50 text-slate-200 border-slate-600",
  en_route: "bg-orange-500/20 text-orange-300 border-orange-500/40 animate-pulse",
  arrived: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  in_progress: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  missed: "bg-red-500/20 text-red-300 border-red-500/40",
  rescheduled: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  cancelled: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  no_show: "bg-red-500/20 text-red-300 border-red-500/40",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Planifié",
  en_route: "En route 🚗",
  arrived: "Arrivé",
  in_progress: "En cours 🔧",
  completed: "Complété ✅",
  missed: "Manqué ❌",
  rescheduled: "Replanifié",
  cancelled: "Annulé",
  no_show: "Manqué ❌",
};

type DayFilter = "today" | "tomorrow" | "week" | "all";

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

export default function TechAssignments() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useTechAssignments();
  const [filter, setFilter] = useState<DayFilter>("today");
  const [uid, setUid] = useState<string | null>(null);
  const [missingFor, setMissingFor] = useState<TechAssignment | null>(null);
  const [missReason, setMissReason] = useState("");
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const claim = useMutation({
    mutationFn: async (id: string) => {
      if (!uid) throw new Error("Non authentifié");
      const { error } = await supabase
        .from("technician_assignments")
        .update({ technician_id: uid })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tech-assignments-all"] });
      toast.success("Mission acceptée ✅");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ a, status, note }: { a: TechAssignment; status: string; note?: string }) => {
      const update: any = { status };
      if (status === "missed") update.missed_at = new Date().toISOString();
      if (note) update.technician_notes = note;
      const { error } = await supabase
        .from("technician_assignments")
        .update(update)
        .eq("id", a.id);
      if (error) throw error;

      // Queue notification email
      if (a.order_id && (status === "en_route" || status === "missed")) {
        const { data: o } = await supabase
          .from("orders")
          .select("client_email, client_first_name, order_number")
          .eq("id", a.order_id)
          .maybeSingle();
        if (o?.client_email) {
          await supabase.from("email_queue").insert({
            to_email: o.client_email,
            template_key: status === "en_route" ? "tech_en_route" : "tech_missed",
            template_vars: {
              first_name: o.client_first_name || "Client",
              tech_name: "Votre technicien Nivra",
              eta: "sous peu",
              scheduled_date: a.scheduled_date,
              order_number: o.order_number,
            },
            status: "queued",
            language: "fr",
          });
        }
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["tech-assignments-all"] });
      const msg = vars.status === "en_route" ? "Client notifié ✅" : "Statut mis à jour";
      toast.success(msg);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const filtered = useMemo(() => {
    const today = isoDate(new Date());
    const tomorrow = isoDate(new Date(Date.now() + 86400_000));
    const weekEnd = isoDate(new Date(Date.now() + 7 * 86400_000));
    if (filter === "today") return data.filter((a) => a.scheduled_date === today);
    if (filter === "tomorrow") return data.filter((a) => a.scheduled_date === tomorrow);
    if (filter === "week") return data.filter((a) => a.scheduled_date >= today && a.scheduled_date <= weekEnd);
    return data;
  }, [data, filter]);

  function confirmMissed() {
    if (!missingFor) return;
    if (!missReason.trim()) {
      toast.error("Raison obligatoire");
      return;
    }
    setStatus.mutate(
      { a: missingFor, status: "missed", note: missReason.trim() },
      {
        onSuccess: () => {
          setMissingFor(null);
          setMissReason("");
        },
      },
    );
  }

  return (
    <div>
      <TechHeader title="Mes Missions" />
      <div className="px-4 py-4">
        {/* Day filters */}
        <div role="tablist" className="grid grid-cols-4 gap-2 mb-4">
          {([
            ["today", "Aujourd'hui"],
            ["tomorrow", "Demain"],
            ["week", "Semaine"],
            ["all", "Toutes"],
          ] as const).map(([k, lbl]) => (
            <button
              key={k}
              role="tab"
              aria-selected={filter === k}
              onClick={() => setFilter(k)}
              className={`min-h-[44px] px-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                filter === k
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30"
                  : "bg-slate-900 border border-slate-800 text-slate-300"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        {/* Missions list */}
        {isLoading ? (
          <div className="text-center py-16 text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <AlertCircle className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-white">Aucune mission pour cette période</p>
            <p className="text-sm text-slate-400 mt-1">Vérifiez avec votre coordinateur.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((a) => {
              const terminal = ["completed", "cancelled", "missed", "no_show"].includes(a.status);
              const isMine = a.technician_id === uid;
              const isUnassigned = !a.technician_id;
              return (
                <li key={a.id} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center text-xs font-bold px-3 py-1 rounded-full border ${STATUS_STYLES[a.status] ?? STATUS_STYLES.scheduled}`}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </span>
                    <span className="text-sm font-bold text-white tabular-nums flex items-center gap-1">
                      <Clock className="h-4 w-4 text-violet-400" />
                      {a.scheduled_time_start?.slice(0, 5)}
                    </span>
                  </div>

                  {/* Client */}
                  <div className="space-y-1.5">
                    <p className="text-base font-bold text-white flex items-center gap-2">
                      👤 {a.client_name || "Client"}
                    </p>
                    {a.client_address && (
                      <p className="text-sm text-slate-300 flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-violet-400" />
                        <span>{a.client_address}</span>
                      </p>
                    )}
                    {a.client_phone && (
                      <a href={`tel:${a.client_phone}`} className="text-sm text-violet-300 flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0" />
                        {a.client_phone}
                      </a>
                    )}
                  </div>

                  {/* Services & equipment */}
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

                  {/* Actions */}
                  {!terminal && (
                    <div className="space-y-2 pt-1">
                      {isUnassigned && !isMine ? (
                        <button
                          onClick={() => claim.mutate(a.id)}
                          disabled={claim.isPending}
                          className="w-full min-h-[48px] rounded-full bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          <UserPlus className="h-4 w-4" />
                          Accepter cette mission
                        </button>
                      ) : (
                        <>
                          {a.status === "scheduled" && (
                            <button
                              onClick={() => setStatus.mutate({ a, status: "en_route" })}
                              disabled={setStatus.isPending}
                              className="w-full min-h-[48px] rounded-full bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                              <Truck className="h-4 w-4" />
                              En Route
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/tech/installation/${a.id}`)}
                            className="w-full min-h-[48px] rounded-full bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-bold flex items-center justify-center gap-2"
                          >
                            <PlayCircle className="h-4 w-4" />
                            Démarrer l'installation
                          </button>
                          <button
                            onClick={() => setMissingFor(a)}
                            className="w-full min-h-[44px] rounded-full bg-transparent border-2 border-red-600/60 text-red-300 text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-600/10"
                          >
                            <XCircle className="h-4 w-4" />
                            Rendez-vous manqué
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Missed reason dialog */}
      <Dialog open={!!missingFor} onOpenChange={(o) => !o && setMissingFor(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmer le rendez-vous manqué</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-300">
            Cette action notifiera le client par courriel. Veuillez fournir une raison.
          </p>
          <Textarea
            placeholder="Raison (obligatoire) — ex: client absent, accès refusé..."
            value={missReason}
            onChange={(e) => setMissReason(e.target.value)}
            className="min-h-[100px] bg-slate-950 border-slate-700 text-white"
          />
          <DialogFooter className="gap-2">
            <button
              onClick={() => setMissingFor(null)}
              className="min-h-[44px] px-5 rounded-full bg-slate-800 text-slate-200 text-sm font-semibold"
            >
              Annuler
            </button>
            <button
              onClick={confirmMissed}
              disabled={setStatus.isPending}
              className="min-h-[44px] px-5 rounded-full bg-red-600 text-white text-sm font-bold disabled:opacity-60"
            >
              {setStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer manqué"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
