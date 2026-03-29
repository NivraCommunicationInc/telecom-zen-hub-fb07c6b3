/**
 * useEmployeeWallet — Dynamic employee financial summary.
 * Reads from employee_financial_summary view (computed from commissions, payroll, withdrawals).
 * Zero static values — everything is calculated server-side.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmployeeWallet {
  available_balance: number;
  pending_balance: number;
  validated_balance: number;
  locked_balance: number;
  total_earned: number;
  paid_via_payroll: number;
  lost_total: number;
  withdrawals_paid: number;
}

const EMPTY_WALLET: EmployeeWallet = {
  available_balance: 0,
  pending_balance: 0,
  validated_balance: 0,
  locked_balance: 0,
  total_earned: 0,
  paid_via_payroll: 0,
  lost_total: 0,
  withdrawals_paid: 0,
};

export function useEmployeeWallet(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["employee-wallet", userId],
    queryFn: async (): Promise<EmployeeWallet> => {
      // Use raw rpc/query since the view may not be in generated types yet
      const { data, error } = await supabase
        .from("employee_financial_summary" as any)
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();

      if (error) {
        console.error("[useEmployeeWallet] Error:", error);
        return EMPTY_WALLET;
      }
      if (!data) return EMPTY_WALLET;

      return {
        available_balance: Number(data.available_balance) || 0,
        pending_balance: Number(data.pending_balance) || 0,
        validated_balance: Number(data.validated_balance) || 0,
        locked_balance: Number(data.locked_balance) || 0,
        total_earned: Number(data.total_earned) || 0,
        paid_via_payroll: Number(data.paid_via_payroll) || 0,
        lost_total: Number(data.lost_total) || 0,
        withdrawals_paid: Number(data.withdrawals_paid) || 0,
      };
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export const fmtCAD = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n || 0);
