import { format, differenceInHours } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  Wrench,
  Package,
  CreditCard,
  FileText,
  Edit,
  X,
  History,
  Shield,
  Wifi,
  Tv,
  Send,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AppointmentDetailDialogProps {
  appointment: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
  isEmployee?: boolean;
  isTechnician?: boolean;
  isClient?: boolean;
  onReschedule?: () => void;
  onCancel?: () => void;
  onAssignTechnician?: () => void;
  maskCardNumber?: (card: string) => string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_scheduling: { label: "À planifier", color: "bg-amber-500/20 text-amber-500" },
  scheduled: { label: "Planifié", color: "bg-cyan-500/20 text-cyan-500" },
  modified: { label: "Modifié", color: "bg-purple-500/20 text-purple-500" },
  cancelled: { label: "Annulé", color: "bg-red-500/20 text-red-500" },
  completed: { label: "Terminé", color: "bg-emerald-500/20 text-emerald-500" },
  technician_assigned: { label: "Technicien assigné", color: "bg-blue-500/20 text-blue-500" },
  pending_verification: { label: "Vérification en attente", color: "bg-amber-500/20 text-amber-500" },
  pending_payment: { label: "Paiement en attente", color: "bg-orange-500/20 text-orange-500" },
  in_progress: { label: "En cours", color: "bg-indigo-500/20 text-indigo-500" },
};

const SERVICE_TYPE_LABELS: Record<string, { label: string; icon: any }> = {
  internet: { label: "Internet", icon: Wifi },
  tv_internet: { label: "TV + Internet", icon: Tv },
  giga_tv: { label: "GIGA + TV Bundle", icon: Package },
  mobile: { label: "Mobile", icon: Phone },
  streaming: { label: "Streaming", icon: Tv },
  accessories: { label: "Accessoires", icon: Package },
  security: { label: "Sécurité", icon: Shield },
};

export const AppointmentDetailDialog = ({
  appointment,
  open,
  onOpenChange,
  isAdmin = false,
  isEmployee = false,
  isTechnician = false,
  isClient = false,
  onReschedule,
  onCancel,
  onAssignTechnician,
  maskCardNumber,
}: AppointmentDetailDialogProps) => {
  if (!appointment) return null;

  const apt = appointment;
  const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled;
  const hoursUntil = differenceInHours(new Date(apt.scheduled_at), new Date());
  const canModify = hoursUntil >= 24;
  const serviceType = SERVICE_TYPE_LABELS[apt.service_type];
  const ServiceIcon = serviceType?.icon || Wifi;
  const [sendingReminder, setSendingReminder] = useState(false);

  const handleSendReminder = async () => {
    try {
      setSendingReminder(true);
      const { data, error } = await supabase.functions.invoke("send-appointment-reminder", {
        body: { appointmentId: apt.id, force: !!apt.reminder_sent_at },
      });
      if (error) throw error;
      if (data?.alreadySent && !data?.success) {
        toast.info("Rappel déjà envoyé");
      } else if (data?.success) {
        toast.success("Rappel envoyé au client");
      } else {
        toast.error(data?.reason || "Impossible d'envoyer le rappel");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'envoi du rappel");
    } finally {
      setSendingReminder(false);
    }
  };

  const showInternalFields = isAdmin || isEmployee;
  const showFullCard = isAdmin;
  const showLastFour = isEmployee;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <span className="block">{apt.title || "Rendez-vous"}</span>
              <span className="text-xs font-normal text-cyan-400">
                {apt.appointment_number || `#${apt.id?.slice(0, 8).toUpperCase()}`}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Status & Time */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={status.color}>{status.label}</Badge>
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {format(new Date(apt.scheduled_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
              </Badge>
              {!canModify && apt.status !== "completed" && apt.status !== "cancelled" && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs">
                  Moins de 24h - Non modifiable
                </Badge>
              )}
            </div>

            {/* Order Reference */}
            {apt.linkedOrder?.order_number && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Référence commande</p>
                <p className="font-medium text-cyan-400">{apt.linkedOrder.order_number}</p>
              </div>
            )}

            <Separator />

            {/* Client Information */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-cyan-500" />
                Informations client
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>{apt.profiles?.full_name || apt.client_email?.split("@")[0] || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{apt.profiles?.email || apt.client_email || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{apt.client_phone || apt.profiles?.phone || "—"}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <span>
                    {apt.service_address || apt.profiles?.service_address || "—"}
                    {(apt.service_city || apt.profiles?.service_city) && (
                      <>, {apt.service_city || apt.profiles?.service_city}</>
                    )}
                    {apt.service_postal_code && <>, {apt.service_postal_code}</>}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Service Information */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <ServiceIcon className="w-4 h-4 text-cyan-500" />
                Service & Installation
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Type de service</p>
                  <p className="font-medium">{serviceType?.label || apt.service_type || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Méthode d'installation</p>
                  <p className="font-medium">
                    {apt.installation_method === "auto" ? "Auto-installation" : 
                     apt.installation_method === "technician" ? "Technicien Nivra" : "—"}
                  </p>
                </div>
                {apt.delivery_fee > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Frais de livraison</p>
                    <p className="font-medium text-emerald-500">${apt.delivery_fee}</p>
                  </div>
                )}
                {apt.installation_fee > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Frais d'installation</p>
                    <p className="font-medium text-emerald-500">${apt.installation_fee}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Technician Info - Visible to all */}
            {apt.technician && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-blue-500" />
                    Technicien assigné
                  </h4>
                  <div className="bg-blue-500/10 p-3 rounded-lg">
                    <p className="font-medium text-blue-400">{apt.technician.full_name}</p>
                    {showInternalFields && (
                      <>
                        <p className="text-sm text-muted-foreground">{apt.technician.email}</p>
                        {apt.technician.phone && (
                          <p className="text-sm text-muted-foreground">{apt.technician.phone}</p>
                        )}
                        {apt.technician.access_code && (
                          <p className="text-xs text-amber-400 mt-1">Code: {apt.technician.access_code}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Equipment - Admin/Employee Only */}
            {showInternalFields && apt.equipment_details && Array.isArray(apt.equipment_details) && apt.equipment_details.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Package className="w-4 h-4 text-purple-500" />
                    Équipement (Admin privé)
                  </h4>
                  <div className="grid gap-2">
                    {apt.equipment_details.map((eq: any, idx: number) => (
                      <div key={idx} className="bg-muted/50 p-3 rounded-lg text-sm">
                        <p className="font-medium">{eq.name || eq.type}</p>
                        {eq.serial_number && (
                          <p className="text-xs text-muted-foreground">S/N: {eq.serial_number}</p>
                        )}
                        {eq.tracking_number && (
                          <p className="text-xs text-cyan-400">Tracking: {eq.tracking_number}</p>
                        )}
                        {eq.warranty && (
                          <p className="text-xs text-emerald-400">Garantie: {eq.warranty}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Payment Info - Admin/Employee Only */}
            {showInternalFields && apt.linkedOrder?.payment_reference && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                    Paiement (Admin privé)
                  </h4>
                  <div className="bg-muted/50 p-3 rounded-lg text-sm">
                    <p className="text-xs text-muted-foreground">Référence paiement</p>
                    <p className="font-medium text-emerald-400">{apt.linkedOrder.payment_reference}</p>
                  </div>
                </div>
              </>
            )}

            {/* Internal Notes - Admin/Employee Only */}
            {showInternalFields && apt.internal_notes && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-500" />
                    Notes internes (Admin privé)
                  </h4>
                  <div className="bg-amber-500/10 p-3 rounded-lg text-sm whitespace-pre-wrap border border-amber-500/20">
                    {apt.internal_notes}
                  </div>
                </div>
              </>
            )}

            {/* Appointment History */}
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                Historique
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  Créé le {format(new Date(apt.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                </div>
                {apt.updated_at && apt.updated_at !== apt.created_at && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    Modifié le {format(new Date(apt.updated_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                  </div>
                )}
                {apt.status === "cancelled" && apt.cancellation_reason && (
                  <div className="flex items-start gap-2 text-red-400">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1" />
                    <span>Annulé: {apt.cancellation_reason}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Reminder action (Core/Employee only, any time before completion/cancellation) */}
            {(isAdmin || isEmployee) && apt.status !== "completed" && apt.status !== "cancelled" && apt.scheduled_at && (
              <>
                <Separator />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-600"
                    onClick={handleSendReminder}
                    disabled={sendingReminder}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {sendingReminder ? "Envoi..." : apt.reminder_sent_at ? "Renvoyer le rappel" : "Envoyer un rappel"}
                  </Button>
                  {apt.reminder_sent_at && (
                    <span className="text-xs text-muted-foreground">
                      Dernier rappel: {format(new Date(apt.reminder_sent_at), "d MMM HH:mm", { locale: fr })}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    Rappel automatique envoyé 30 min avant l'arrivée
                  </span>
                </div>
              </>
            )}

            {/* Actions */}
            {(canModify || isAdmin) && apt.status !== "completed" && apt.status !== "cancelled" && (
              <>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  {(isAdmin || isEmployee || (isClient && canModify)) && onReschedule && (
                    <Button variant="outline" size="sm" onClick={onReschedule}>
                      <Edit className="w-4 h-4 mr-2" />
                      Reprogrammer
                    </Button>
                  )}
                  {isAdmin && !apt.technician_id && onAssignTechnician && (
                    <Button variant="outline" size="sm" className="text-blue-500" onClick={onAssignTechnician}>
                      <Wrench className="w-4 h-4 mr-2" />
                      Assigner technicien
                    </Button>
                  )}
                  {(isAdmin || isEmployee || (isClient && canModify)) && onCancel && (
                    <Button variant="outline" size="sm" className="text-red-500" onClick={onCancel}>
                      <X className="w-4 h-4 mr-2" />
                      Annuler
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
