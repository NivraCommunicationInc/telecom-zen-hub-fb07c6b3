/**
 * WorkbenchHeaderPanel — Order header with status controls, customer identity, quick actions
 * Full-width workspace-first design (no Card wrapper)
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { User, MapPin, Phone, Mail, Calendar, Shield, Copy, ExternalLink, AlertTriangle } from "lucide-react";
import { canPerformAction } from "@/lib/workbenchRoles";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  order: any;
  profile: any;
  role: string | null;
  onStatusChange: (newStatus: string, reason?: string) => Promise<void>;
}

const ORDER_STATUSES = [
  "submitted", "kyc_in_review", "payment_failed", "fulfillment_pending",
  "provisioning_in_progress", "active", "partial_active", "on_hold", "cancelled", "failed", "completed",
];

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  kyc_in_review: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  payment_failed: "bg-red-500/20 text-red-400 border-red-500/30",
  fulfillment_pending: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  provisioning_in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  partial_active: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  on_hold: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const PAY_COLORS: Record<string, string> = {
  paid: "bg-emerald-500/20 text-emerald-400",
  captured: "bg-emerald-500/20 text-emerald-400",
  pre_authorized: "bg-blue-500/20 text-blue-400",
  pending: "bg-amber-500/20 text-amber-400",
  failed: "bg-red-500/20 text-red-400",
};

export function WorkbenchHeaderPanel({ order, profile, role, onStatusChange }: Props) {
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [isChanging, setIsChanging] = useState(false);

  const orderStatus = order?.status || "pending";
  const paymentStatus = order?.payment_status || "pending";
  const createdAt = order?.created_at ? format(new Date(order.created_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—";
  const customerName = profile?.full_name || `${order?.client_first_name || ""} ${order?.client_last_name || ""}`.trim() || order?.client_email || "Client";

  const handleStatusConfirm = async () => {
    if (!pendingStatus) return;
    setIsChanging(true);
    try {
      await onStatusChange(pendingStatus, statusReason || undefined);
      setShowStatusDialog(false);
      setPendingStatus("");
      setStatusReason("");
    } finally {
      setIsChanging(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié");
  };

  return (
    <>
      <div className="border border-border rounded-lg bg-card">
        {/* Top bar: Order number + statuses + actions */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-foreground">#{order?.order_number}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(order?.order_number || "")}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{order?.service_type || "Service"} · {createdAt}</p>
            </div>

            <div className="flex items-center gap-2">
              <Badge className={`${STATUS_COLORS[orderStatus] || STATUS_COLORS.pending} border`}>
                {orderStatus}
              </Badge>
              <Badge className={PAY_COLORS[paymentStatus] || PAY_COLORS.pending}>
                💳 {paymentStatus}
              </Badge>
              {order?.payment_method && (
                <Badge variant="outline" className="text-xs">{order.payment_method}</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canPerformAction(role, "force_status") && (
              <Select
                value=""
                onValueChange={(v) => {
                  setPendingStatus(v);
                  setShowStatusDialog(true);
                }}
              >
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue placeholder="Changer statut…" />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.filter(s => s !== orderStatus).map(s => (
                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {order?.user_id && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" asChild>
                <a href={`/admin/clients`}><ExternalLink className="h-3 w-3" /> Client</a>
              </Button>
            )}
          </div>
        </div>

        {/* Customer info row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Client</p>
              <p className="text-foreground font-medium truncate">{customerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Courriel</p>
              <p className="text-foreground truncate text-xs">{profile?.email || order?.client_email || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Téléphone</p>
              <p className="text-foreground text-xs">{profile?.phone || order?.client_phone || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Adresse</p>
              <p className="text-foreground truncate text-xs">
                {order?.shipping_address || "—"}{order?.shipping_city ? `, ${order.shipping_city}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">KYC</p>
              <Badge variant="outline" className="text-xs">
                {order?.id_verification_status || "pending"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Risk flags */}
        {order?.risk_flags && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-destructive">Flags de risque: {JSON.stringify(order.risk_flags)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Status Change Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le statut</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{orderStatus}</span> → <span className="font-mono font-bold">{pendingStatus}</span>
          </p>
          <Textarea
            placeholder="Raison du changement (recommandé)…"
            value={statusReason}
            onChange={e => setStatusReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>Annuler</Button>
            <Button onClick={handleStatusConfirm} disabled={isChanging}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
