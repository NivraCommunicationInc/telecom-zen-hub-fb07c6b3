/**
 * AccountProfileHeader — CRM-grade account header with summary + quick actions (ALL OPERATIONAL)
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AccountProfileEditDialog } from "./AccountProfileEditDialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2, MapPin, Calendar, Shield, CreditCard, Star,
  StickyNote, Ban, PlusCircle, Package, Headphones, Mail,
  ArrowLeft, RefreshCw, AlertTriangle, UserPen,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { adminClient as supabase } from "@/integrations/backend";
import { callSupportAction } from "@/shared-ops/lib/callSupportAction";
import { toast } from "sonner";

import { enqueueCommunication } from "@/lib/enqueueCommunication";
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Actif", variant: "default" },
  suspended: { label: "Suspendu", variant: "secondary" },
  closed: { label: "Fermé", variant: "destructive" },
  pending: { label: "En attente", variant: "outline" },
};

const creditLabels: Record<string, { label: string; className: string }> = {
  A: { label: "Excellent", className: "bg-green-500" },
  B: { label: "Bon", className: "bg-blue-500" },
  C: { label: "Moyen", className: "bg-yellow-500" },
  D: { label: "Mauvais", className: "bg-red-500" },
};

interface AccountProfileHeaderProps {
  account: any;
  profile: any;
  invoices: any[];
  payments: any[];
  subscriptions: any[];
  tickets: any[];
  onRefresh: () => void;
}

export function AccountProfileHeader({
  account, profile, invoices, payments, subscriptions, tickets, onRefresh,
}: AccountProfileHeaderProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteType, setNoteType] = useState("internal");
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketPriority, setTicketPriority] = useState("normal");
  const [commOpen, setCommOpen] = useState(false);
  const [commSubject, setCommSubject] = useState("");
  const [commBody, setCommBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (!account) return null;

  const clientId = account.client_id;
  const statusInfo = statusConfig[account.status] || statusConfig.active;
  const creditInfo = creditLabels[account.credit_class] || null;
  const customerSince = account.created_at
    ? format(new Date(account.created_at), "d MMMM yyyy", { locale: fr })
    : "—";

  const totalBalance = invoices.reduce((sum: number, inv: any) => sum + (inv.balance_due || 0), 0);
  const lastPayment = payments.length > 0 ? payments[0] : null;
  const activeServices = subscriptions.filter((s: any) => s.status === "active").length;
  const openTickets = tickets.filter((t: any) => !["resolved", "closed"].includes(t.status)).length;

  const handleAddNote = async () => {
    if (!noteBody.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("client_internal_notes").insert({
        client_id: clientId,
        body: noteBody.trim(),
        note_type: noteType,
        created_by_user_id: user?.id || "",
        created_by_role: "admin",
        created_by_name: user?.email || "Admin",
      });
      if (error) throw error;
      toast.success("Note ajoutée");
      setNoteBody("");
      setNoteOpen(false);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async () => {
    setSaving(true);
    try {
      const newStatus = account.status === "suspended" ? "active" : "suspended";
      const { error } = await supabase.from("accounts").update({ status: newStatus }).eq("id", account.id);
      if (error) throw error;
      // Log activity
      await supabase.from("client_activity_logs").insert({
        client_id: clientId,
        actor_user_id: user?.id || "",
        actor_role: "admin",
        actor_name: user?.email || "Admin",
        action_type: newStatus === "suspended" ? "account_suspended" : "account_reactivated",
        summary: newStatus === "suspended" 
          ? `Compte suspendu. Raison: ${suspendReason || "Non spécifiée"}`
          : "Compte réactivé",
      });
      toast.success(newStatus === "suspended" ? "Compte suspendu" : "Compte réactivé");
      setSuspendOpen(false);
      setSuspendReason("");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!ticketSubject.trim()) return;
    setSaving(true);
    try {
      const res = await callSupportAction("create_ticket", {
        owner_user_id: account?.owner_user_id ?? profile?.user_id ?? null,
        account_id: account?.id ?? null,
        client_email: profile?.email ?? null,
        client_name: profile?.full_name ?? null,
        subject: ticketSubject.trim(),
        description: ticketDesc.trim() || null,
        priority: ticketPriority,
        source: "core",
        idempotency_key: `core-header-${clientId}-${Date.now()}`,
      });
      toast.success(`Ticket ${res.ticket_number ?? ""} créé`);
      setTicketSubject("");
      setTicketDesc("");
      setTicketOpen(false);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleSendComm = async () => {
    if (!commSubject.trim() || !commBody.trim()) return;
    if (!profile?.email) {
      toast.error("Aucun email client disponible");
      return;
    }
    setSaving(true);
    try {
      let error: any = null;
      try { await enqueueCommunication({
        channel: "email",
        templateKey: "admin_manual_communication",
        recipient: profile.email,
        idempotencyKey: `manual-comm:${profile.user_id ?? profile.email}:${commSubject.trim().slice(0, 40)}:${commBody.trim().length}`,
        subject: commSubject.trim(),
        bodyHtml: `<p>${commBody.trim().replace(/\n/g, "<br/>")}</p>`,
        toName: profile.full_name || "",
      }); } catch (__e) { error = __e; }
      if (error) throw error;
      toast.success("Communication ajoutée à la file d'envoi");
      setCommSubject("");
      setCommBody("");
      setCommOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/accounts")} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Comptes
        </Button>
        <Button variant="ghost" size="icon" onClick={onRefresh} className="ml-auto h-8 w-8">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Main Header */}
      <div className="border rounded-lg p-5 bg-card space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  {profile?.full_name || account.account_name || "Client"}
                </h1>
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                {creditInfo && (
                  <div className="flex items-center gap-1.5">
                    <div className={`h-3 w-3 rounded-full ${creditInfo.className}`} />
                    <span className="text-xs text-muted-foreground">Crédit {creditInfo.label}</span>
                  </div>
                )}
                {account.status === "suspended" && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Suspendu
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
                <span className="font-mono font-medium text-foreground/70">{account.account_number}</span>
                {profile?.email && <span>{profile.email}</span>}
                {profile?.phone && <span>{profile.phone}</span>}
              </div>
              {account.primary_service_address && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {account.primary_service_address}
                  {account.primary_service_city && `, ${account.primary_service_city}`}
                  {account.primary_service_postal_code && ` ${account.primary_service_postal_code}`}
                </p>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Summary metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <MetricCard label="Services actifs" value={activeServices.toString()} />
          <MetricCard label="Solde du compte" value={`${totalBalance.toFixed(2)} $`} highlight={totalBalance > 0} />
          <MetricCard label="Prochain cycle" value={account.billing_cycle_day ? `${account.billing_cycle_day} du mois` : "—"} />
          <MetricCard label="Dernier paiement" value={lastPayment ? `${lastPayment.amount?.toFixed(2)} $` : "—"} />
          <MetricCard label="Tickets ouverts" value={openTickets.toString()} highlight={openTickets > 0} />
          <MetricCard label="Client depuis" value={customerSince} />
          <MetricCard label="Sécurité" value={profile?.security_status === "flagged" ? "Alerte" : "Normal"} highlight={profile?.security_status === "flagged"} />
        </div>

        <Separator />

        {/* Quick Actions — ALL OPERATIONAL */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setEditOpen(true)}>
            <UserPen className="h-3.5 w-3.5" />
            Modifier le profil
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setNoteOpen(true)}>
            <StickyNote className="h-3.5 w-3.5" />
            Note
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setSuspendOpen(true)}>
            <Ban className="h-3.5 w-3.5" />
            {account.status === "suspended" ? "Réactiver" : "Suspendre"}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate(`/admin/orders?client=${clientId}`)}>
            <PlusCircle className="h-3.5 w-3.5" />
            Ajouter service
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate(`/admin/orders?new=true&client=${clientId}`)}>
            <Package className="h-3.5 w-3.5" />
            Créer commande
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setTicketOpen(true)}>
            <Headphones className="h-3.5 w-3.5" />
            Ticket support
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setCommOpen(true)}>
            <Mail className="h-3.5 w-3.5" />
            Communication
          </Button>
        </div>
      </div>

      {/* Note Dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Interne</SelectItem>
                  <SelectItem value="credit">Crédit</SelectItem>
                  <SelectItem value="fraud">Fraude</SelectItem>
                  <SelectItem value="billing">Facturation</SelectItem>
                  <SelectItem value="technical">Technique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Note</Label>
              <Textarea value={noteBody} onChange={e => setNoteBody(e.target.value)} rows={4} placeholder="Entrer la note..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Annuler</Button>
            <Button onClick={handleAddNote} disabled={saving || !noteBody.trim()}>
              {saving ? "Enregistrement..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <AlertDialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {account.status === "suspended" ? "Réactiver le compte" : "Suspendre le compte"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {account.status === "suspended"
                ? "Voulez-vous réactiver ce compte client?"
                : "La suspension bloquera l'accès aux services du client."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {account.status !== "suspended" && (
            <div className="py-2">
              <Label>Raison de la suspension</Label>
              <Textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)} rows={2} placeholder="Raison..." />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuspend} disabled={saving}>
              {saving ? "En cours..." : account.status === "suspended" ? "Réactiver" : "Suspendre"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Ticket Dialog */}
      <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un ticket support</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Sujet</Label>
              <Input value={ticketSubject} onChange={e => setTicketSubject(e.target.value)} placeholder="Sujet du ticket..." />
            </div>
            <div>
              <Label>Priorité</Label>
              <Select value={ticketPriority} onValueChange={setTicketPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Bas</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Élevé</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={ticketDesc} onChange={e => setTicketDesc(e.target.value)} rows={3} placeholder="Description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTicketOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateTicket} disabled={saving || !ticketSubject.trim()}>
              {saving ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Communication Dialog */}
      <Dialog open={commOpen} onOpenChange={setCommOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer une communication</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Destinataire</Label>
              <Input value={profile?.email || ""} disabled />
            </div>
            <div>
              <Label>Sujet</Label>
              <Input value={commSubject} onChange={e => setCommSubject(e.target.value)} placeholder="Sujet..." />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea value={commBody} onChange={e => setCommBody(e.target.value)} rows={5} placeholder="Corps du message..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommOpen(false)}>Annuler</Button>
            <Button onClick={handleSendComm} disabled={saving || !commSubject.trim() || !commBody.trim()}>
              {saving ? "Envoi..." : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Edit Dialog */}
      <AccountProfileEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        profile={profile}
        account={account}
        clientId={clientId}
        onSaved={onRefresh}
      />
    </div>
  );
}

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center p-2 rounded-md bg-muted/40">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${highlight ? "text-destructive" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
