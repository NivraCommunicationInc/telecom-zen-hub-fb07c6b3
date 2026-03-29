/**
 * FieldMyPay — Lightweight commission/pay summary for Field agents.
 * Full RH details are in Nivra RH portal.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { DollarSign, ExternalLink, Clock, CheckCircle, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";

const fmtMoney = (n: number) => `${n.toFixed(2)} $`;

export default function FieldMyPay() {
  const { data, isLoading } = useQuery({
    queryKey: ["field-pay-summary"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const [commRes, payrollRes] = await Promise.all([
        supabase.from("sales_commissions").select("commission_amount, status").eq("salesperson_id", user.id),
        supabase.from("payroll_entries").select("net_pay, status, pay_period, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
      ]);

      const comms = commRes.data || [];
      const totalPending = comms.filter(c => ["pending", "pending_activation"].includes(c.status)).reduce((s, c) => s + Number(c.commission_amount), 0);
      const totalApproved = comms.filter(c => ["validated", "approved"].includes(c.status)).reduce((s, c) => s + Number(c.commission_amount), 0);
      const totalPaid = comms.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.commission_amount), 0);
      const lastPayslip = payrollRes.data?.[0] ?? null;

      return { totalPending, totalApproved, totalPaid, lastPayslip };
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="flex justify-center py-16"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  const d = data ?? { totalPending: 0, totalApproved: 0, totalPaid: 0, lastPayslip: null };

  const cards = [
    { label: "En attente", value: fmtMoney(d.totalPending), icon: Clock, color: "text-amber-600" },
    { label: "Approuvé", value: fmtMoney(d.totalApproved), icon: CheckCircle, color: "text-blue-600" },
    { label: "Payé", value: fmtMoney(d.totalPaid), icon: DollarSign, color: "text-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Résumé paie</h1>
        <p className="text-sm text-muted-foreground">Aperçu rapide — détails complets dans Nivra RH</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <c.icon className={cn("h-4 w-4", c.color)} />
              <span className="text-[11px] font-medium text-muted-foreground">{c.label}</span>
            </div>
            <p className={cn("text-xl font-bold", c.color)}>{c.value}</p>
          </div>
        ))}
      </div>

      {d.lastPayslip && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Banknote className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Dernière fiche de paie</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Période: {(d.lastPayslip as any).pay_period} — Net: {fmtMoney(Number((d.lastPayslip as any).net_pay || 0))} — Statut: {(d.lastPayslip as any).status}
          </p>
        </div>
      )}

      <Link
        to="/rh/dashboard"
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-primary text-primary font-semibold text-sm hover:bg-primary/5 transition-colors"
      >
        <ExternalLink className="h-4 w-4" />
        Accéder à mon dossier RH complet
      </Link>
    </div>
  );
}
