/**
 * CrmAssignDialog — Admin-only: assign a contact to a specific agent.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { CrmContact } from "../lib/crmTypes";

interface Props {
  contact: CrmContact | null;
  onClose: () => void;
}

interface AgentRow { user_id: string; full_name: string | null; email: string | null; role: string }

export function CrmAssignDialog({ contact, onClose }: Props) {
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<string>(contact?.assigned_to ?? "");

  const { data: agents = [], isLoading } = useQuery<AgentRow[]>({
    queryKey: ["crm-assignable-agents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, role, profiles!inner(full_name, email)")
        .in("role", ["employee", "field_sales", "admin"])
        .eq("is_active", true);
      const seen = new Set<string>();
      const list: AgentRow[] = [];
      for (const r of (data ?? []) as any[]) {
        if (seen.has(r.user_id)) continue;
        seen.add(r.user_id);
        list.push({
          user_id: r.user_id,
          role: r.role,
          full_name: r.profiles?.full_name ?? null,
          email: r.profiles?.email ?? null,
        });
      }
      return list.sort((a, b) => (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? ""));
    },
    enabled: !!contact,
  });

  if (!contact) return null;

  const handleAssign = async (agentId: string | null) => {
    setPending(true);
    const { data, error } = await supabase.rpc("crm_assign_contact", {
      p_contact_id: contact.id,
      p_agent_id: agentId as any,
    });
    setPending(false);
    const res = data as any;
    if (error || !res?.ok) {
      toast.error(`Erreur : ${res?.error ?? error?.message ?? "inconnue"}`);
      return;
    }
    toast.success(agentId ? "Contact assigné" : "Assignation retirée");
    onClose();
  };

  return (
    <Dialog open={!!contact} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-violet-500" /> Assigner ce contact
          </DialogTitle>
          <DialogDescription>{contact.full_name ?? contact.first_name} — {contact.city ?? "—"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {agents.map((a) => (
                  <button
                    key={a.user_id}
                    onClick={() => setSelected(a.user_id)}
                    className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors ${
                      selected === a.user_id ? "border-violet-500 bg-violet-500/10" : "border-border hover:border-violet-500/50"
                    }`}
                  >
                    <div className="font-medium">{a.full_name ?? a.email}</div>
                    <div className="text-[11px] text-muted-foreground">{a.role} · {a.email}</div>
                  </button>
                ))}
              </div>
              <div className="flex justify-between gap-2 pt-3 border-t">
                <Button variant="ghost" onClick={() => handleAssign(null)} disabled={pending}>Retirer assignation</Button>
                <Button onClick={() => handleAssign(selected)} disabled={!selected || pending}>
                  {pending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Assigner
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
