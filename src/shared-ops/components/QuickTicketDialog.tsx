/**
 * QuickTicketDialog — Staff opens a support ticket from Account 360.
 * Writes a public.support_tickets row via `account-ops-actions` (action=create_ticket).
 * Sends a client email (`client_ticket_opened`, Violet Bold).
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName?: string;
  accountId?: string | null;
  mode?: "ticket" | "reminder";
}

const CATEGORIES = [
  { value: "general",  label: "Général" },
  { value: "billing",  label: "Facturation" },
  { value: "technical", label: "Technique" },
  { value: "complaint", label: "Plainte" },
  { value: "other",    label: "Autre" },
];

const REMINDER_TYPES = [
  { value: "billing_overdue",   label: "Facture en retard" },
  { value: "appointment",       label: "Rappel de rendez-vous" },
  { value: "kyc",               label: "Pièce d'identité requise" },
  { value: "equipment_return",  label: "Retour d'équipement" },
  { value: "general",           label: "Général" },
];

export function QuickTicketDialog({
  open, onClose, clientUserId, clientName, accountId, mode = "ticket",
}: Props) {
  const isReminder = mode === "reminder";
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [category, setCategory] = useState("general");
  const [reminderType, setReminderType] = useState("general");

  useEffect(() => {
    if (!open) return;
    setSubject(""); setDescription("");
    setPriority("normal"); setCategory("general"); setReminderType("general");
  }, [open]);

  const submit = async () => {
    if (!subject.trim() || !description.trim()) {
      toast.error("Sujet et description requis"); return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("account-ops-actions", {
        body: {
          action: isReminder ? "send_reminder" : "create_ticket",
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          subject: subject.trim(),
          description: description.trim(),
          priority,
          category,
          reminder_type: isReminder ? reminderType : undefined,
          idempotency_key: `ticket-${clientUserId}-${Date.now()}`,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success(isReminder ? "Rappel envoyé au client" : "Ticket créé — courriel envoyé");
      onClose();
    } catch (e: any) {
      // Extract actual error from edge function response
      let msg = e?.message || "Erreur inconnue";
      try {
        const body = await (e?.context as Response)?.json?.();
        if (body?.error) msg = body.error;
      } catch {}
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            {isReminder ? "Envoyer un rappel" : "Ouvrir un ticket support"}
          </DialogTitle>
          <DialogDescription>
            {clientName ? `Client : ${clientName}` : null}
            {" — "}
            {isReminder
              ? "Le client reçoit un courriel branding Nivra avec votre message."
              : "Un ticket est créé et le client reçoit une confirmation."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="t-subject">Sujet</Label>
            <Input
              id="t-subject" value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={140}
              placeholder={isReminder ? "ex: Rappel — facture en retard" : "ex: Problème de signal TV"}
              disabled={busy}
            />
          </div>
          <div>
            <Label htmlFor="t-desc">Message</Label>
            <Textarea
              id="t-desc" rows={5} value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez la demande ou le rappel…"
              disabled={busy}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{isReminder ? "Type de rappel" : "Catégorie"}</Label>
              {isReminder ? (
                <Select value={reminderType} onValueChange={setReminderType} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REMINDER_TYPES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={category} onValueChange={setCategory} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)} disabled={busy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="normal">Normale</SelectItem>
                  <SelectItem value="high">Élevée</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
            {isReminder ? "Envoyer le rappel" : "Créer le ticket"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
