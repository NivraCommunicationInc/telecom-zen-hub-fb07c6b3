/**
 * ShippingTechnicianStep — Step 9: Shipping or Technician assignment
 * All buttons are fully functional with real DB operations and notifications.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Truck, Wrench, Bell, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resolveTechnicianInput } from "@/core-app/lib/technicians";

interface Props { proc: any; }

export function ShippingTechnicianStep({ proc }: Props) {
  const { order, appointment, installationEstimate } = proc;
  const fulfillmentType = order.fulfillment_type || "shipping";
  const isShipping = fulfillmentType === "shipping" || fulfillmentType === "self_install";
  const [loading, setLoading] = useState<string | null>(null);

  const [shippingFields, setShippingFields] = useState({
    carrier: order.carrier || "",
    tracking_number: order.tracking_number || "",
    tracking_url: order.tracking_url || "",
  });

  const [techFields, setTechFields] = useState({
    technician_id: order.technician_id || "",
    installNotes: "",
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
    } finally {
      setLoading(null);
    }
  };

  const handleNotifyClient = async () => {
    setLoading("notify");
    try {
      if (isShipping) {
        await proc.sendClientNotification(
          "shipment_created",
          "Votre commande a été expédiée — Nivra",
          {
            carrier: shippingFields.carrier || order.carrier || "",
            tracking_number: shippingFields.tracking_number || order.tracking_number || "",
            tracking_url: shippingFields.tracking_url || order.tracking_url || "",
          }
        );
      } else {
        await proc.sendClientNotification(
          "appointment_confirmed",
          "Rendez-vous d'installation confirmé — Nivra",
          {
            appointment_date: appointment?.scheduled_at || "",
            service_address: appointment?.service_address || "",
          }
        );
      }
    } finally {
      setLoading(null);
    }
  };

  const handleAssignTechnician = async () => {
    if (!techFields.technician_id) {
      toast.error("Veuillez entrer le nom du technicien");
      return;
    }
    setLoading("tech");
    try {
      const resolved = await resolveTechnicianInput(techFields.technician_id);
      if (!resolved.technician) { toast.error(resolved.error || "Technicien introuvable"); return; }
      await proc.assignTechnician(resolved.technician.id);
      if (techFields.installNotes) {
        await proc.addNote(`[Installation] ${techFields.installNotes}`);
      }
    } finally {
      setLoading(null);
    }
  };

  const handleInstallComplete = async () => {
    setLoading("install");
    try {
      await proc.changeStatus("installed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">
        {isShipping ? "Expédition" : "Technicien & Installation"}
      </h3>

      {isShipping ? (
        <>
          {order.shipped_at && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 mb-4">
              <p className="text-sm text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Expédié le {order.shipped_at.slice(0, 10)}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

          <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 mb-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Adresse de livraison</h4>
            <p className="text-sm text-gray-900">
              {[order.shipping_address, order.shipping_city, order.shipping_province, order.shipping_postal_code]
                .filter(Boolean).join(", ") || order.client_full_address || "Non spécifiée"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
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
            <Button size="sm" variant="outline" onClick={handleNotifyClient} disabled={loading === "notify"} className="text-xs h-8 border-gray-300 text-gray-700">
              {loading === "notify" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Bell className="w-3 h-3 mr-1" />}
              Notifier le client
            </Button>
          </div>
        </>
      ) : (
        <>
          {appointment && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
              <h4 className="text-xs font-semibold text-blue-700 uppercase mb-1">Rendez-vous planifié</h4>
              <p className="text-sm text-blue-900">{appointment.scheduled_at?.slice(0, 16).replace("T", " ")}</p>
              <p className="text-xs text-blue-700 mt-0.5">{appointment.service_address || "—"}</p>
            </div>
          )}

          {/* Installation time estimate */}
          {installationEstimate && (
            <div className={`border rounded-lg p-3 mb-4 ${installationEstimate.wiringNeeded ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Durée d'installation estimée</h4>
              <p className={`text-sm font-medium ${installationEstimate.wiringNeeded ? "text-amber-800" : "text-gray-900"}`}>
                {installationEstimate.label}
              </p>
              {installationEstimate.wiringNeeded && (
                <p className="text-xs text-amber-600 mt-1">⚠ Prévoir du matériel de câblage supplémentaire</p>
              )}
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span>Internet câblé: ~30 min</span>
                <span>TV câblée: ~45 min</span>
                <span>Sans fil existant: 2h+</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 mb-4">
            <div>
              <Label className="text-xs text-gray-500">Nom du technicien</Label>
              <Input value={techFields.technician_id} onChange={(e) => setTechFields({ ...techFields, technician_id: e.target.value })} placeholder="Ex : Jean Tremblay" className="h-9 text-sm border-gray-300 text-gray-900" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Notes d'installation</Label>
              <Textarea value={techFields.installNotes} onChange={(e) => setTechFields({ ...techFields, installNotes: e.target.value })} placeholder="Instructions…" className="min-h-[60px] text-sm border-gray-300 text-gray-900" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
            <Button size="sm" onClick={handleAssignTechnician} disabled={loading === "tech" || proc.isUpdating} className="text-xs h-8 bg-gray-900 text-white hover:bg-gray-800">
              {loading === "tech" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wrench className="w-3 h-3 mr-1" />}
              Assigner technicien
            </Button>
            <Button size="sm" onClick={handleInstallComplete} disabled={loading === "install" || proc.isUpdating} className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading === "install" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
              Installation complétée
            </Button>
            <Button size="sm" variant="outline" onClick={handleNotifyClient} disabled={loading === "notify"} className="text-xs h-8 border-gray-300 text-gray-700">
              {loading === "notify" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Bell className="w-3 h-3 mr-1" />}
              Notifier le client
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
