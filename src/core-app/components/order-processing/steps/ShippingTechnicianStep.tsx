/**
 * ShippingTechnicianStep — Step: Shipping AND/OR Technician workflow
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Truck, Wrench, Bell, CheckCircle2, Loader2, Calendar, MapPin, Clock, User, ClipboardCheck, CalendarClock, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StepCompletionCard } from "../StepCompletionCard";
import { AppointmentSlotPicker } from "@/core-app/components/appointments/AppointmentSlotPicker";
import { InstallationTypeAndForcedSlotPanel } from "./InstallationTypeAndForcedSlotPanel";
import { AutoInstallNetworkGate } from "./AutoInstallNetworkGate";
import { generateDeliverySlipPDF } from "@/lib/pdf/deliverySlipTemplate";
import { LiveTrackingTimeline } from "../LiveTrackingTimeline";
import { FileText } from "lucide-react";
import { useProfileName } from "@/hooks/useProfileName";
import { resolveTechnicianInput } from "@/core-app/lib/technicians";

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

  // BUG-CORE-002C Phase 3 — Routing priority:
  //   1) appointment.installation_method (canonical hold, most authoritative)
  //   2) orders.fulfillment_type (explicit self_install)
  //   3) legacy inference from service_type / items
  const apptMethod = String(appointment?.installation_method || "").toLowerCase();
  const fulfillmentType = String(order.fulfillment_type || "").toLowerCase();
  const installationType = String(order.installation_type || "").toLowerCase();
  const hasSelectedTechnicianDate = Boolean(order.appointment_date || appointment?.scheduled_at);
  const isTechnicianInstall =
    apptMethod === "technician" ||
    fulfillmentType === "technician" ||
    fulfillmentType === "installation" ||
    installationType === "technician" ||
    (hasSelectedTechnicianDate && !["self_install", "auto", "ship", "shipping"].includes(fulfillmentType));
  const isSelfInstall =
    !isTechnicianInstall && (
      apptMethod === "auto" ||
      fulfillmentType === "self_install" ||
      fulfillmentType === "ship" ||
      fulfillmentType === "shipping" ||
      installationType === "auto"
    );

  // Fulfillment rules — canonical signals override inference:
  //  • technician install (canonical) → technician panel only
  //  • self_install (canonical)       → confirmation only, no panels
  //  • otherwise fall back to service composition
  const requiresTechnician = isTechnicianInstall;
  const requiresShipping = !isSelfInstall && !isTechnicianInstall && (hasMobile || (!hasInternet && !hasTv));

  // Phase 3 — Auto-install gate: for self-install orders we require the
  // agent to confirm network / wiring / service availability before the
  // shipping panel unlocks. Detection = latest note tagged NETWORK_CONFIRMED.
  const { data: networkConfirmed } = useQuery({
    queryKey: ["network-confirmed-flag", order.id],
    enabled: !!order.id && isSelfInstall,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_internal_notes")
        .select("id")
        .eq("order_id", order.id)
        .like("content", "[NETWORK_CONFIRMED]%")
        .limit(1)
        .maybeSingle();
      return !!data;
    },
  });

  const showTechnicianPanel =
    !isSelfInstall && (requiresTechnician || !!appointment);
  const showShippingPanel =
    // Non-self-install: existing rules
    (!isSelfInstall && !isTechnicianInstall && (requiresShipping || !!order.tracking_number || !!order.carrier || fulfillmentType === "shipping"))
    // Self-install: shipping panel appears ONLY after network confirmation
    || (isSelfInstall && !!networkConfirmed);

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

  const selectedTechnician = technicians.find((t) =>
    t.id === techFields.technician_id || t.full_name.toLowerCase() === techFields.technician_id.trim().toLowerCase()
  );

  useEffect(() => {
    if (!techFields.technician_id || technicians.length === 0) return;
    const tech = technicians.find((t) => t.id === techFields.technician_id);
    if (tech) setTechFields((prev) => ({ ...prev, technician_id: tech.full_name }));
  }, [technicians, techFields.technician_id]);

  const isContractGateError = (err: any) => String(err?.message || "").startsWith("CONTRACT_NOT_SIGNED");

  const registerTracker = async () => {
    const carrier = shippingFields.carrier || order.carrier;
    const tracking_number = shippingFields.tracking_number || order.tracking_number;
    if (!carrier || !tracking_number) return;
    try {
      const { error } = await supabase.functions.invoke("shipping-register-tracker", {
        body: {
          order_id: order.id,
          carrier,
          tracking_number,
          tracking_url: shippingFields.tracking_url || order.tracking_url || null,
        },
      });
      if (error) throw error;
    } catch (e: any) {
      console.error("[shipping-register-tracker] failed:", e);
      toast.error("Suivi non enregistré auprès du transporteur (les mises à jour automatiques peuvent ne pas fonctionner)");
    }
  };

  const handleSaveShipping = async () => {
    setLoading("save");
    try {
      await proc.updateShipping({ ...shippingFields, shipped_at: new Date().toISOString() });
      await registerTracker();
    }
    finally { setLoading(null); }
  };

  const handleMarkShipped = async () => {
    setLoading("shipped");
    try {
      await proc.updateShipping({ ...shippingFields, shipped_at: new Date().toISOString() });
      await proc.changeStatus("shipped");
      await registerTracker();
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
      await registerTracker();
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

  const handleDeliverySlip = () => {
    try {
      const equipmentItems = Array.isArray(order.equipment_details)
        ? (order.equipment_details as any[]).map((item: any) => ({
            description: item.label || item.name || item.type || "Équipement",
            serial_number: item.serial_number || undefined,
            quantity: Math.max(1, Number(item.quantity || item.qty || 1)),
          }))
        : (Array.isArray(items) ? items : []).map((it: any) => ({
            description: it.product_name || it.name || it.description || "Équipement",
            serial_number: it.serial_number || undefined,
            quantity: Math.max(1, Number(it.quantity || 1)),
          }));

      const result = generateDeliverySlipPDF({
        slip_number: `BL-${order.order_number || String(order.id || "").slice(0, 8)}`,
        issue_date: order.shipped_at || order.created_at || new Date().toISOString(),
        client_name: [order.client_first_name, order.client_last_name].filter(Boolean).join(" ") || "Client Nivra",
        client_email: order.client_email || "",
        client_phone: order.client_phone || "",
        account_number: order.account_number || "",
        delivery_address: order.shipping_address || order.client_full_address || "",
        delivery_city: order.shipping_city || "",
        delivery_province: order.shipping_province || "QC",
        delivery_postal: order.shipping_postal_code || "",
        order_number: String(order.order_number || ""),
        carrier: shippingFields.carrier || order.carrier || "En préparation",
        tracking_number: shippingFields.tracking_number || order.tracking_number || "—",
        items: equipmentItems.length ? equipmentItems : [{ description: "Équipement à expédier", quantity: 1 }],
      });
      if (!result.success || !result.blob) { toast.error("Bordereau non disponible"); return; }
      const url = URL.createObjectURL(result.blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la génération du bon de livraison");
    }
  };

  const handleConfirmAppointment = async () => {
    setLoading("confirm-apt");
    try {
      if (!appointment?.id) {
        toast.error("Aucun rendez-vous à confirmer");
        return;
      }
      if (!appointment?.technician_id && !techFields.technician_id) {
        toast.error("Assignez un technicien avant de confirmer le rendez-vous");
        return;
      }
      let technicianId = appointment.technician_id || "";
      if (techFields.technician_id.trim()) {
        const resolved = await resolveTechnicianInput(techFields.technician_id);
        if (!resolved.technician) {
          toast.error(resolved.error || "Technicien introuvable");
          return;
        }
        technicianId = resolved.technician.id;
      }
      const { error } = await supabase
        .from("appointments")
        .update({
          status: "confirmed",
          technician_id: technicianId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointment.id);
      if (error) throw error;
      toast.success("Rendez-vous confirmé");
      await queryClient.invalidateQueries({ queryKey: ["order-processing"] });
    } finally { setLoading(null); }
  };

  const handleAssignTechnician = async () => {
    if (!techFields.technician_id) { toast.error("Veuillez entrer le nom du technicien"); return; }
    setLoading("tech");
    try {
      const resolved = await resolveTechnicianInput(techFields.technician_id);
      if (!resolved.technician) {
        toast.error(resolved.error || "Technicien introuvable");
        return;
      }
      const technician = resolved.technician;
      // 1. Update order with technician
      await proc.assignTechnician(technician.id);

      // 2. Ensure an appointment row exists / is updated with technician + slot
      const scheduledAt = appointment?.scheduled_at || newSlotIso || null;
      if (appointment?.id) {
        const { error: aptErr } = await supabase
          .from("appointments")
          .update({
            technician_id: technician.id,
            scheduled_at: scheduledAt || appointment.scheduled_at,
            updated_at: new Date().toISOString(),
          })
          .eq("id", appointment.id);
        if (aptErr) console.warn("[Technician][assign] appointment update:", aptErr.message);
      } else if (scheduledAt) {
        // No appointment yet — create one
        const { error: insErr } = await supabase.from("appointments").insert({
          order_id: order.id,
          client_id: order.user_id,
          technician_id: technician.id,
          scheduled_at: scheduledAt,
          title: "Installation",
          service_address: order.service_address || order.client_full_address || "",
          service_city: order.service_city || "",
          service_postal_code: order.service_postal_code || "",
          status: "hold",
          environment: "live",
        } as any);
        if (insErr) console.warn("[Technician][assign] appointment insert:", insErr.message);
      }

      // 3. Notes
      if (techFields.installNotes) await proc.addNote(`[Installation] ${techFields.installNotes}`);

      // 4. Confirmation toast with technician name + slot
      const when = scheduledAt ? new Date(scheduledAt).toLocaleString("fr-CA") : "(à planifier)";
      toast.success(`${technician.full_name} assigné — ${when}`);

      await queryClient.invalidateQueries({ queryKey: ["order-processing"] });
    } finally { setLoading(null); }
  };

  const handleMarkEnRoute = async () => {
    setLoading("enroute");
    try {
      await proc.changeStatus("technician_en_route");
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

      <InstallationTypeAndForcedSlotPanel proc={proc} />


      {isSelfInstall && (
        <>
          <div className="bg-emerald-950/40 border border-emerald-700/50 rounded-xl p-4 mb-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-200">Auto-installation par le client</p>
              <p className="text-xs text-emerald-300/80 mt-1">
                Le client a choisi l'auto-installation. Avant d'expédier, confirme que le réseau et le câblage sont fonctionnels à l'adresse.
              </p>
            </div>
          </div>
          <AutoInstallNetworkGate
            orderId={order.id}
            serviceAddress={order.shipping_address || order.client_full_address}
            onConfirmed={() => queryClient.invalidateQueries({ queryKey: ["network-confirmed-flag", order.id] })}
          />
        </>
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
              <Label className={labelClass}>Nom du technicien</Label>
              <Input
                value={techFields.technician_id}
                onChange={(e) => setTechFields({ ...techFields, technician_id: e.target.value })}
                placeholder={techLoading ? "Chargement…" : technicians.length === 0 ? "Aucun technicien actif" : "Ex : Jean Tremblay"}
                list="core-active-technicians"
                disabled={techLoading}
                className={inputClass}
              />
              <datalist id="core-active-technicians">
                {technicians.map((t) => <option key={t.id} value={t.full_name} />)}
              </datalist>
              {selectedTechnician && (<p className="text-[10px] text-slate-500 mt-1">Technicien sélectionné : {selectedTechnician.full_name}</p>)}
              <p className="text-[10px] text-slate-500 mt-0.5">Écris le nom complet ou choisis une suggestion — {technicians.length} technicien(s) actif(s)</p>
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

            {/* Phase 4 — Live Ship24 tracking timeline */}
            <LiveTrackingTimeline
              orderId={order.id}
              initialStatus={order.tracking_status}
              initialCarrier={order.carrier}
              initialTrackingNumber={order.tracking_number}
              initialTrackingUrl={order.tracking_url}
              initialLastUpdate={order.tracking_last_update_at}
            />


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
              <Button size="sm" onClick={handleDeliverySlip} className="text-sm bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800">
                <FileText className="w-3 h-3 mr-1" /> Bon de livraison
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
