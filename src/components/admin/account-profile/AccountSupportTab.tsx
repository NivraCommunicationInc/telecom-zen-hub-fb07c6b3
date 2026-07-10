/**
 * AccountSupportTab — Support tickets and appointments with create ticket action
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Headphones, Calendar, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient as supabase } from "@/integrations/backend";
import { callSupportAction } from "@/shared-ops/lib/callSupportAction";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

interface AccountSupportTabProps {
  tickets: any[];
  appointments: any[];
  clientId?: string;
}

const ticketStatusLabels: Record<string, string> = {
  open: "Ouvert", in_progress: "En cours", waiting_client: "En attente client", resolved: "Résolu", closed: "Fermé",
};
const ticketPriorityConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Bas", variant: "outline" },
  normal: { label: "Normal", variant: "secondary" },
  high: { label: "Élevé", variant: "default" },
  urgent: { label: "Urgent", variant: "destructive" },
};

export function AccountSupportTab({ tickets, appointments, clientId }: AccountSupportTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("normal");
  const [category, setCategory] = useState("general");
  const [saving, setSaving] = useState(false);

  const openTickets = tickets.filter((t: any) => !["resolved", "closed"].includes(t.status));
  const closedTickets = tickets.filter((t: any) => ["resolved", "closed"].includes(t.status));

  const handleCreateTicket = async () => {
    if (!subject.trim() || !clientId) return;
    setSaving(true);
    try {
      const res = await callSupportAction("create_ticket", {
        owner_user_id: clientId,
        subject: subject.trim(),
        description: desc.trim() || null,
        priority,
        category,
        source: "core",
        idempotency_key: `core-supporttab-${clientId}-${Date.now()}`,
      });
      toast.success(`Ticket ${res.ticket_number ?? ""} créé`);
      setSubject(""); setDesc(""); setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["account-profile-tickets"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Support ({tickets.length} tickets)</h3>
        {clientId && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
            <PlusCircle className="h-3.5 w-3.5" />
            Créer un ticket
          </Button>
        )}
      </div>

      <Tabs defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets">Tickets ({tickets.length})</TabsTrigger>
          <TabsTrigger value="appointments">Rendez-vous ({appointments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-3 space-y-4">
          {openTickets.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ouverts ({openTickets.length})</h4>
              {openTickets.map((ticket: any) => (
                <TicketRow key={ticket.id} ticket={ticket} onClick={() => navigate(`/admin/support?ticket=${ticket.id}`)} />
              ))}
            </div>
          )}
          {closedTickets.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Résolus / Fermés ({closedTickets.length})</h4>
              {closedTickets.slice(0, 10).map((ticket: any) => (
                <TicketRow key={ticket.id} ticket={ticket} onClick={() => navigate(`/admin/support?ticket=${ticket.id}`)} />
              ))}
            </div>
          )}
          {tickets.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun ticket de support</p>
          )}
        </TabsContent>

        <TabsContent value="appointments" className="mt-3 space-y-2">
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun rendez-vous</p>
          ) : (
            appointments.map((apt: any) => (
              <div key={apt.id} className="flex items-center justify-between p-3 rounded-md border">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{apt.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {apt.scheduled_at && format(new Date(apt.scheduled_at), "EEEE d MMM yyyy à HH:mm", { locale: fr })}
                      {apt.service_type && ` • ${apt.service_type}`}
                    </p>
                    {apt.service_address && (
                      <p className="text-xs text-muted-foreground">{apt.service_address}, {apt.service_city}</p>
                    )}
                  </div>
                </div>
                <Badge variant={apt.status === "completed" ? "default" : "outline"}>
                  {apt.status}
                </Badge>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Create Ticket Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un ticket support</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Sujet</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Sujet du ticket..." />
            </div>
            <div>
              <Label>Catégorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Général</SelectItem>
                  <SelectItem value="billing">Facturation</SelectItem>
                  <SelectItem value="technical">Technique</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="equipment">Équipement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={setPriority}>
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
              <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Description du problème..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateTicket} disabled={saving || !subject.trim()}>
              {saving ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TicketRow({ ticket, onClick }: { ticket: any; onClick: () => void }) {
  const priority = ticketPriorityConfig[ticket.priority] || ticketPriorityConfig.normal;
  return (
    <div className="flex items-center justify-between p-3 rounded-md border hover:bg-accent/30 cursor-pointer" onClick={onClick}>
      <div className="flex items-center gap-3">
        <Headphones className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{ticket.ticket_number || ticket.id.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground">
            {ticket.subject || ticket.category || "Support"}
            {" • "}
            {ticket.created_at && format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={priority.variant} className="text-[10px]">{priority.label}</Badge>
        <Badge variant="outline" className="text-[10px]">
          {ticketStatusLabels[ticket.status] || ticket.status}
        </Badge>
      </div>
    </div>
  );
}
