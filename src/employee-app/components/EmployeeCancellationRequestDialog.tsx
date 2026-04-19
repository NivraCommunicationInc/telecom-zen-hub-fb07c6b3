/**
 * EmployeeCancellationRequestDialog — Inserts a row into public.service_cancellation_requests.
 * Used by Employee Portal customer-service agents to log a cancellation request on behalf
 * of a client. The Core team processes the request from /core/cancellations.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type ReasonCode = "price" | "moving" | "not_needed" | "service_issue" | "billing_issue" | "other";
type ServiceType = "mobile" | "internet" | "tv" | "security" | "streaming" | "bundle";

const REASONS: Array<{ value: ReasonCode; label: string }> = [
  { value: "price", label: "Prix trop élevé" },
  { value: "moving", label: "Déménagement" },
  { value: "not_needed", label: "Service non nécessaire" },
  { value: "service_issue", label: "Problème de service" },
  { value: "billing_issue", label: "Problème de facturation" },
  { value: "other", label: "Autre raison" },
];

const SERVICE_TYPES: Array<{ value: ServiceType; label: string }> = [
  { value: "mobile", label: "Mobile" },
  { value: "internet", label: "Internet" },
  { value: "tv", label: "Télévision" },
  { value: "security", label: "Sécurité" },
  { value: "streaming", label: "Streaming" },
  { value: "bundle", label: "Forfait combiné" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  accountId?: string | null;
  accountNumber?: string;
  onSubmitted?: () => void;
}

export default function EmployeeCancellationRequestDialog({
  open, onOpenChange, clientId, accountId, accountNumber, onSubmitted,
}: Props) {
  const [serviceType, setServiceType] = useState<ServiceType>("mobile");
  const [reasonCode, setReasonCode] = useState<ReasonCode>("price");
  const [reasonDetails, setReasonDetails] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [serviceIdentifier, setServiceIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setServiceType("mobile");
    setReasonCode("price");
    setReasonDetails("");
    setRequestedDate("");
    setServiceIdentifier("");
  };

  const handleSubmit = async () => {
    if (!reasonDetails.trim()) {
      toast.error("Veuillez décrire la raison de la demande.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("service_cancellation_requests")
        .insert({
          user_id: clientId,
          account_id: accountId ?? null,
          service_type: serviceType,
          service_identifier: serviceIdentifier || null,
          reason_code: reasonCode,
          reason_details: reasonDetails,
          requested_effective_date: requestedDate || null,
          status: "requested",
          created_by_role: "employee",
        });
      if (error) throw error;
      toast.success(
        accountNumber
          ? `Demande de résiliation envoyée pour ${accountNumber}`
          : "Demande de résiliation envoyée à l'équipe Core"
      );
      reset();
      onOpenChange(false);
      onSubmitted?.();
    } catch (err: any) {
      console.error("[EmployeeCancellationRequest] insert failed:", err);
      toast.error(err?.message ?? "Échec de l'envoi de la demande.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Demander une résiliation</DialogTitle>
          <DialogDescription>
            La demande sera envoyée à l'équipe Core pour traitement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type de service</Label>
            <Select value={serviceType} onValueChange={(v) => setServiceType(v as ServiceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Identifiant du service (optionnel)</Label>
            <Input
              value={serviceIdentifier}
              onChange={(e) => setServiceIdentifier(e.target.value)}
              placeholder="Numéro de téléphone, abonnement, etc."
            />
          </div>

          <div className="space-y-2">
            <Label>Raison</Label>
            <Select value={reasonCode} onValueChange={(v) => setReasonCode(v as ReasonCode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Détails (obligatoire)</Label>
            <Textarea
              rows={3}
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              placeholder="Décrivez la raison communiquée par le client…"
            />
          </div>

          <div className="space-y-2">
            <Label>Date d'effet souhaitée (optionnel)</Label>
            <Input
              type="date"
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Envoyer la demande
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
