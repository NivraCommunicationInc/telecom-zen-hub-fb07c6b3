/**
 * OverdueClientBadge — P0 GAP #8
 *
 * Red badge displayed on a client profile in Core when the client has
 * any overdue invoice (status='overdue' OR pending past due_date).
 *
 * Usage: <OverdueClientBadge clientUserId={client.user_id} />
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { AlertTriangle } from "lucide-react";

interface Props {
  clientUserId?: string | null;
  billingCustomerId?: string | null;
  className?: string;
}

export const OverdueClientBadge = ({ clientUserId, billingCustomerId, className }: Props) => {
  const queryClient = useQueryClient();
  const [tick, setTick] = useState(0);

  const queryKey = ["client-overdue-badge", clientUserId ?? null, billingCustomerId ?? null, tick];

  const { data: hasOverdue } = useQuery({
    queryKey,
    enabled: !!(clientUserId || billingCustomerId),
    queryFn: async () => {
      let customerId = billingCustomerId || null;
      if (!customerId && clientUserId) {
        const { data: bc } = await supabase
          .from("billing_customers")
          .select("id")
          .eq("user_id", clientUserId)
          .maybeSingle();
        customerId = bc?.id || null;
      }
      if (!customerId) return false;

      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase
        .from("billing_invoices")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customerId)
        .in("status", ["overdue", "pending"])
        .lte("due_date", today);
      return (count || 0) > 0;
    },
    refetchInterval: 60_000,
  });

  // Realtime
  useEffect(() => {
    if (!clientUserId && !billingCustomerId) return;
    const channel = supabase
      .channel(`client-overdue-${clientUserId || billingCustomerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "billing_invoices" },
        () => {
          setTick((t) => t + 1);
          queryClient.invalidateQueries({ queryKey: ["client-overdue-badge"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientUserId, billingCustomerId, queryClient]);

  if (!hasOverdue) return null;

  return (
    <span
      className={
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-500 border border-red-500/30 " +
        (className || "")
      }
      title="Ce compte a au moins une facture en souffrance"
    >
      <AlertTriangle className="w-3 h-3" />
      En souffrance
    </span>
  );
};

export default OverdueClientBadge;
