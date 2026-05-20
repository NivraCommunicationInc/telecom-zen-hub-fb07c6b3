/**
 * ShippingTechnicianStep — Step: Shipping AND/OR Technician workflow
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Truck, Wrench, Bell, CheckCircle2, Loader2, Calendar, MapPin, Clock, User, ClipboardCheck, CalendarClock, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StepCompletionCard } from "../StepCompletionCard";
import { AppointmentSlotPicker } from "@/core-app/components/appointments/AppointmentSlotPicker";
import { useProfileName } from "@/hooks/useProfileName";

interface TechnicianOption {
  id: string;
  full_name: string;
  phone: string | null;
  status: string;
  specializations: string[] | null;
}

interface Props { proc: any; }

const inputClass = "h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 rounded-lg";
const labelClass = "text-[10px] uppercase tracking-wider text-slate-500 mb-1 block";

export function ShippingTechnicianStep({ proc }: Props) {
  const { order, appointment, installationEstimate, items } = proc;
  const technicianName = useProfileName(appointment?.technician_id ?? null, "—");


  // ── INTELLIGENT FULFILLMENT ROUTING ──
  // Determine what was ordered to show ONLY relevant sections.
  const svcType = String(order?.service_type || "").toLowerCase();
  const itemList: any[] = Array.isArray(items) ? items : [];
  const itemTypes = itemList
    .map((i) => String(i?.item_type || i?.product_type || i?.service_type || "").toLowerCase())
    .filter(Boolean);
  const itemNames = itemList
    .map((i) => String(i?.product_name || i?.name || i?.description || "").toLowerCase())
    .join(" ");

  const hasInternet =
    svcType.includes("internet") ||
    itemTypes.some((t) => t.includes("internet")) ||
    /\binternet\b/.test(itemNames);
  const hasTv =
    svcType.includes("tv") ||
    svcType.includes("télé") ||
    itemTypes.some((t) => t.includes("tv") || t.includes("television") || t.includes("télé")) ||
    /\b(tv|télé|television)\b/.test(itemNames);
  const hasMobile =
    svcType.includes("mobile") ||
    svcType.includes("sim") ||
    itemTypes.some((t) => t.includes("mobile") || t.includes("sim") || t.includes("esim")) ||
    /\b(mobile|sim|esim)\b/.test(itemNames);

  const fulfillmentType = order.fulfillment_type || "";
  const isSelfInstall = fulfillmentType === "self_install";

  // Fulfillment rules:
  //  • Internet only OR Internet+TV       → technician installation only
  //  • Internet+TV+Mobile (full bundle)   → BOTH technician (internet/TV) + shipping (SIM)
  //  • Mobile only                        → shipping only
  //  • self_install explicit              → confirmation only (no panels)
  const requiresTechnician = !isSelfInstall && (hasInternet || hasTv);
  const requiresShipping = !isSelfInstall && (hasMobile || (!hasInternet && !hasTv));

  // Show panel if rule applies OR data already exists for that fulfillment
  const showTechnicianPanel =
    !isSelfInstall && (requiresTechnician || !!appointment || fulfillmentType === "technician" || fulfillmentType === "installation");
  const showShippingPanel =
    !isSelfInstall && (requiresShipping || !!order.tracking_number || !!order.carrier || fulfillmentType === "shipping");

  const [loading, setLoading] = useState<string | null>(null);
  const [contractGate, setContractGate] = useState<{
    open: boolean;
    targetStatus: "shipped" | "in_transit" | "out_for_delivery" | null;
    reason: string;
    forcing: boolean;
  }>({ open: false, targetStatus: null, reason: "", forcing: false });
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newSlotIso, setNewSlotIso] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const [shippingFields, setShippingFields] = useState({
    carrier: order.carrier || "",
    tracking_number: order.tracking_number || "",
    tracking_url: order.tracking_url || "",
  });

  const [techFields, setTechFields] = useState({
    technician_id: order.technician_id || "",
    installNotes: "",
    completionNotes: "",
  });

  const { data: technicians = [], isLoading: techLoading } = useQuery({
    queryKey: ["active-technicians"],
    queryFn: async () => {
      const { data, error } = await supabase.from("technicians")
        .select("id, full_name, phone, status, specializations")
        .eq("status", "active").order("full_name", { ascending: true });
      if (error) throw error;
      return (data || []) as TechnicianOption[];
    },
    staleTime: 60_000,
  });

  const selectedTechnician = technicians.find((t) => t.id === techFields.technician_id);

  const isContractGateError = (err: any) => String(err?.message || "").startsWith("CONTRACT_NOT_SIGNED");

  const handleSaveShipping = async () => {
    setLoading("save");
    try { await proc.updateShipping({ ...shippingFields, shipped_at: new Date().toISOString() }); }
    finally { setLoading(null); }
  };

  const handleMarkShipped = async () => {
    setLoading("shipped");
    try {
      await proc.updateShipping({ ...shippingFields, shipped_at: new Date().toISOString() });
      await proc.changeStatus("shipped");
    } catch (err: any) {
      if (isContractGateError(err)) {
        setContractGate({ open: true, targetStatus: "shipped", reason: "", forcing: false });
      }
    } finally { setLoading(null); }
  };

  const handleForceShip = async () => {
    if (!contractGate.targetStatus || !contractGate.reason.trim()) {
      toast.error("Justification obligatoire");
      return;
    }
    setContractGate((g) => ({ ...g, forcing: true }));
    try {
      await proc.changeStatus(contractGate.targetStatus, {
        forceOverride: true,
        overrideReason: contractGate.reason.trim(),
      });
      setContractGate({ open: false, targetStatus: null, reason: "", forcing: false });
    } catch (err: any) {
      console.error("[ShippingTechnicianStep] Force ship failed:", err);
      setContractGate((g) => ({ ...g, forcing: false }));
    }
  };

  const handleMarkDelivered = async () => {
    setLoading("delivered");
    try {
      await proc.changeStatus("delivered");
      await proc.sendClientNotification("order_completed", "Votre commande a été livrée — Nivra", {
        carrier: shippingFields.carrier || order.carrier || "",
        tracking_number: shippingFields.tracking_number || order.tracking_number || "",
      });
    } finally { setLoading(null); }
  };

  const handleNotifyShipping = async () => {
    setLoading("notify-ship");
    try {
      await proc.sendClientNotification("shipment_created", "Votre commande a été expédiée — Nivra", {
        carrier: shippingFields.carrier || order.carrier || "",
        tracking_number: shippingFields.tracking_number || order.tracking_number || "",
        tracking_url: shippingFields.tracking_url || order.tracking_url || "",
      });
    } finally { setLoading(null); }
  };

  const handleConfirmAppointment = async () => {
    setLoading("confirm-apt");
    try {
      await proc.sendClientNotification("appointment_confirmed", "Rendez-vous d'installation confirmé — Nivra", {
        appointment_date: appointment?.scheduled_at || "",
        service_address: appointment?.service_address || "",
      });
      toast.success("Confirmation de rendez-vous envoyée");
    } finally { setLoading(null); }
  };

  const handleAssignTechnician = async () => {
    if (!techFields.technician_id) { toast.error("Veuillez sélectionner un technicien"); return; }
    setLoading("tech");
    try {
      // 1. Update order with technician
      await proc.assignTechnician(techFields.technician_id);

      // 2. Ensure an appointment row exists / is updated with technician + slot
      const scheduledAt = appointment?.scheduled_at || newSlotIso || null;
      if (appointment?.id) {
        const { error: aptErr } = await supabase
          .from("appointments")
          .update({
            technician_id: techFields.technician_id,
            scheduled_at: scheduledAt || appointment.scheduled_at,
            status: scheduledAt ? "confirmed" : appointment.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", appointment.id);
        if (aptErr) console.warn("[Technician][assign] appointment update:", aptErr.message);
      } else if (scheduledAt) {
        // No appointment yet — create one
        const { error: insErr } = await supabase.from("appointments").insert({
          order_id: order.id,
          client_id: order.user_id,
          technician_id: techFields.technician_id,
          scheduled_at: scheduledAt,
          title: "Installation",
          service_address: order.service_address || order.client_full_address || "",
          service_city: order.service_city || "",
          service_postal_code: order.service_postal_code || "",
          status: "confirmed",
          environment: order.environment || "production",
        } as any);
        if (insErr) console.warn("[Technician][assign] appointment insert:", insErr.message);
      }

      // 3. Notes
      if (techFields.installNotes) await proc.addNote(`[Installation] ${techFields.installNotes}`);

      // 4. Confirmation toast with technician name + slot
      const techName = selectedTechnician?.full_name || "le technicien";
      const when = scheduledAt ? new Date(scheduledAt).toLocaleString("fr-CA") : "(à planifier)";
      toast.success(`${techName} assigné — ${when}`);

      await queryClient.invalidateQueries({ queryKey: ["order-processing"] });
    } finally { setLoading(null); }
  };

  const handleMarkEnRoute = async () => {
    setLoading("enroute");
    try {
      await proc.changeStatus("technician_en_route");
      await proc.sendClientNotification("technician_en_route", "Votre technicien est en route — Nivra",
        { appointment_date: appointment?.scheduled_at || "", service_address: appointment?.service_address || "" });
    } finally { setLoading(null); }
  };

  const handleInstallComplete = async () => {
    setLoading("install");
    try {
      if (techFields.completionNotes) await proc.addNote(`[Installation terminée] ${techFields.completionNotes}`);
      await proc.changeStatus("installation_completed");
      await proc.sendClientNotification("installation_completed", "Votre installation est terminée — Nivra",
        { appointment_date: appointment?.scheduled_at || "", service_address: appointment?.service_address || "" });
    } finally { setLoading(null); }
  };

  const handleInstallFailed = async () => {
    setLoading("install-fail");
    try {
      if (techFields.completionNotes) await proc.addNote(`[Installation échouée] ${techFields.completionNotes}`);
      await proc.changeStatus("installation_failed");
      toast.warning("Installation marquée comme échouée");
    } finally { setLoading(null); }
  };

  const handleReschedule = async () => {
    if (!appointment?.id || !newSlotIso) {
      toast.error("Sélectionnez un nouveau créneau");
      return;
    }
    setLoading("reschedule");
    try {
      const oldAt = appointment.scheduled_at;
      const { error } = await supabase
        .from("appointments")
        .update({
          scheduled_at: newSlotIso,
          status: "rescheduled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointment.id);
      if (error) throw error;

      // Auto note on order
      try {
        await proc.addNote(
          `[Rendez-vous replanifié] ${oldAt ? new Date(oldAt).toLocaleString("fr-CA") : "—"} → ${new Date(newSlotIso).toLocaleString("fr-CA")}`
        );
      } catch {}

      toast.success("Rendez-vous replanifié");
      setRescheduleOpen(false);
      setNewSlotIso(null);
      await queryClient.invalidateQueries({ queryKey: ["order-processing"] });
      await queryClient.invalidateQueries({ queryKey: ["appointment-slot-availability"] });
    } catch (err: any) {
      console.error("[Reschedule] failed:", err);
      toast.error(err?.message || "Replanification échouée");
    } finally {
      setLoading(null);
    }
  };

  const fmtDateTime = (d: string | null | undefined) => {
    if (!d) return "—";
    try { return format(new Date(d), "d MMM yyyy HH:mm", { locale: fr }); } catch { return "—"; }
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">
        {isSelfInstall ? "Auto-installation" : showTechnicianPanel && showShippingPanel ? "Technicien & Expédition" : showTechnicianPanel ? "Technicien & Installation" : "Expédition"}
      </div>

      {isSelfInstall && (
        <div className="bg-emerald-950/40 border border-emerald-700/50 rounded-xl p-4 mb-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-300 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-200">Auto-installation par le client</p>
            <p className="text-xs text-emerald-300/80 mt-1">
              Le client a explicitement choisi l'auto-installation. Aucune assignation de technicien ni expédition gérée n'est requise.
            </p>
          </div>
        </div>
      )}

      {appointment?.status === "completed" && (
        <StepCompletionCard
          title="Installation complétée par le technicien"
          at={appointment.scheduled_at}
          details={[
            { label: "Technicien", value: appointment.technician_id ? technicianName : null },
            { label: "Rendez-vous", value: appointment.scheduled_at ? fmtDateTime(appointment.scheduled_at) : null },
            { label: "Adresse", value: appointment.service_address },
            { label: "Méthode", value: appointment.installation_method },
          ]}
        />
      )}
      {order.shipped_at && order.tracking_number && (
        <StepCompletionCard
          title="Commande expédiée au client"
          at={order.shipped_at}
          details={[
            { label: "Transporteur", value: order.carrier },
            { label: "N° de suivi", value: order.tracking_number, mono: true },
          ]}
        />
      )}

      {/* Technician/Installation card */}
      {showTechnicianPanel && (
        <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
          <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
            <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" /> Workflow d'installation
            </h4>
          </div>
          <div className="p-4 space-y-4">
            {appointment && (
              <div className="bg-[#0d1421] rounded-lg border border-slate-700/50 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">Rendez-vous</span>
                  <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                    appointment.status === "completed" ? "bg-green-900/50 text-green-300" :
                    appointment.status === "confirmed" ? "bg-blue-900/50 text-blue-300" :
                    appointment.status === "cancelled" ? "bg-red-900/50 text-red-300" :
                    "bg-amber-900/50 text-amber-300"
                  }`}>{appointment.status || "planifié"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300"><Calendar className="h-3 w-3 text-slate-500" /> {fmtDateTime(appointment.scheduled_at)}</div>
                  <div className="flex items-center gap-1.5 text-slate-300"><MapPin className="h-3 w-3 text-slate-500" /> {appointment.service_address || "—"}</div>
                  {appointment.appointment_number && <div className="flex items-center gap-1.5 text-slate-300"><ClipboardCheck className="h-3 w-3 text-slate-500" /> N° {appointment.appointment_number}</div>}
                  {appointment.installation_method && <div className="flex items-center gap-1.5 text-slate-300"><Wrench className="h-3 w-3 text-slate-500" /> {appointment.installation_method}</div>}
                </div>
                {appointment.technician_id && (
                  <div className="flex items-center gap-1.5 text-xs text-green-300">
                    <User className="h-3 w-3" /> Technicien: <span>{technicianName}</span>
                  </div>
                )}
                {appointment.status !== "completed" && appointment.status !== "cancelled" && (
                  <div className="pt-2 mt-2 border-t border-slate-700/50">
                    {!rescheduleOpen ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setRescheduleOpen(true); setNewSlotIso(null); }}
                        className="h-7 text-xs text-amber-300 hover:bg-amber-950/40 hover:text-amber-200 px-2"
                      >
                        <CalendarClock className="h-3 w-3 mr-1" /> Replanifier le rendez-vous
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className={labelClass}>Nouveau créneau</Label>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setRescheduleOpen(false); setNewSlotIso(null); }}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-200"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <AppointmentSlotPicker value={newSlotIso} onChange={setNewSlotIso} variant="core" />
                        <Button
                          size="sm"
                          onClick={handleReschedule}
                          disabled={!newSlotIso || loading === "reschedule"}
                          className="w-full text-xs bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          {loading === "reschedule" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CalendarClock className="w-3 h-3 mr-1" />}
                          Confirmer la replanification
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {installationEstimate && (
              <div className={`rounded-lg border p-3 ${installationEstimate.wiringNeeded ? "bg-amber-950/50 border-amber-700/50 text-amber-300" : "bg-[#0d1421] border-slate-700/50 text-slate-100"}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3 w-3" />
                  <span className="text-[10px] uppercase tracking-wider font-medium">Durée estimée</span>
                </div>
                <p className="text-sm font-medium">{installationEstimate.label}</p>
                {installationEstimate.wiringNeeded && (
                  <p className="text-xs mt-1 opacity-80">⚠ Prévoir du matériel de câblage supplémentaire</p>
                )}
              </div>
            )}

            {!appointment && showTechnicianPanel && (
              <div className="bg-[#0d1421] rounded-lg border border-slate-700/50 p-3">
                <Label className={labelClass}>Créneau d'installation</Label>
                <AppointmentSlotPicker value={newSlotIso} onChange={setNewSlotIso} variant="core" />
                {newSlotIso && (
                  <p className="text-[10px] text-emerald-400 mt-1">
                    Sélectionné : {new Date(newSlotIso).toLocaleString("fr-CA")}
                  </p>
                )}
              </div>
            )}

            <div>
              <Label className={labelClass}>Technicien</Label>
              <Select value={techFields.technician_id || undefined} onValueChange={(v) => setTechFields({ ...techFields, technician_id: v })} disabled={techLoading}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder={techLoading ? "Chargement…" : technicians.length === 0 ? "Aucun technicien actif" : "Sélectionner"} />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{t.full_name}</span>
                        {(t.phone || (t.specializations && t.specializations.length > 0)) && (
                          <span className="text-[10px] text-slate-500">
                            {t.phone || ""}{t.phone && t.specializations?.length ? " • " : ""}{t.specializations?.join(", ") || ""}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTechnician && (<p className="text-[10px] text-slate-500 mt-1 font-mono">ID: {selectedTechnician.id.slice(0, 8)}…</p>)}
              <p className="text-[10px] text-slate-500 mt-0.5">{technicians.length} technicien(s) actif(s)</p>
            </div>

            <div>
              <Label className={labelClass}>Notes d'installation</Label>
              <Textarea value={techFields.installNotes} onChange={(e) => setTechFields({ ...techFields, installNotes: e.target.value })}
                placeholder="Instructions pour le technicien…" className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg min-h-[56px]" />
            </div>
            <div>
              <Label className={labelClass}>Notes de complétion</Label>
              <Textarea value={techFields.completionNotes} onChange={(e) => setTechFields({ ...techFields, completionNotes: e.target.value })}
                placeholder="Observations de l'installation…" className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg min-h-[56px]" />
            </div>

            <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-700/50">
              <Button size="sm" onClick={handleConfirmAppointment} disabled={loading === "confirm-apt"} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
                {loading === "confirm-apt" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Bell className="w-3 h-3 mr-1" />} Confirmer RV
              </Button>
              <Button size="sm" onClick={handleAssignTechnician} disabled={loading === "tech" || proc.isUpdating} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
                {loading === "tech" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wrench className="w-3 h-3 mr-1" />} Assigner
              </Button>
              <Button size="sm" onClick={handleMarkEnRoute} disabled={loading === "enroute" || proc.isUpdating} className="text-sm bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800">
                {loading === "enroute" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Truck className="w-3 h-3 mr-1" />} En route
              </Button>
              <Button size="sm" onClick={handleInstallComplete} disabled={loading === "install" || proc.isUpdating} className="text-sm bg-green-600 hover:bg-green-700 text-white">
                {loading === "install" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />} Complétée
              </Button>
              <Button size="sm" onClick={handleInstallFailed} disabled={loading === "install-fail" || proc.isUpdating} className="text-sm bg-red-700 hover:bg-red-800 text-white">
                {loading === "install-fail" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Échec
              </Button>
            </div>
          </div>
        </div>
      )}

      {contractGate.open && (
        <div className="bg-amber-950/50 border border-amber-700/50 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-200">Contrat non signé — expédition bloquée</p>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Le client n'a pas encore signé. Vous pouvez forcer l'expédition avec une justification (auditée).
              </p>
            </div>
          </div>
          <Label className="text-[10px] uppercase tracking-wider text-amber-200/80">Justification pour forcer l'expédition</Label>
          <Textarea
            value={contractGate.reason}
            onChange={(e) => setContractGate((g) => ({ ...g, reason: e.target.value }))}
            placeholder="Raison de l'override…"
            className="bg-[#0d1421] border-amber-700/40 text-slate-100 text-sm rounded-lg min-h-[60px] mt-1 mb-2"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleForceShip} disabled={contractGate.forcing || !contractGate.reason.trim()}
              className="text-sm bg-red-700 hover:bg-red-800 text-white">
              {contractGate.forcing ? "Expédition forcée…" : "Forcer l'expédition (override admin)"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setContractGate({ open: false, targetStatus: null, reason: "", forcing: false })}
              disabled={contractGate.forcing} className="text-sm text-slate-300 hover:bg-slate-800">
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Shipping card */}
      {showShippingPanel && (
        <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
          <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
            <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" /> Expédition
            </h4>
          </div>
          <div className="p-4 space-y-4">
            {order.shipped_at && (
              <div className="bg-green-950/50 border border-green-700/50 text-green-300 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Expédié le {order.shipped_at.slice(0, 10)}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className={labelClass}>Transporteur</Label>
                <Input value={shippingFields.carrier} onChange={(e) => setShippingFields({ ...shippingFields, carrier: e.target.value })}
                  placeholder="Postes Canada, Purolator…" className={inputClass} />
              </div>
              <div>
                <Label className={labelClass}>Numéro de suivi</Label>
                <Input value={shippingFields.tracking_number} onChange={(e) => setShippingFields({ ...shippingFields, tracking_number: e.target.value })}
                  placeholder="Tracking #" className={`${inputClass} font-mono`} />
              </div>
              <div className="md:col-span-2">
                <Label className={labelClass}>Lien de suivi</Label>
                <Input value={shippingFields.tracking_url} onChange={(e) => setShippingFields({ ...shippingFields, tracking_url: e.target.value })}
                  placeholder="https://..." className={inputClass} />
              </div>
            </div>

            <div className="bg-[#0d1421] rounded-lg border border-slate-700/50 p-3">
              <h4 className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Adresse de livraison</h4>
              <p className="text-sm text-slate-100">
                {[order.shipping_address, order.shipping_city, order.shipping_province, order.shipping_postal_code]
                  .filter(Boolean).join(", ") || order.client_full_address || "Non spécifiée"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-700/50">
              <Button size="sm" onClick={handleSaveShipping} disabled={loading === "save" || proc.isUpdating} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
                {loading === "save" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} Sauvegarder
              </Button>
              <Button size="sm" onClick={handleMarkShipped} disabled={loading === "shipped" || proc.isUpdating || order.status === "shipped"} className="text-sm bg-green-600 hover:bg-green-700 text-white">
                {loading === "shipped" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Truck className="w-3 h-3 mr-1" />} Marquer expédié
              </Button>
              <Button size="sm" onClick={handleMarkDelivered} disabled={loading === "delivered" || proc.isUpdating || order.status === "delivered"} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
                {loading === "delivered" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />} Marquer livré
              </Button>
              <Button size="sm" onClick={handleNotifyShipping} disabled={loading === "notify-ship"} className="text-sm bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800">
                {loading === "notify-ship" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Bell className="w-3 h-3 mr-1" />} Notifier
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
