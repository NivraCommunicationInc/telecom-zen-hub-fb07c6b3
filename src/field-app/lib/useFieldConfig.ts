/**
 * Hook to fetch admin-configurable field sales settings from DB.
 * Replaces all hardcoded business rules (activation fees, goals, limits).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FieldConfig {
  activation_fee_single: number;
  activation_fee_multi: number;
  daily_sales_goal: number;
  monthly_sales_goal: number;
  monthly_revenue_goal: number;
  monthly_commission_goal: number;
  monthly_leads_goal: number;
  monthly_leads_converted_goal: number;
  monthly_conversion_rate_goal: number;
  monthly_streets_goal: number;
  monthly_doors_goal: number;
  max_router_qty: number;
  max_borne_qty: number;
  max_terminal_qty: number;
  max_sim_qty: number;
  preauth_discount_amount: number;
  shipping_fee_cents: number;
  prorata_basis_days: number;
  checkout_draft_ttl_days: number;
}

const DEFAULTS: FieldConfig = {
  activation_fee_single: 10,
  activation_fee_multi: 45,
  daily_sales_goal: 3,
  monthly_sales_goal: 20,
  monthly_revenue_goal: 5000,
  monthly_commission_goal: 1500,
  monthly_leads_goal: 50,
  monthly_leads_converted_goal: 10,
  monthly_conversion_rate_goal: 40,
  monthly_streets_goal: 15,
  monthly_doors_goal: 500,
  max_router_qty: 1,
  max_borne_qty: 3,
  max_terminal_qty: 5,
  max_sim_qty: 5,
  preauth_discount_amount: 5,
  shipping_fee_cents: 2000,
  prorata_basis_days: 30,
  checkout_draft_ttl_days: 30,
};

export function useFieldConfig() {
  return useQuery({
    queryKey: ["field-sales-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_sales_config" as any)
        .select("config_key, config_value, config_type");

      if (error || !data) return DEFAULTS;

      const config = { ...DEFAULTS };
      for (const row of data as any[]) {
        const key = row.config_key as keyof FieldConfig;
        if (key in config) {
          if (row.config_type === "number") {
            (config as any)[key] = Number(row.config_value) || DEFAULTS[key];
          } else if (row.config_type === "boolean") {
            (config as any)[key] = row.config_value === "true";
          } else {
            (config as any)[key] = row.config_value;
          }
        }
      }
      return config;
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

/** Helper to compute activation fee from config */
export function getActivationFee(config: FieldConfig, serviceCount: number): number {
  if (serviceCount === 0) return 0;
  return serviceCount === 1 ? config.activation_fee_single : config.activation_fee_multi;
}
