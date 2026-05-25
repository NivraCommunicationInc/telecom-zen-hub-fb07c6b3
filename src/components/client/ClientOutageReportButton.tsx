/**
 * ClientOutageReportButton — Feature 2.
 * Lets a logged-in client report a service outage. Creates a
 * service_incidents row + a support_tickets row, then triggers
 * confirmation + admin alert emails.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertOctagon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClientAuth } from "@/hooks/useClientAuth";
import { toast } from "sonner";

const ISSUE_TYPES = [
  { value: "internet_slow", label: "Internet lent" },
  { value: "no_connection", label: "Pas de connexion" },
  { value: "tv_not_working", label: "TV ne fonctionne pas" },
  { value: "mobile_issue", label: "Problème mobile" },
  { value: "other", label: "Autre" },
];

export function ClientOutageReportButton() {
  const { user } = useClientAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [issueType, setIssueType] = useState("no_connection");
  const [description, setDescription] = useState("");
  const [speed, setSpeed] = useState("");

  const reset = () => {
    setIssueType("no_connection");
    setDescription("");
    setSpeed("");
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Vous devez être connecté");
      return;
    }
    if (description.trim().length < 5) {
      toast.error("Décrivez le problème (au moins 5 caractères)");
      return;
    }
    setSubmitting(true);
    try {
      const typeLabel = ISSUE_TYPES.find((t) => t.value === issueType)?.label || issueType;
      const fullDescription = `${description.trim()}${speed ? `\n\nVitesse actuelle: ${speed}` : ""}`;

      // Get profile for service name + name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, account_number")
        .eq("user_id", user.id)
        .maybeSingle();

      // 1. service_incidents
      const { data: incident, error: incErr } = await supabase
        .from("service_incidents")
        .insert({
          service_name: "client_service",
          service_display_name: "Service client",
          incident_title: `Signalement client: ${typeLabel}`,
          incident_message: fullDescription,
          status_at_incident: "investigating",
          started_at: new Date().toISOString(),
          reported_by_client: true,
          client_user_id: user.id,
          client_description: fullDescription,
          incident_type: issueType,
        })
        .select("id")
        .single();
      if (incErr) throw incErr;

      // 2. support_tickets
      const { data: ticket, error: tErr } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user.id,
          subject: `Signalement panne: ${typeLabel}`,
          description: fullDescription,
          status: "open",
          priority: "high",
          category: "technical",
          client_email: profile?.email ?? user.email,
          client_name: profile?.full_name ?? null,
          source: "client_outage_report",
          issue_type: issueType,
        })
        .select("id, ticket_number")
        .single();
      if (tErr) throw tErr;

      // Link incident <-> ticket (best effort)
      if (ticket?.id) {
        await supabase
          .from("service_incidents")
          .update({ related_ticket_id: ticket.id })
          .eq("id", incident.id);
      }

      // 3. Confirmation email to client
      const eventBase = `outage_${incident.id}`;
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "outage_report_confirmation",
          recipientEmail: profile?.email ?? user.email,
          idempotencyKey: `${eventBase}_confirm`,
          templateData: {
            client_name: profile?.full_name ?? "Client",
            ticket_number: ticket?.ticket_number ?? ticket?.id ?? "—",
            incident_type: typeLabel,
            service_name: "Votre service",
          },
        },
      }).catch(() => {/* non-blocking */});

      // 4. Admin alert
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "outage_report_admin",
          recipientEmail: "support@nivra-telecom.ca",
          idempotencyKey: `${eventBase}_admin`,
          templateData: {
            client_name: profile?.full_name ?? "Client",
            account_number: profile?.account_number ?? "—",
            ticket_number: ticket?.ticket_number ?? ticket?.id ?? "—",
            incident_type: typeLabel,
            description: fullDescription,
            service_name: "Service client",
          },
        },
      }).catch(() => {/* non-blocking */});

      toast.success(`Signalement reçu — ticket ${ticket?.ticket_number ?? ""}`);
      reset();
      setOpen(false);
    } catch (e: any) {
      console.error("[outage report]", e);
      toast.error(e?.message || "Erreur lors du signalement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <AlertOctagon className="w-4 h-4" />
        Signaler une panne
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signaler une panne</DialogTitle>
            <DialogDescription>
              Décrivez le problème. Notre équipe sera notifiée immédiatement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Type de problème</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez ce qui ne fonctionne pas..."
                rows={4}
              />
            </div>

            <div>
              <Label>Vitesse actuelle (optionnel)</Label>
              <Input
                value={speed}
                onChange={(e) => setSpeed(e.target.value)}
                placeholder="Ex: 25 Mbps"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Envoyer le signalement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
