/**
 * CrmTransferDialog — Transfer a CRM contact (and the sale-in-progress) to
 * another agent with a reason. Calls crm_transfer_contact RPC.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCrmAgents } from "../hooks/useCrmAgents";
import { displayName, type CrmContact } from "../lib/crmTypes";

interface Props {
  contact: CrmContact | null;
  onClose: () => void;
}

export function CrmTransferDialog({ contact, onClose }: Props) {
  const { data: agents = [], isLoading } = useCrmAgents();
  const [toAgent, setToAgent] = useState<string>("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!contact || !toAgent) {
      toast.error("Choisis un agent destinataire");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("crm_transfer_contact", {
      p_contact_id: contact.id,
      p_to_agent_id: toAgent,
      p_reason: reason || null,
    });
    setBusy(false);
    const res = data as any;
    if (error || !res?.ok) {
      toast.error(`Transfert refusé : ${res?.error ?? error?.message ?? "inconnu"}`);
      return;
    }
    toast.success("✅ Contact transféré");
    setToAgent(""); setReason("");
    onClose();
  };

  return (
    <Dialog open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-rose-500" />
            Transférer la vente
          </DialogTitle>
        </DialogHeader>
        {contact && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Contact : <strong>{displayName(contact)}</strong>
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium">Agent destinataire</label>
              <select
                value={toAgent}
                onChange={(e) => setToAgent(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                disabled={isLoading}
              >
                <option value="">— Choisir —</option>
                {agents.map((a) => (
                  <option key={a.user_id} value={a.user_id}>
                    {a.full_name ?? a.email ?? a.user_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Raison du transfert (optionnel)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex : client préfère un agent francophone, conflit d'horaire…"
                rows={3}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button onClick={submit} disabled={busy || !toAgent}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Transférer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
