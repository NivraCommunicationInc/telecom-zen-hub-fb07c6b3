/**
 * AdminEmailChangePanel — BUG 10: Allow admin to see and process email change requests,
 * and also force-change a client's email directly.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as adminSupabase } from "@/integrations/backend/adminClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Mail, Check, X, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  clientId: string;
  currentEmail?: string;
}

export function AdminEmailChangePanel({ clientId, currentEmail }: Props) {
  const queryClient = useQueryClient();
  const [forceDialogOpen, setForceDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["email-change-requests-admin", clientId],
    queryFn: async () => {
      const { data, error } = await adminSupabase
        .from("email_change_requests")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId,
  });

  const processMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: "approve" | "reject" }) => {
      const { error } = await adminSupabase
        .from("email_change_requests")
        .update({
          status: action === "approve" ? "completed" : "rejected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: (_, { action }) => {
      toast.success(action === "approve" ? "Demande approuvée" : "Demande rejetée");
      queryClient.invalidateQueries({ queryKey: ["email-change-requests-admin", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const forceChangeMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await adminSupabase
        .from("profiles")
        .update({ email, updated_at: new Date().toISOString() })
        .eq("user_id", clientId);
      if (error) throw error;
      // Also insert a completed request for audit trail
      await adminSupabase.from("email_change_requests").insert({
        client_id: clientId,
        old_email: currentEmail || "",
        new_email: email,
        status: "completed",
        initiated_by: "admin",
      });
    },
    onSuccess: () => {
      toast.success("Email mis à jour avec succès");
      setForceDialogOpen(false);
      setNewEmail("");
      queryClient.invalidateQueries({ queryKey: ["email-change-requests-admin", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pending = (requests ?? []).filter((r: any) => ["pending", "old_verified"].includes(r.status));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="w-4 h-4" /> Changement d'email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          Email actuel: <span className="font-mono font-medium text-foreground">{currentEmail || "—"}</span>
        </div>

        {pending.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-amber-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {pending.length} demande(s) en attente
            </p>
            {pending.map((req: any) => (
              <div key={req.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border text-xs">
                <div>
                  <span className="text-muted-foreground">Vers: </span>
                  <span className="font-mono font-medium">{req.new_email}</span>
                  <p className="text-muted-foreground mt-0.5">
                    {format(new Date(req.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => processMutation.mutate({ requestId: req.id, action: "reject" })}
                    disabled={processMutation.isPending}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => processMutation.mutate({ requestId: req.id, action: "approve" })}
                    disabled={processMutation.isPending}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs h-8"
          onClick={() => setForceDialogOpen(true)}
        >
          <Mail className="w-3 h-3 mr-1" /> Changer l'email (admin)
        </Button>

        {!isLoading && (requests ?? []).filter((r: any) => r.status === "completed").length > 0 && (
          <p className="text-xs text-muted-foreground">
            Dernier changement: {format(new Date((requests ?? []).find((r: any) => r.status === "completed")?.created_at), "d MMM yyyy", { locale: fr })}
          </p>
        )}
      </CardContent>

      <Dialog open={forceDialogOpen} onOpenChange={setForceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Changer l'email du client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm">Email actuel</Label>
              <p className="font-mono text-sm text-muted-foreground mt-1">{currentEmail || "—"}</p>
            </div>
            <div>
              <Label className="text-sm">Nouvel email *</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nouveau@email.com"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForceDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={() => forceChangeMutation.mutate(newEmail)}
              disabled={!newEmail || !newEmail.includes("@") || forceChangeMutation.isPending}
            >
              {forceChangeMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Confirmer le changement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
