/**
 * useEmployeeWallet — Dynamic employee financial summary with realtime sync.
 * Reads from employee_financial_summary view.
 * Subscribes to realtime changes on commission/payroll tables for instant invalidation.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmployeeWallet {
  available_balance: number;
  pending_balance: number;
  validated_balance: number;
  payable_balance: number;
  in_payroll_balance: number;
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
  payable_balance: 0,
  in_payroll_balance: 0,
  locked_balance: 0,
  total_earned: 0,
  paid_via_payroll: 0,
  lost_total: 0,
  withdrawals_paid: 0,
};

/** Realtime tables that should trigger wallet refresh */
const REALTIME_TABLES = [
  "sales_commissions",
  "field_commissions",
  "commission_withdrawal_requests",
  "payroll_entries",
  "payroll_commission_links",
] as const;

export function useEmployeeWallet(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  // Subscribe to realtime changes for wallet invalidation
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`wallet-sync-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_commissions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["employee-wallet", userId] });
        queryClient.invalidateQueries({ queryKey: ["rh-commissions"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "field_commissions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["employee-wallet", userId] });
        queryClient.invalidateQueries({ queryKey: ["rh-commissions"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "commission_withdrawal_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["employee-wallet", userId] });
        queryClient.invalidateQueries({ queryKey: ["rh-withdrawals"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payroll_entries" }, () => {
        queryClient.invalidateQueries({ queryKey: ["employee-wallet", userId] });
        queryClient.invalidateQueries({ queryKey: ["rh-payslips"] });
        queryClient.invalidateQueries({ queryKey: ["rh-latest-payslip"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payroll_commission_links" }, () => {
        queryClient.invalidateQueries({ queryKey: ["employee-wallet", userId] });
        queryClient.invalidateQueries({ queryKey: ["rh-payroll-commission-links"] });
        queryClient.invalidateQueries({ queryKey: ["payroll-commission-links"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return useQuery({
    queryKey: ["employee-wallet", userId],
    queryFn: async (): Promise<EmployeeWallet> => {
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
        payable_balance: Number(data.payable_balance) || 0,
        in_payroll_balance: Number(data.in_payroll_balance) || 0,
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
