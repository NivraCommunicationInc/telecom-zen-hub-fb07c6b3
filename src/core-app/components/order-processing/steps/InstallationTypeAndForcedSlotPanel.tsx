/**
 * InstallationTypeAndForcedSlotPanel — Phase 2 add-ons for Core order detail.
 *   • "Changer le type d'installation" (technician ↔ auto) with fee delta
 *      handled server-side (credit or invoice adjust or account fee).
 *   • "Créer un rendez-vous forcé" — insère un rendez-vous avec date/plage
 *      arbitraire (hors calendrier public), utile pour cas spéciaux.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CalendarPlus, Repeat, Loader2, Wrench, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { resolveTechnicianInput } from "@/core-app/lib/technicians";

interface Props { proc: any; }

const inputClass = "h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 rounded-lg";
const labelClass = "text-[10px] uppercase tracking-wider text-slate-500 mb-1 block";

export function InstallationTypeAndForcedSlotPanel({ proc }: Props) {
  const { order, appointment } = proc;
  const queryClient = useQueryClient();

  const fulfillmentType = String(order?.fulfillment_type || "").toLowerCase();
  const installationType = String(order?.installation_type || "").toLowerCase();
  const apptMethod = String(appointment?.installation_method || "").toLowerCase();
  const hasSelectedTechnicianDate = Boolean(order?.appointment_date || appointment?.scheduled_at);
  const isTechnician =
    apptMethod === "technician" ||
    fulfillmentType === "technician" ||
    fulfillmentType === "installation" ||
    installationType === "technician" ||
    (hasSelectedTechnicianDate && !["self_install", "auto", "ship", "shipping"].includes(fulfillmentType));
  const isAuto = !isTechnician;
  const targetType: "auto" | "technician" = isAuto ? "technician" : "auto";

  const [swapOpen, setSwapOpen] = useState(false);
  const [swapReason, setSwapReason] = useState("");
  const [swapBusy, setSwapBusy] = useState(false);

  const [forcedOpen, setForcedOpen] = useState(false);
  const [forcedDate, setForcedDate] = useState<string>("");
  const [forcedFrom, setForcedFrom] = useState<string>("08:00");
  const [forcedTo, setForcedTo] = useState<string>("10:00");
  const [forcedMethod, setForcedMethod] = useState<"technician" | "auto">("technician");
  const [forcedTechInput, setForcedTechInput] = useState<string>("");
  const [forcedNotes, setForcedNotes] = useState<string>("");
  const [forcedBusy, setForcedBusy] = useState(false);

  const handleSwap = async () => {
    if (!swapReason.trim()) { toast.error("Motif obligatoire"); return; }
    setSwapBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("core-installation-type-change", {
        body: { order_id: order.id, new_type: targetType, reason: swapReason.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const bits: string[] = [];
      if ((data as any).credit_issued > 0) bits.push(`Crédit ${(data as any).credit_issued.toFixed(2)} $ émis au compte`);
      if ((data as any).invoice_adjusted) bits.push("facture ajustée");
      if ((data as any).charge_added > 0) bits.push(`frais ${(data as any).charge_added.toFixed(2)} $ ajouté`);
      toast.success(`Type d'installation changé → ${targetType}${bits.length ? ` — ${bits.join(", ")}` : ""}`);
      setSwapOpen(false); setSwapReason("");
      await queryClient.invalidateQueries({ queryKey: ["order-processing"] });
      await queryClient.invalidateQueries({ queryKey: ["order-detail"] });
    } catch (e: any) {
      toast.error(e?.message || "Échec du changement");
    } finally { setSwapBusy(false); }
  };

  const handleForced = async () => {
    if (!forcedDate || !forcedFrom || !forcedTo) { toast.error("Date et plage horaire requis"); return; }
    if (forcedFrom >= forcedTo) { toast.error("Heure de fin doit être après le début"); return; }
    setForcedBusy(true);
    try {
      const scheduledAt = new Date(`${forcedDate}T${forcedFrom}:00`).toISOString();
      const endAt = new Date(`${forcedDate}T${forcedTo}:00`);
      const startAt = new Date(`${forcedDate}T${forcedFrom}:00`);
      const durationMin = Math.max(30, Math.round((endAt.getTime() - startAt.getTime()) / 60000));
      let technician: { id: string; full_name: string } | null = null;
      if (forcedMethod === "technician" && forcedTechInput.trim()) {
        const resolved = await resolveTechnicianInput(forcedTechInput);
        if (!resolved.technician) { toast.error(resolved.error || "Technicien introuvable"); return; }
        technician = resolved.technician;
      }

      const payload: any = {
        order_id: order.id,
        client_id: order.user_id || null,
        technician_id: forcedMethod === "technician" ? (technician?.id || null) : null,
        scheduled_at: scheduledAt,
        duration_minutes: durationMin,
        title: forcedMethod === "technician" ? "Installation technicien (rendez-vous forcé)" : "Installation (rendez-vous forcé)",
        description: forcedNotes || "Rendez-vous créé hors calendrier public par un agent Core",
        service_address: order.service_address || order.client_full_address || "",
        service_city: order.service_city || "",
        service_postal_code: order.service_postal_code || "",
        installation_method: forcedMethod,
        status: "confirmed",
        environment: "live",
      };
      const { error } = await supabase.from("appointments").insert(payload as any);
      if (error) throw error;

      try {
        await proc.addNote(
          `[Rendez-vous forcé] ${new Date(scheduledAt).toLocaleString("fr-CA")} — ${forcedFrom}→${forcedTo}${technician ? ` — tech ${technician.full_name}` : ""}${forcedNotes ? ` — ${forcedNotes}` : ""}`
        );
      } catch {}

      toast.success("Rendez-vous forcé créé");
      setForcedOpen(false);
      setForcedDate(""); setForcedNotes(""); setForcedTechInput("");
      await queryClient.invalidateQueries({ queryKey: ["order-processing"] });
      await queryClient.invalidateQueries({ queryKey: ["appointment-slot-availability"] });
    } catch (e: any) {
      toast.error(e?.message || "Échec de la création du rendez-vous forcé");
    } finally { setForcedBusy(false); }
  };

  return (
    <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
      <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
        <h4 className="text-[11px] font-medium text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5" /> Type d'installation & rendez-vous forcé
        </h4>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isAuto ? "bg-emerald-900/50 text-emerald-300" : "bg-blue-900/50 text-blue-300"}`}>
          {isAuto ? "Auto-installation" : "Installation technicien"}
        </span>
      </div>
      <div className="p-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => setSwapOpen(true)}
          className="text-xs bg-transparent border border-slate-600 text-slate-200 hover:bg-slate-800"
        >
          <Repeat className="w-3 h-3 mr-1" />
          Passer en {isAuto ? "installation technicien" : "auto-installation"}
        </Button>
        <Button
          size="sm"
          onClick={() => setForcedOpen(true)}
          className="text-xs bg-transparent border border-amber-700/60 text-amber-200 hover:bg-amber-950/40"
        >
          <CalendarPlus className="w-3 h-3 mr-1" />
          Rendez-vous forcé (hors calendrier)
        </Button>
      </div>

      {/* Swap dialog */}
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent className="bg-[#0d1421] border-slate-700 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {targetType === "auto" ? <Home className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
              Changer vers {targetType === "auto" ? "auto-installation" : "installation technicien"}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              {targetType === "auto" ? (
                <>
                  Si les frais d'installation ont déjà été payés, un <b>crédit</b> équivalent sera automatiquement ajouté au compte du client.
                  Si la facture n'est pas encore payée, elle sera <b>ajustée</b> à la baisse.
                </>
              ) : (
                <>
                  Les frais d'installation technicien seront ajoutés à la <b>facture en attente</b> ou, à défaut, provisionnés
                  comme <b>frais sur le compte</b> pour la prochaine facturation.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className={labelClass}>Motif <span className="text-red-400">*</span></Label>
            <Textarea
              value={swapReason}
              onChange={(e) => setSwapReason(e.target.value)}
              placeholder="Ex : client incapable d'attendre le technicien, préfère installer lui-même…"
              className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSwapOpen(false)} disabled={swapBusy}>Annuler</Button>
            <Button size="sm" onClick={handleSwap} disabled={swapBusy || !swapReason.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
              {swapBusy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Confirmer le changement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forced appointment dialog */}
      <Dialog open={forcedOpen} onOpenChange={setForcedOpen}>
        <DialogContent className="bg-[#0d1421] border-slate-700 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="w-4 h-4" /> Créer un rendez-vous forcé
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Ce rendez-vous est créé <b>hors calendrier public</b> — utile pour les cas particuliers où aucun créneau standard n'est disponible.
              Un journal est ajouté à la commande.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3">
                <Label className={labelClass}>Date</Label>
                <Input type="date" value={forcedDate} onChange={(e) => setForcedDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <Label className={labelClass}>De</Label>
                <Input type="time" value={forcedFrom} onChange={(e) => setForcedFrom(e.target.value)} className={inputClass} />
              </div>
              <div>
                <Label className={labelClass}>À</Label>
                <Input type="time" value={forcedTo} onChange={(e) => setForcedTo(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <Label className={labelClass}>Méthode d'installation</Label>
              <RadioGroup value={forcedMethod} onValueChange={(v) => setForcedMethod(v as any)} className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                  <RadioGroupItem value="technician" /> Technicien
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                  <RadioGroupItem value="auto" /> Auto-installation
                </label>
              </RadioGroup>
            </div>
            {forcedMethod === "technician" && (
              <div>
                <Label className={labelClass}>Nom du technicien (optionnel)</Label>
                <Input value={forcedTechInput} onChange={(e) => setForcedTechInput(e.target.value)} placeholder="Ex : Jean Tremblay"
                  className={inputClass} />
                <p className="text-[10px] text-slate-500 mt-1">Le nom est converti automatiquement vers le technicien actif.</p>
              </div>
            )}
            <div>
              <Label className={labelClass}>Note interne</Label>
              <Textarea value={forcedNotes} onChange={(e) => setForcedNotes(e.target.value)}
                placeholder="Contexte / motif du forçage…"
                className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setForcedOpen(false)} disabled={forcedBusy}>Annuler</Button>
            <Button size="sm" onClick={handleForced} disabled={forcedBusy || !forcedDate} className="bg-amber-600 hover:bg-amber-700 text-white">
              {forcedBusy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CalendarPlus className="w-3 h-3 mr-1" />}
              Créer le rendez-vous forcé
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
