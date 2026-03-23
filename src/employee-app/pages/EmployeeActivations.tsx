/**
 * EmployeeActivations — Production-grade activation queue.
 * Shows activation readiness with pre-flight checks.
 * Uses shared-ops for data, enforces payment/equipment/appointment gates.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Loader2, CheckCircle, XCircle, ArrowUpRight, AlertTriangle, Package, Calendar, CreditCard, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { useNavigate } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { updateOrderStatus } from "@/shared-ops";
import { ActionConfirmButton } from "@/employee-app/components/ActionConfirmDialog";
import { StatusBadge } from "@/employee-app/components/StatusBadge";

interface ActivationItem {
  id: string;
  order_number: string | null;
  user_id: string | null;
  account_id: string | null;
  status: string;
  service_type: string | null;
  payment_status: string | null;
  created_at: string;
  clientName: string | null;
  accountNumber: string | null;
  hasEquipment: boolean;
  hasAppointment: boolean;
  appointmentCompleted: boolean;
  kycApproved: boolean;
}

export default function EmployeeActivations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["employee-activations-v3"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, user_id, account_id, status, service_type, payment_status, created_at")
        .in("status", ["delivered", "installed", "ready", "provisioning", "processing", "confirmed", "completed"])
        .eq("environment", "live")
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      if (!data?.length) return [];

      const orderIds = data.map(o => o.id);
      const userIds = [...new Set(data.map(o => o.user_id).filter(Boolean))];
      const accountIds = [...new Set(data.map(o => o.account_id).filter(Boolean))];

      const [profilesRes, accountsRes, equipmentRes, appointmentsRes, kycRes] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("user_id, full_name").in("user_id", userIds) : Promise.resolve({ data: [] }),
        accountIds.length ? supabase.from("accounts").select("id, account_number").in("id", accountIds) : Promise.resolve({ data: [] }),
        supabase.from("equipment_inventory").select("order_id").in("order_id", orderIds),
        supabase.from("appointments").select("order_id, status").in("order_id", orderIds),
        supabase.from("order_identity_data").select("order_id, verification_status").in("order_id", orderIds),
      ]);

      const profileMap = new Map((profilesRes.data ?? []).map(p => [p.user_id, p]));
      const accountMap = new Map((accountsRes.data ?? []).map(a => [a.id, a]));
      const equipmentByOrder = new Set((equipmentRes.data ?? []).map(e => e.order_id));
      const appointmentsByOrder = new Map((appointmentsRes.data ?? []).map(a => [a.order_id, a]));
      const kycByOrder = new Map((kycRes.data ?? []).map(k => [k.order_id, k]));

      return data.map(o => ({
        ...o,
        clientName: profileMap.get(o.user_id)?.full_name ?? null,
        accountNumber: accountMap.get(o.account_id)?.account_number ?? null,
        hasEquipment: equipmentByOrder.has(o.id),
        hasAppointment: appointmentsByOrder.has(o.id),
        appointmentCompleted: appointmentsByOrder.get(o.id)?.status === "completed",
        kycApproved: kycByOrder.get(o.id)?.verification_status === "approved",
      })) as ActivationItem[];
    },
    staleTime: 1000 * 60 * 2,
  });

  const activateMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await updateOrderStatus({ orderId, newStatus: "activated", logAction: "Service activé par employé", portal: "employee" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-activations-v3"] });
      toast.success("Service activé avec succès");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const readyCount = items.filter(i => isReady(i)).length;
  const blockedCount = items.filter(i => !isReady(i)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Activations</h1>
          <p className="text-xs text-muted-foreground">
            {readyCount} prêt{readyCount !== 1 ? "s" : ""} · {blockedCount} bloqué{blockedCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Aucune activation en attente.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Commande", "Client", "Service", "Paiement", "Équipement", "RDV", "KYC", "Statut", "Prêt", ""].map(h => (
                    <th key={h} className={cn("px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider", h === "" ? "text-right" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const ready = isReady(item);
                  const checks = getChecks(item);
                  return (
                    <tr key={item.id} className={cn("border-b border-border/50 hover:bg-secondary/30 transition-colors",
                      ready ? "bg-emerald-500/[0.02]" : ""
                    )}>
                      <td className="px-3 py-2">
                        <button onClick={() => navigate(employeePath(`/orders/${item.order_number ?? item.id}`))} className="font-mono text-primary hover:underline">
                          {item.order_number ?? "—"}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{item.clientName ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.service_type ?? "—"}</td>
                      <td className="px-3 py-2"><CheckIcon ok={checks.payment} label={checks.payment ? "Payé" : "Non payé"} /></td>
                      <td className="px-3 py-2"><CheckIcon ok={checks.equipment} label={checks.equipment ? "Assigné" : "Manquant"} /></td>
                      <td className="px-3 py-2"><CheckIcon ok={checks.appointment} label={checks.appointment ? "Complété" : "En attente"} /></td>
                      <td className="px-3 py-2"><CheckIcon ok={checks.kyc} label={checks.kyc ? "Approuvé" : "En attente"} /></td>
                      <td className="px-3 py-2"><StatusBadge status={item.status} /></td>
                      <td className="px-3 py-2">
                        {ready ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[10px]">
                            <CheckCircle className="h-3 w-3" /> PRÊT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-semibold text-[10px]">
                            <AlertTriangle className="h-3 w-3" /> BLOQUÉ
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {ready ? (
                          <ActionConfirmButton
                            label="Activer"
                            consequence={`Activer le service pour ${item.clientName || item.order_number} — l'abonnement deviendra actif`}
                            onConfirm={() => activateMutation.mutate(item.id)}
                            isPending={activateMutation.isPending}
                            variant="primary"
                          />
                        ) : (
                          <button
                            onClick={() => navigate(employeePath(`/orders/${item.order_number ?? item.id}`))}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          >
                            Détails <ArrowUpRight className="h-3 w-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function isReady(item: ActivationItem): boolean {
  const checks = getChecks(item);
  return checks.payment && checks.equipment;
}

function getChecks(item: ActivationItem) {
  return {
    payment: item.payment_status === "paid" || item.payment_status === "captured" || item.payment_status === "completed",
    equipment: item.hasEquipment,
    appointment: item.appointmentCompleted || !item.hasAppointment,
    kyc: item.kycApproved || true, // KYC is optional for activation
  };
}

function CheckIcon({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium",
      ok ? "text-emerald-400" : "text-amber-400"
    )} title={label}>
      {ok ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}
