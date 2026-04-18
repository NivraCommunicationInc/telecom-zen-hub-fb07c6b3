/**
 * OverdueAccountsCard — P0 GAP #8
 *
 * Real-time "Comptes en souffrance" widget for Nivra Core dashboard.
 * Groups overdue invoices into:
 *   - Avertissement (J0–J+2)
 *   - Urgent (J+3–J+4)
 *   - Suspendu (J+5+)
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { AlertTriangle, AlertCircle, Ban, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SectionCard } from "@/components/admin/ui/SectionCard";

type OverdueInvoice = {
  id: string;
  invoice_number: string | null;
  total: number | null;
  due_date: string | null;
  status: string | null;
  customer_id: string | null;
};

type Bucket = "warning" | "urgent" | "suspended";

function daysPastDue(dueDate: string | null): number {
  if (!dueDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dueDate);
  d.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function bucketize(days: number): Bucket | null {
  if (days >= 5) return "suspended";
  if (days >= 3) return "urgent";
  if (days >= 0) return "warning";
  return null;
}

export const OverdueAccountsCard = () => {
  const queryClient = useQueryClient();
  const [realtimeKey, setRealtimeKey] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-overdue-accounts", realtimeKey],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: rows } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, total, due_date, status, customer_id")
        .in("status", ["overdue", "pending"])
        .lte("due_date", today)
        .order("due_date", { ascending: true })
        .limit(200);

      const list = (rows || []) as OverdueInvoice[];
      const buckets = { warning: [] as OverdueInvoice[], urgent: [] as OverdueInvoice[], suspended: [] as OverdueInvoice[] };
      let totalAmount = 0;
      for (const inv of list) {
        const days = daysPastDue(inv.due_date);
        const b = bucketize(days);
        if (!b) continue;
        buckets[b].push(inv);
        totalAmount += Number(inv.total || 0);
      }
      return {
        total: list.length,
        warning: buckets.warning.length,
        urgent: buckets.urgent.length,
        suspended: buckets.suspended.length,
        totalAmount,
      };
    },
    refetchInterval: 60_000,
  });

  // Realtime: refetch on any billing_invoices change
  useEffect(() => {
    const channel = supabase
      .channel("admin-overdue-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "billing_invoices" },
        () => {
          setRealtimeKey((k) => k + 1);
          queryClient.invalidateQueries({ queryKey: ["admin-overdue-accounts"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const fmt = (n: number) =>
    n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

  return (
    <SectionCard
      title="Comptes en souffrance"
      icon={AlertTriangle}
      actions={
        <Link
          to="/admin/recouvrement"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          Ouvrir Recouvrement <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-xs uppercase text-muted-foreground">Avertissement</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {isLoading ? "—" : data?.warning ?? 0}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">J0 – J+2</p>
        </div>
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <span className="text-xs uppercase text-muted-foreground">Urgent</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {isLoading ? "—" : data?.urgent ?? 0}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">J+3 – J+4</p>
        </div>
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Ban className="w-4 h-4 text-red-500" />
            <span className="text-xs uppercase text-muted-foreground">Suspendu</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {isLoading ? "—" : data?.suspended ?? 0}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">J+5 et +</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Total comptes en retard :{" "}
          <span className="font-semibold text-foreground">
            {isLoading ? "—" : data?.total ?? 0}
          </span>
        </span>
        <span className="text-muted-foreground">
          À recouvrer :{" "}
          <span className="font-semibold text-foreground">
            {isLoading ? "—" : fmt(data?.totalAmount ?? 0)}
          </span>
        </span>
      </div>
    </SectionCard>
  );
};

export default OverdueAccountsCard;
