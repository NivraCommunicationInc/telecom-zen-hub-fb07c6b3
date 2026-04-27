/**
 * AssignTechnicianDialog — Assign a support ticket to a technician.
 * Lists users with the 'technician' role and writes assigned_to_user_id + assigned_to (cached name).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addOperationalNote } from "@/shared-ops";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { X, Loader2, UserCheck } from "lucide-react";

interface Props {
  ticketId: string;
  currentAssignedUserId?: string | null;
  currentAssignedName?: string | null;
  onClose: () => void;
}

export function AssignTechnicianDialog({ ticketId, currentAssignedUserId, currentAssignedName, onClose }: Props) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | "self" | "">(currentAssignedUserId ?? "");

  const { data: technicians = [], isLoading } = useQuery({
    queryKey: ["available-technicians"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["technician", "techops"]);
      if (error) throw error;
      const ids = [...new Set((roles ?? []).map(r => r.user_id))];
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", ids);
      return (profiles ?? []).map(p => ({
        user_id: p.user_id,
        name: p.full_name ?? p.email ?? p.user_id.slice(0, 8),
        email: p.email ?? "",
      }));
    },
    staleTime: 1000 * 60 * 5,
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      let userId: string | null = null;
      let name: string = "";

      if (selectedUserId === "self") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Non authentifié");
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle();
        userId = user.id;
        name = profile?.full_name ?? user.email ?? "Agent";
      } else if (selectedUserId === "") {
        // unassign
        userId = null;
        name = "";
      } else {
        const tech = technicians.find(t => t.user_id === selectedUserId);
        if (!tech) throw new Error("Technicien introuvable");
        userId = tech.user_id;
        name = tech.name;
      }

      const { error } = await supabase
        .from("support_tickets")
        .update({
          assigned_to_user_id: userId,
          assigned_to: userId ? name : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketId);
      if (error) throw error;

      await addOperationalNote({
        entityId: ticketId,
        entityType: "support_ticket",
        note: userId ? `Assigné à ${name}` : "Assignation retirée",
        portal: "employee",
      });
      await logInternalAudit({
        action: userId ? "ticket_assigned" : "ticket_unassigned",
        category: "operations",
        portal: "employee",
        targetType: "support_ticket",
        targetId: ticketId,
        metadata: userId ? { assigned_to_user_id: userId, assigned_to_name: name } : {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-ticket-detail", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["employee-support-v2"] });
      queryClient.invalidateQueries({ queryKey: ["employee-internet-tickets"] });
      toast.success("Assignation mise à jour");
      onClose();
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Assigner le ticket</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary transition-colors" aria-label="Fermer">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {currentAssignedName && (
            <p className="text-[11px] text-muted-foreground">
              Actuellement assigné à <span className="text-foreground font-medium">{currentAssignedName}</span>
            </p>
          )}

          <div>
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Assigner à</label>
            {isLoading ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement…
              </div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value as any)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/50"
              >
                <option value="">— Non assigné —</option>
                <option value="self">Moi-même</option>
                {technicians.length > 0 && (
                  <optgroup label="Techniciens">
                    {technicians.map(t => (
                      <option key={t.user_id} value={t.user_id}>
                        {t.name}{t.email ? ` (${t.email})` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
            {!isLoading && technicians.length === 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Aucun technicien enregistré. Vous pouvez vous assigner le ticket.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            Annuler
          </button>
          <button
            onClick={() => assignMutation.mutate()}
            disabled={assignMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {assignMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
