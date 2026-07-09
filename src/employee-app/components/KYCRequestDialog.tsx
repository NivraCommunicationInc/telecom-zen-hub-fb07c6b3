import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  accountId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
}

const ID_TYPES = [
  { value: "drivers_license", label: "Permis de conduire" },
  { value: "passport", label: "Passeport" },
  { value: "provincial_id", label: "Carte d'identité provinciale" },
  { value: "other", label: "Autre" },
];

export function KYCRequestDialog({ open, onOpenChange, clientId, accountId, clientName, clientEmail }: Props) {
  const queryClient = useQueryClient();
  const [idType, setIdType] = useState(ID_TYPES[0].value);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: row, error } = await supabase.functions.invoke("kyc-account-actions", {
        body: {
          action: "request_verification",
          client_user_id: clientId,
          account_id: accountId ?? null,
          requested_id_type: idType,
          reason: reason || "Vérification d'identité requise",
          notes: reason || null,
        },
      });
      if (error) throw error;
      if (!row?.ok) throw new Error(row?.error || "Échec de création KYC");
      return row;
    },
    onSuccess: () => {
      toast.success("Demande KYC envoyée");
      queryClient.invalidateQueries({ queryKey: ["employee-kyc-v2"] });
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Demander vérification KYC</DialogTitle>
          <DialogDescription>{clientName ?? "Client"} recevra une demande de pièce d’identité.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div><label className="text-xs text-muted-foreground">Type de pièce</label><select value={idType} onChange={(e) => setIdType(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">{ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
          <div><label className="text-xs text-muted-foreground">Notes / raison</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" /></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Envoyer</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
