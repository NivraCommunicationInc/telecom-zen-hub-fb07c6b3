/**
 * CreateTicketDialog — Create support ticket for a client from employee portal.
 * Prefills client context. Uses support_tickets table.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { toast } from "sonner";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { X, Send, Loader2 } from "lucide-react";

interface Props {
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  onClose: () => void;
}

const CATEGORIES = [
  { value: "general", label: "Général" },
  { value: "billing", label: "Facturation" },
  { value: "technical", label: "Technique / Internet" },
  { value: "service", label: "Service" },
  { value: "equipment", label: "Équipement" },
  { value: "activation", label: "Activation" },
  { value: "cancellation", label: "Annulation" },
];

const PRIORITIES = [
  { value: "low", label: "Basse" },
  { value: "normal", label: "Normale" },
  { value: "high", label: "Haute" },
  { value: "urgent", label: "Urgente" },
];

export function CreateTicketDialog({ clientId, clientName, clientEmail, onClose }: Props) {
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("normal");

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const res = await callSupportAction("create_ticket", {
        owner_user_id: clientId,
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
        source: "employee_portal",
        client_email: clientEmail ?? null,
        idempotency_key: `emp-create-${user.id}-${clientId}-${Date.now()}`,
      });

      await logInternalAudit({
        action: "ticket_created_for_client",
        category: "operations",
        portal: "employee",
        targetType: "support_ticket",
        targetId: res.ticket_id!,
      });

      return res.ticket_id!;
    },
    onSuccess: (ticketId) => {
      toast.success("Ticket créé avec succès");
      onClose();
      navigate(employeePath(`/support/${ticketId}`));
    },
    onError: (err: any) => toast.error(`Erreur: ${err.message}`),
  });

  const canSubmit = subject.trim().length > 0 && description.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Créer un ticket</h2>
            {clientName && <p className="text-xs text-muted-foreground mt-0.5">Pour: {clientName}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Sujet *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet du ticket…"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/50"
              >
                {CATEGORIES.map((c) => (
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
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez le problème ou la demande…"
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
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Créer le ticket
          </button>
        </div>
      </div>
    </div>
  );
}
