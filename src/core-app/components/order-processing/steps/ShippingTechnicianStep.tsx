/**
 * ShippingTechnicianStep — Step: Shipping AND/OR Technician workflow
 * Shows BOTH sections when order has an appointment (technician) AND shipping details.
 * Full technician lifecycle: confirmation → assignment → tracking → completion.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Truck, Wrench, Bell, CheckCircle2, Loader2, Calendar, MapPin, Clock, User, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props { proc: any; }

export function ShippingTechnicianStep({ proc }: Props) {
  const { order, appointment, installationEstimate } = proc;
  const fulfillmentType = order.fulfillment_type || "shipping";
  const hasShipping = fulfillmentType === "shipping" || fulfillmentType === "self_install" || order.tracking_number || order.carrier;
  const hasAppointment = !!appointment;
  // Show both panels when appointment exists (technician required) alongside shipping
  const showTechnicianPanel = hasAppointment || fulfillmentType === "technician" || fulfillmentType === "installation";
  const showShippingPanel = hasShipping || !showTechnicianPanel;

  const [loading, setLoading] = useState<string | null>(null);

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

  const handleSaveShipping = async () => {
    setLoading("save");
    try {
      await proc.updateShipping({
        ...shippingFields,
        shipped_at: new Date().toISOString(),
      });
    } finally {
      setLoading(null);
    }
  };

  const handleMarkShipped = async () => {
    setLoading("shipped");
    try {
      await proc.updateShipping({
        ...shippingFields,
        shipped_at: new Date().toISOString(),
      });
      await proc.changeStatus("shipped");
    } finally {
      setLoading(null);
    }
  };

  const handleMarkDelivered = async () => {
    setLoading("delivered");
    try {
      await proc.changeStatus("delivered");
      // P4: Notify client on delivery
      await proc.sendClientNotification(
        "order_completed",
        "Votre commande a été livrée — Nivra",
        {
          carrier: shippingFields.carrier || order.carrier || "",
          tracking_number: shippingFields.tracking_number || order.tracking_number || "",
        }
      );
    } finally {
      setLoading(null);
    }
  };

  const handleNotifyShipping = async () => {
    setLoading("notify-ship");
    try {
      await proc.sendClientNotification(
        "shipment_created",
        "Votre commande a été expédiée — Nivra",
        {
          carrier: shippingFields.carrier || order.carrier || "",
          tracking_number: shippingFields.tracking_number || order.tracking_number || "",
          tracking_url: shippingFields.tracking_url || order.tracking_url || "",
        }
      );
    } finally {
      setLoading(null);
    }
  };

  const handleConfirmAppointment = async () => {
    setLoading("confirm-apt");
    try {
      await proc.sendClientNotification(
        "appointment_confirmed",
        "Rendez-vous d'installation confirmé — Nivra",
        {
          appointment_date: appointment?.scheduled_at || "",
          service_address: appointment?.service_address || "",
        }
      );
      toast.success("Confirmation de rendez-vous envoyée");
    } finally {
      setLoading(null);
    }
  };

  const handleAssignTechnician = async () => {
    if (!techFields.technician_id) {
      toast.error("Veuillez entrer l'ID du technicien");
      return;
    }
    setLoading("tech");
    try {
      await proc.assignTechnician(techFields.technician_id);
      if (techFields.installNotes) {
        await proc.addNote(`[Installation] ${techFields.installNotes}`);
      }
    } finally {
      setLoading(null);
    }
  };

  const handleMarkEnRoute = async () => {
    setLoading("enroute");
    try {
      await proc.changeStatus("technician_en_route");
      await proc.sendClientNotification(
        "technician_en_route",
        "Votre technicien est en route — Nivra",
        { appointment_date: appointment?.scheduled_at || "", service_address: appointment?.service_address || "" }
      );
    } finally {
      setLoading(null);
    }
  };

  const handleInstallComplete = async () => {
    setLoading("install");
    try {
      if (techFields.completionNotes) {
        await proc.addNote(`[Installation terminée] ${techFields.completionNotes}`);
      }
      await proc.changeStatus("installation_completed");
      // P3: Explicit installation completed notification
      await proc.sendClientNotification(
        "installation_completed",
        "Votre installation est terminée — Nivra",
        { appointment_date: appointment?.scheduled_at || "", service_address: appointment?.service_address || "" }
      );
    } finally {
      setLoading(null);
    }
  };

  const handleInstallFailed = async () => {
    setLoading("install-fail");
    try {
      if (techFields.completionNotes) {
        await proc.addNote(`[Installation échouée] ${techFields.completionNotes}`);
      }
      await proc.changeStatus("installation_failed");
      toast.warning("Installation marquée comme échouée");
    } finally {
      setLoading(null);
    }
  };

  const fmtDateTime = (d: string | null | undefined) => {
    if (!d) return "—";
    try { return format(new Date(d), "d MMM yyyy HH:mm", { locale: fr }); } catch { return "—"; }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-base font-bold text-gray-900">
        {showTechnicianPanel && showShippingPanel ? "Technicien & Expédition" : showTechnicianPanel ? "Technicien & Installation" : "Expédition"}
      </h3>

      {/* ═══ TECHNICIAN / INSTALLATION WORKFLOW ═══ */}
      {showTechnicianPanel && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-4">
          <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> Workflow d'installation
          </h4>

          {/* Appointment Summary */}
          {appointment && (
            <div className="bg-white rounded-lg border border-blue-100 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-900">Rendez-vous</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  appointment.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                  appointment.status === "confirmed" ? "bg-blue-100 text-blue-700" :
                  appointment.status === "cancelled" ? "bg-red-100 text-red-700" :
                  "bg-amber-100 text-amber-700"
                }`}>
                  {appointment.status || "planifié"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-blue-800">
                  <Calendar className="h-3 w-3 text-blue-500" />
                  {fmtDateTime(appointment.scheduled_at)}
                </div>
                <div className="flex items-center gap-1.5 text-blue-800">
                  <MapPin className="h-3 w-3 text-blue-500" />
                  {appointment.service_address || "—"}
                </div>
                {appointment.appointment_number && (
                  <div className="flex items-center gap-1.5 text-blue-800">
                    <ClipboardCheck className="h-3 w-3 text-blue-500" />
                    N° {appointment.appointment_number}
                  </div>
                )}
                {appointment.installation_method && (
                  <div className="flex items-center gap-1.5 text-blue-800">
                    <Wrench className="h-3 w-3 text-blue-500" />
                    {appointment.installation_method}
                  </div>
                )}
              </div>
              {appointment.technician_id && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                  <User className="h-3 w-3" />
                  Technicien assigné: <span className="font-mono">{appointment.technician_id.slice(0, 8)}</span>
                </div>
              )}
            </div>
          )}

          {/* Installation time estimate */}
          {installationEstimate && (
            <div className={`rounded-lg border p-3 ${installationEstimate.wiringNeeded ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3 w-3 text-gray-500" />
                <span className="text-xs font-semibold text-gray-700">Durée estimée</span>
              </div>
              <p className={`text-sm font-medium ${installationEstimate.wiringNeeded ? "text-amber-800" : "text-gray-900"}`}>
                {installationEstimate.label}
              </p>
              {installationEstimate.wiringNeeded && (
                <p className="text-xs text-amber-600 mt-1">⚠ Prévoir du matériel de câblage supplémentaire</p>
              )}
            </div>
          )}

          {/* Technician Assignment */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label className="text-xs text-gray-500">ID Technicien</Label>
              <Input value={techFields.technician_id} onChange={(e) => setTechFields({ ...techFields, technician_id: e.target.value })} placeholder="UUID du technicien" className="h-9 text-sm border-gray-300 text-gray-900 font-mono" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Notes d'installation</Label>
              <Textarea value={techFields.installNotes} onChange={(e) => setTechFields({ ...techFields, installNotes: e.target.value })} placeholder="Instructions pour le technicien…" className="min-h-[50px] text-sm border-gray-300 text-gray-900" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Notes de complétion / fermeture</Label>
              <Textarea value={techFields.completionNotes} onChange={(e) => setTechFields({ ...techFields, completionNotes: e.target.value })} placeholder="Observations de l'installation…" className="min-h-[50px] text-sm border-gray-300 text-gray-900" />
            </div>
          </div>

          {/* Technician Actions */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-blue-200">
            <Button size="sm" onClick={handleConfirmAppointment} disabled={loading === "confirm-apt"} className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white">
              {loading === "confirm-apt" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Bell className="w-3 h-3 mr-1" />}
              Confirmer RV au client
            </Button>
            <Button size="sm" onClick={handleAssignTechnician} disabled={loading === "tech" || proc.isUpdating} className="text-xs h-8 bg-gray-900 text-white hover:bg-gray-800">
              {loading === "tech" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wrench className="w-3 h-3 mr-1" />}
              Assigner technicien
            </Button>
            <Button size="sm" onClick={handleMarkEnRoute} disabled={loading === "enroute" || proc.isUpdating} variant="outline" className="text-xs h-8 border-blue-300 text-blue-700 hover:bg-blue-50">
              {loading === "enroute" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Truck className="w-3 h-3 mr-1" />}
              En route
            </Button>
            <Button size="sm" onClick={handleInstallComplete} disabled={loading === "install" || proc.isUpdating} className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading === "install" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
              Installation complétée
            </Button>
            <Button size="sm" onClick={handleInstallFailed} disabled={loading === "install-fail" || proc.isUpdating} variant="outline" className="text-xs h-8 border-red-300 text-red-700 hover:bg-red-50">
              {loading === "install-fail" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Échec installation
            </Button>
          </div>
        </div>
      )}

      {/* ═══ SHIPPING WORKFLOW ═══ */}
      {showShippingPanel && (
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" /> Expédition
          </h4>

          {order.shipped_at && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
              <p className="text-sm text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Expédié le {order.shipped_at.slice(0, 10)}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500">Transporteur</Label>
              <Input value={shippingFields.carrier} onChange={(e) => setShippingFields({ ...shippingFields, carrier: e.target.value })} placeholder="Postes Canada, Purolator…" className="h-9 text-sm border-gray-300 text-gray-900" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Numéro de suivi</Label>
              <Input value={shippingFields.tracking_number} onChange={(e) => setShippingFields({ ...shippingFields, tracking_number: e.target.value })} placeholder="Tracking #" className="h-9 text-sm border-gray-300 text-gray-900 font-mono" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-gray-500">Lien de suivi</Label>
              <Input value={shippingFields.tracking_url} onChange={(e) => setShippingFields({ ...shippingFields, tracking_url: e.target.value })} placeholder="https://..." className="h-9 text-sm border-gray-300 text-gray-900" />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-100 p-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Adresse de livraison</h4>
            <p className="text-sm text-gray-900">
              {[order.shipping_address, order.shipping_city, order.shipping_province, order.shipping_postal_code]
                .filter(Boolean).join(", ") || order.client_full_address || "Non spécifiée"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
            <Button size="sm" onClick={handleSaveShipping} disabled={loading === "save" || proc.isUpdating} className="text-xs h-8 bg-gray-900 text-white hover:bg-gray-800">
              {loading === "save" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              Sauvegarder
            </Button>
            <Button size="sm" onClick={handleMarkShipped} disabled={loading === "shipped" || proc.isUpdating || order.status === "shipped"} className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading === "shipped" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Truck className="w-3 h-3 mr-1" />}
              Marquer expédié
            </Button>
            <Button size="sm" onClick={handleMarkDelivered} disabled={loading === "delivered" || proc.isUpdating || order.status === "delivered"} className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white">
              {loading === "delivered" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
              Marquer livré
            </Button>
            <Button size="sm" variant="outline" onClick={handleNotifyShipping} disabled={loading === "notify-ship"} className="text-xs h-8 border-gray-300 text-gray-700">
              {loading === "notify-ship" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Bell className="w-3 h-3 mr-1" />}
              Notifier le client
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
