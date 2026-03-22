/**
 * EmployeeActivations — Activation queue with real operational actions.
 * Employees can mark orders as activated from this view.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Loader2, CheckCircle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { useNavigate } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";

export default function EmployeeActivations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["employee-activations-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, user_id, account_id, status, service_type, payment_status, created_at, assigned_to")
        .in("status", ["delivered", "installed", "ready", "provisioning"])
        .eq("environment", "live")
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      if (!data?.length) return [];

      const userIds = [...new Set(data.map(o => o.user_id).filter(Boolean))];
      const accountIds = [...new Set(data.map(o => o.account_id).filter(Boolean))];

      const [profilesRes, accountsRes] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
          : Promise.resolve({ data: [] }),
        accountIds.length
          ? supabase.from("accounts").select("id, account_number").in("id", accountIds)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map((profilesRes.data ?? []).map(p => [p.user_id, p]));
      const accountMap = new Map((accountsRes.data ?? []).map(a => [a.id, a]));

      return data.map(o => ({
        ...o,
        clientName: profileMap.get(o.user_id)?.full_name ?? null,
        clientEmail: profileMap.get(o.user_id)?.email ?? null,
        accountNumber: accountMap.get(o.account_id)?.account_number ?? null,
      }));
    },
    staleTime: 1000 * 60 * 2,
  });

  const activateMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Non authentifié");

      // Check payment status first
      const order = items.find(i => i.id === orderId);
      if (order && order.payment_status !== "paid") {
        throw new Error("Impossible d'activer: paiement non confirmé");
      }

      const { error } = await supabase
        .from("orders")
        .update({ status: "activated", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", session.user.id).maybeSingle();
      await supabase.from("activity_logs").insert({
        user_id: session.user.id,
        entity_id: orderId,
        entity_type: "order",
        action: "Service activé par employé",
        actor_name: profile?.full_name ?? session.user.email ?? "Employé",
        actor_role: "employee",
      });
      await logInternalAudit({ action: "activate_service", category: "operations", portal: "employee", targetType: "order", targetId: orderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-activations-v2"] });
      toast.success("Service activé avec succès");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      delivered: "text-blue-400 bg-blue-500/10",
      installed: "text-indigo-400 bg-indigo-500/10",
      ready: "text-emerald-400 bg-emerald-500/10",
      provisioning: "text-amber-400 bg-amber-500/10",
    };
    return map[s] ?? "text-[hsl(220,10%,50%)] bg-[hsl(220,15%,15%)]";
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Activations</h1>
        <p className="text-sm text-[hsl(220,10%,45%)]">
          {items.length} service{items.length !== 1 ? "s" : ""} en attente d'activation
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Zap className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,25%)]" />
          <p className="text-sm text-[hsl(220,10%,35%)]">Aucune activation en attente.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[hsl(220,15%,13%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)]">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Commande</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Compte</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Service</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Paiement</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Date</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-[hsl(220,15%,10%)] hover:bg-[hsl(220,20%,9%)] transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(employeePath(`/orders/${item.id}`))}
                        className="font-mono text-xs text-blue-400 hover:underline"
                      >
                        {item.order_number ?? "—"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,55%)]">{item.clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,50%)] font-mono">{item.accountNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,50%)]">{item.service_type ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium",
                        item.payment_status === "paid" ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
                      )}>
                        {item.payment_status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", statusColor(item.status))}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[hsl(220,10%,45%)]">
                      {format(new Date(item.created_at), "d MMM yyyy", { locale: fr })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Activer le service pour ${item.clientName || item.order_number} ?`)) {
                            activateMutation.mutate(item.id);
                          }
                        }}
                        disabled={activateMutation.isPending || item.payment_status !== "paid"}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors",
                          item.payment_status === "paid"
                            ? "bg-emerald-600 text-white hover:bg-emerald-500"
                            : "bg-[hsl(220,15%,13%)] text-[hsl(220,10%,35%)] cursor-not-allowed"
                        )}
                        title={item.payment_status !== "paid" ? "Paiement non confirmé" : "Activer le service"}
                      >
                        <Zap className="h-3 w-3" />
                        Activer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
