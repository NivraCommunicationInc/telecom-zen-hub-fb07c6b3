/**
 * AppointmentActionsMenu — Dropdown with the 5 Core actions on an appointment:
 * déplacer / annuler / compléter / no-show / assigner technicien.
 * Reason is required for cancel; move requires new date+time.
 * All actions write an automatic note to client_internal_notes.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { MoreVertical, Calendar, XCircle, CheckCircle2, UserX, Wrench, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  rescheduleAppointment, cancelAppointment, completeAppointment, markNoShow, assignTechnician,
} from "./appointmentActions";

interface Props {
  appointment: any;
  onRefresh: () => void;
}

export function AppointmentActionsMenu({ appointment: apt, onRefresh }: Props) {
  const [dlg, setDlg] = useState<null | "move" | "cancel" | "assign">(null);
  const [loading, setLoading] = useState(false);

  // Move
  const [newDate, setNewDate] = useState(() => apt.scheduled_at?.slice(0, 16) || "");
  const [moveReason, setMoveReason] = useState("");
  // Cancel
  const [cancelReason, setCancelReason] = useState("");
  // Assign
  const [selectedTech, setSelectedTech] = useState<string>(apt.technician_id || "");

  const { data: techs = [] } = useQuery({
    queryKey: ["core-technicians-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("id, full_name, status")
        .order("full_name");
      if (error) throw error;
      return (data || []).filter((t: any) => t.status !== "inactive");
    },
    enabled: dlg === "assign",
  });

  const run = async (fn: () => Promise<void>, successMsg: string) => {
    setLoading(true);
    try {
      await fn();
      toast.success(successMsg);
      setDlg(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const doMove = () => {
    if (!newDate) return toast.error("Date requise");
    run(() => rescheduleAppointment(apt, new Date(newDate).toISOString(), moveReason), "Rendez-vous déplacé");
  };

  const doCancel = () => {
    if (!cancelReason.trim()) return toast.error("Raison obligatoire");
    run(() => cancelAppointment(apt, cancelReason), "Rendez-vous annulé");
  };

  const doComplete = () => {
    if (!confirm("Marquer ce rendez-vous comme complété ?")) return;
    run(() => completeAppointment(apt), "Marqué complété");
  };

  const doNoShow = () => {
    if (!confirm("Marquer le client comme absent (no-show) ?")) return;
    run(() => markNoShow(apt), "Marqué no-show");
  };

  const doAssign = () => {
    const t = techs.find((x: any) => x.id === selectedTech);
    run(
      () => assignTechnician(apt, selectedTech || null, t?.full_name || ""),
      "Technicien mis à jour",
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1 rounded text-[hsl(220,10%,45%)] hover:text-white hover:bg-[hsl(220,15%,16%)] transition-colors"
            title="Actions"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)] text-slate-200">
          <DropdownMenuItem onClick={() => setDlg("move")} className="text-xs">
            <Calendar className="h-3.5 w-3.5 mr-2 text-blue-400" /> Déplacer…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDlg("assign")} className="text-xs">
            <Wrench className="h-3.5 w-3.5 mr-2 text-amber-400" /> Assigner technicien…
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-800" />
          <DropdownMenuItem onClick={doComplete} className="text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-400" /> Marquer complété
          </DropdownMenuItem>
          <DropdownMenuItem onClick={doNoShow} className="text-xs">
            <UserX className="h-3.5 w-3.5 mr-2 text-red-400" /> Marquer no-show
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-800" />
          <DropdownMenuItem onClick={() => setDlg("cancel")} className="text-xs text-red-300 focus:text-red-200">
            <XCircle className="h-3.5 w-3.5 mr-2" /> Annuler…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Move dialog */}
      <Dialog open={dlg === "move"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Déplacer le rendez-vous</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-400">Nouvelle date &amp; heure</Label>
              <Input
                type="datetime-local"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Un courriel officiel de modification est envoyé automatiquement au client.
              </p>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Motif (optionnel)</Label>
              <Textarea
                rows={2}
                value={moveReason}
                onChange={(e) => setMoveReason(e.target.value)}
                className="text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)} className="h-9 text-xs">Annuler</Button>
            <Button onClick={doMove} disabled={loading} className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white">
              {loading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Déplacer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={dlg === "cancel"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Annuler le rendez-vous</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-400">Raison de l'annulation (obligatoire)</Label>
              <Textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Client injoignable, indisponible, changement de commande…"
                className="text-sm bg-[#0d1421] border-slate-700 text-slate-100 mt-1"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Un courriel officiel d'annulation est envoyé automatiquement au client.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)} className="h-9 text-xs">Retour</Button>
            <Button onClick={doCancel} disabled={loading} className="h-9 text-xs bg-red-600 hover:bg-red-700 text-white">
              {loading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Confirmer l'annulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={dlg === "assign"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent className="bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Assigner un technicien</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-xs text-slate-400">Technicien</Label>
            <select
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
              className="w-full bg-[#0d1421] border border-slate-700 text-slate-100 text-sm rounded-md h-9 px-2"
            >
              <option value="">— Aucun (désassigner) —</option>
              {techs.map((t: any) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)} className="h-9 text-xs">Annuler</Button>
            <Button onClick={doAssign} disabled={loading} className="h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white">
              {loading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
