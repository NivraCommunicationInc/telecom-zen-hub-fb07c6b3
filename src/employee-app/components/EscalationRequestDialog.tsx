/**
 * EscalationRequestDialog — Create escalation to Core for restricted actions.
 * Uses internal_tickets table for Core team visibility.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Send, Loader2, AlertTriangle } from "lucide-react";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";

interface Props {
  clientId?: string;
  clientName?: string;
  accountNumber?: string;
  orderId?: string;
  orderNumber?: string;
  initialCategory?: string;
  initialSubject?: string;
  initialDescription?: string;
  onClose: () => void;
}

const ESCALATION_CATEGORIES = [
  { value: "credit_request", label: "Demande de crédit" },
  { value: "order_creation", label: "Création de commande" },
  { value: "add_service", label: "Ajout de service" },
  { value: "service_change", label: "Modification de service" },
  { value: "cancel_subscription", label: "Annulation d'abonnement" },
  { value: "tv_channel_change", label: "Changement de chaînes TV" },
  { value: "billing_adjustment", label: "Ajustement de facturation" },
  { value: "account_correction", label: "Correction de compte" },
  { value: "other", label: "Autre" },
];

const PRIORITIES = [
  { value: "normal", label: "Normale" },
  { value: "high", label: "Haute" },
  { value: "urgent", label: "Urgente" },
];

export function EscalationRequestDialog({
  clientId,
  clientName,
  accountNumber,
  orderId,
  orderNumber,
  initialCategory,
  initialSubject,
  initialDescription,
  onClose,
}: Props) {
  const [category, setCategory] = useState(initialCategory ?? "credit_request");
  const [priority, setPriority] = useState("normal");
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .maybeSingle();

      const agentName = profile?.full_name ?? user.email ?? "Agent";

      // Build context string
      const contextParts: string[] = [];
      if (clientName) contextParts.push(`Client: ${clientName}`);
      if (accountNumber) contextParts.push(`Compte: ${accountNumber}`);
      if (orderNumber) contextParts.push(`Commande: ${orderNumber}`);
      const contextStr = contextParts.length > 0 ? `\n\n--- Contexte ---\n${contextParts.join("\n")}` : "";

      const fullDescription = `${description.trim()}${contextStr}\n\n--- Demandeur ---\n${agentName} (Portail Employé)`;

      const categoryLabel = ESCALATION_CATEGORIES.find((c) => c.value === category)?.label ?? category;

      const { data, error } = await supabase
        .from("internal_tickets")
        .insert({
          subject: subject.trim() || `Escalation: ${categoryLabel}`,
          description: fullDescription,
          category,
          priority,
          status: "open",
          assigned_to_department: "operations",
          created_by_id: user.id,
          created_by_name: agentName,
          created_by_email: profile?.email ?? user.email ?? null,
          created_by_role: "employee",
        })
        .select("id")
        .single();

      if (error) throw error;

      await logInternalAudit({
        action: `escalation_created_${category}`,
        category: "operations",
        portal: "employee",
        targetType: "internal_ticket",
        targetId: data.id,
      });

      return data.id;
    },
    onSuccess: () => {
      toast.success("Demande d'escalation envoyée à l'équipe Core");
      onClose();
    },
    onError: (err: any) => toast.error(`Erreur: ${err.message}`),
  });

  const canSubmit = description.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Escalation vers Core</h2>
              <p className="text-[10px] text-muted-foreground">Action réservée à l'équipe opérations</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Context display */}
          {(clientName || accountNumber || orderNumber) && (
            <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              {clientName && <p>Client: <span className="text-foreground font-medium">{clientName}</span></p>}
              {accountNumber && <p>Compte: <span className="text-foreground font-mono">{accountNumber}</span></p>}
              {orderNumber && <p>Commande: <span className="text-foreground font-mono">{orderNumber}</span></p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Type</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/50"
              >
                {ESCALATION_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Priorité</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/50"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Sujet (optionnel)</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Titre de la demande…"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Détails de la demande *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Expliquez la demande, le montant du crédit, le changement de service souhaité, etc."
              rows={4}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            Annuler
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-500 disabled:opacity-40 transition-colors"
          >
            {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Envoyer l'escalation
          </button>
        </div>
      </div>
    </div>
  );
}
