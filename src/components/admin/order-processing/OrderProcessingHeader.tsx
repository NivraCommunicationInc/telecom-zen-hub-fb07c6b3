/**
 * OrderProcessingHeader — Top bar with order info + action buttons
 * White background, high contrast black text
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Bell, StickyNote, CheckCircle2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { notifyAdmin } from "@/hooks/useAdminNotification";

const ORDER_STATUSES = [
  { value: "pending", label: "En attente" },
  { value: "validated", label: "Validé" },
  { value: "fraud", label: "Fraude" },
  { value: "shipped", label: "Expédié" },
  { value: "installation_scheduled", label: "Installation planifiée" },
  { value: "installed", label: "Installé" },
  { value: "activated", label: "Activé" },
  { value: "suspended", label: "Suspendu" },
  { value: "invalid_payment", label: "Paiement invalide" },
  { value: "incomplete", label: "Incomplet" },
  { value: "completed", label: "Complété" },
  { value: "cancelled", label: "Annulé" },
];

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  pre_authorized: "Pré-autorisé",
  authorized: "Autorisé",
  captured: "Capturé",
  confirmed: "Confirmé",
  paid: "Payé",
  refunded: "Remboursé",
  failed: "Échoué",
  not_renewed: "Non renouvelé",
};

const KYC_LABELS: Record<string, string> = {
  none: "Non requis",
  skip: "Non requis",
  pending: "En attente",
  submitted: "Soumis",
  in_review: "En revue",
  approved: "Approuvé",
  rejected: "Rejeté",
};

function StatusDot({ color }: { color: string }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function paymentColor(s: string) {
  if (["paid", "captured", "confirmed"].includes(s)) return "bg-emerald-500";
  if (["failed", "refunded"].includes(s)) return "bg-red-500";
  return "bg-amber-500";
}

function kycColor(s: string) {
  if (s === "approved") return "bg-emerald-500";
  if (s === "rejected") return "bg-red-500";
  if (["none", "skip"].includes(s)) return "bg-gray-400";
  return "bg-amber-500";
}

interface Props {
  proc: any;
}

export function OrderProcessingHeader({ proc }: Props) {
  const { order, profile } = proc;
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(order.status);
  const [noteText, setNoteText] = useState("");

  const clientName = profile?.full_name
    || [order.client_first_name, order.client_last_name].filter(Boolean).join(" ")
    || "—";

  const handleChangeStatus = async () => {
    await proc.changeStatus(selectedStatus);
    setStatusDialogOpen(false);
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await proc.addNote(noteText.trim());
    setNoteText("");
    setNoteDialogOpen(false);
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {/* Top row: order info badges */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="text-lg font-bold text-gray-900">
            {order.order_number || `#${order.id.slice(0, 8)}`}
          </h2>
          <Badge variant="outline" className="text-xs font-medium text-gray-700 border-gray-300">
            {order.service_type || order.order_type || "Service"}
          </Badge>
          <Badge variant="outline" className="text-xs font-medium text-gray-700 border-gray-300">
            {order.fulfillment_type || "Non assigné"}
          </Badge>
        </div>

        {/* Info row */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700 mb-3">
          <div>
            <span className="text-gray-500">Client:</span>{" "}
            <span className="font-medium text-gray-900">{clientName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Paiement:</span>
            <StatusDot color={paymentColor(order.payment_status || "pending")} />
            <span className="font-medium">{PAYMENT_STATUS_LABELS[order.payment_status || "pending"] || order.payment_status}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">KYC:</span>
            <StatusDot color={kycColor(order.id_verification_status || order.kyc_policy || "none")} />
            <span className="font-medium">{KYC_LABELS[order.id_verification_status || order.kyc_policy || "none"] || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500">Statut:</span>{" "}
            <span className="font-semibold text-gray-900">{ORDER_STATUSES.find(s => s.value === order.status)?.label || order.status}</span>
          </div>
          <div>
            <span className="text-gray-500">Créée:</span>{" "}
            <span>{format(new Date(order.created_at), "d MMM yyyy HH:mm", { locale: fr })}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setStatusDialogOpen(true)} className="text-xs h-8 border-gray-300 text-gray-700 hover:bg-gray-50">
            <ChevronDown className="w-3.5 h-3.5 mr-1" /> Changer statut
          </Button>
          <Button size="sm" variant="outline" onClick={() => setNoteDialogOpen(true)} className="text-xs h-8 border-gray-300 text-gray-700 hover:bg-gray-50">
            <StickyNote className="w-3.5 h-3.5 mr-1" /> Ajouter note
          </Button>
          <Button size="sm" variant="outline" onClick={() => proc.refetch()} className="text-xs h-8 border-gray-300 text-gray-700 hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualiser
          </Button>
          <Button
            size="sm"
            onClick={() => proc.completeOrder()}
            disabled={proc.isUpdating || order.status === "completed"}
            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Compléter
          </Button>
        </div>
      </div>

      {/* Status change dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Changer le statut</DialogTitle>
          </DialogHeader>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="border-gray-300 text-gray-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)} className="text-gray-700 border-gray-300">Annuler</Button>
            <Button onClick={handleChangeStatus} disabled={proc.isUpdating} className="bg-gray-900 text-white hover:bg-gray-800">Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Ajouter une note interne</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Écrire une note…"
            className="min-h-[100px] border-gray-300 text-gray-900"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)} className="text-gray-700 border-gray-300">Annuler</Button>
            <Button onClick={handleAddNote} disabled={!noteText.trim() || proc.isUpdating} className="bg-gray-900 text-white hover:bg-gray-800">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
