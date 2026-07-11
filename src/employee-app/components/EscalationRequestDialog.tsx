/**
 * EscalationRequestDialog — Employee-side wrapper for the canonical door.
 * Module 45 Phase 2 : fusion obligatoire, plus d'INSERT direct dans internal_tickets.
 * Toutes les créations passent par supervisor-escalation-action + rpc_create_supervisor_escalation.
 */
import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Send, Loader2, AlertTriangle } from "lucide-react";
import { callCoreAction } from "@/core-app/lib/callCoreAction";

interface Props {
  clientId?: string;
  accountId?: string;
  clientName?: string;
  accountNumber?: string;
  orderId?: string;
  orderNumber?: string;
  initialCategory?: string;
  initialSubject?: string;
  initialDescription?: string;
  onClose: () => void;
}

const ESCALATION_TYPES = [
  { value: "billing", label: "Facturation" },
  { value: "technical", label: "Technique" },
  { value: "retention", label: "Rétention" },
  { value: "complaint", label: "Plainte" },
  { value: "fraud", label: "Fraude" },
  { value: "other", label: "Autre" },
] as const;

const PRIORITIES = [
  { value: "normal", label: "Normale" },
  { value: "high", label: "Haute" },
  { value: "urgent", label: "Urgente" },
];

// Map legacy categories -> canonical escalation_type
function mapLegacyCategory(v?: string): string {
  if (!v) return "other";
  if (["billing_adjustment","credit_request"].includes(v)) return "billing";
  if (["order_creation","add_service","service_change","tv_channel_change"].includes(v)) return "other";
  if (v === "cancel_subscription") return "retention";
  if (v === "account_correction") return "other";
  if (ESCALATION_TYPES.some(t => t.value === v)) return v;
  return "other";
}

export function EscalationRequestDialog({
  clientId,
  accountId,
  clientName,
  accountNumber,
  orderNumber,
  initialCategory,
  initialSubject,
  initialDescription,
  onClose,
}: Props) {
  const qc = useQueryClient();
  const [escalationType, setEscalationType] = useState(mapLegacyCategory(initialCategory));
  const [priority, setPriority] = useState("normal");
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Client manquant");
      let resolvedAccountId = accountId;
      if (!resolvedAccountId) {
        const { data: acct } = await supabase.from("accounts").select("id").eq("client_id", clientId).maybeSingle();
        resolvedAccountId = acct?.id;
      }
      if (!resolvedAccountId) throw new Error("Compte introuvable pour ce client");

      const contextParts: string[] = [];
      if (clientName) contextParts.push(`Client: ${clientName}`);
      if (accountNumber) contextParts.push(`Compte: ${accountNumber}`);
      if (orderNumber) contextParts.push(`Commande: ${orderNumber}`);
      if (priority !== "normal") contextParts.push(`Priorité: ${priority}`);
      const contextStr = contextParts.length ? `\n\n--- Contexte ---\n${contextParts.join("\n")}` : "";
      const fullDesc = `${description.trim()}${contextStr}`;
      const finalSubject = subject.trim() || `Escalade — ${ESCALATION_TYPES.find(t => t.value === escalationType)?.label ?? escalationType}`;

      const res = await callCoreAction<{ ticket_id: string; ticket_number: string | null }>(
        "supervisor-escalation-action",
        {
          action: "create",
          account_id: resolvedAccountId,
          client_user_id: clientId,
          subject: finalSubject,
          description: fullDesc,
          escalation_type: escalationType,
          idempotency_key: idempotencyKey,
        },
        {
          reason: description.trim(),
          successMessage: "Escalade superviseur créée",
          errorMessage: "Échec de l'escalade",
          queryClient: qc,
          skipInvalidation: true,
        },
      );
      if (!res.ok) throw new Error(res.error ?? "Échec");
      return res.data;
    },
    onSuccess: () => onClose(),
    onError: (err: any) => toast.error(`Erreur: ${err.message}`),
  });

  const canSubmit = description.trim().length >= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Escalade superviseur</h2>
              <p className="text-[10px] text-muted-foreground">Action réservée à l'équipe Core</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {(clientName || accountNumber || orderNumber) && (
            <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              {clientName && <p>Client: <span className="text-foreground font-medium">{clientName}</span></p>}
              {accountNumber && <p>Compte: <span className="text-foreground font-mono">{accountNumber}</span></p>}
              {orderNumber && <p>Commande: <span className="text-foreground font-mono">{orderNumber}</span></p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Type d'escalade</label>
              <select value={escalationType} onChange={(e) => setEscalationType(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/50">
                {ESCALATION_TYPES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Priorité</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/50">
                {PRIORITIES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Sujet (optionnel)</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="Titre de la demande…" maxLength={200}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50" />
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Détails *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Expliquez la demande…" rows={4} maxLength={5000}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 resize-none" />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            Annuler
          </button>
          <button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-500 disabled:opacity-40 transition-colors">
            {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Envoyer l'escalade
          </button>
        </div>
      </div>
    </div>
  );
}
