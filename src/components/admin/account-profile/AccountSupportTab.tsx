/**
 * AccountSupportTab — Support tickets and appointments
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Headphones, Calendar, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AccountSupportTabProps {
  tickets: any[];
  appointments: any[];
}

const ticketStatusLabels: Record<string, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  waiting_client: "En attente client",
  resolved: "Résolu",
  closed: "Fermé",
};

const ticketPriorityConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Bas", variant: "outline" },
  normal: { label: "Normal", variant: "secondary" },
  high: { label: "Élevé", variant: "default" },
  urgent: { label: "Urgent", variant: "destructive" },
};

export function AccountSupportTab({ tickets, appointments }: AccountSupportTabProps) {
  const openTickets = tickets.filter((t: any) => !["resolved", "closed"].includes(t.status));
  const closedTickets = tickets.filter((t: any) => ["resolved", "closed"].includes(t.status));

  return (
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
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
        {closedTickets.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Résolus / Fermés ({closedTickets.length})</h4>
            {closedTickets.slice(0, 10).map((ticket: any) => (
              <TicketRow key={ticket.id} ticket={ticket} />
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
  );
}

function TicketRow({ ticket }: { ticket: any }) {
  const priority = ticketPriorityConfig[ticket.priority] || ticketPriorityConfig.normal;
  return (
    <div className="flex items-center justify-between p-3 rounded-md border hover:bg-accent/30">
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
