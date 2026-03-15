import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OperationalFee {
  id: string;
  fee_key: string;
  label_fr: string;
  label_en: string | null;
  amount: number;
  fee_type: string;
  category: string;
  is_active: boolean;
  applies_when: Record<string, any>;
  display_order: number;
  notes: string | null;
}

/**
 * Canonical hook to fetch operational fees from the database.
 * Replaces all hardcoded fee constants across checkout, configurator, POS, etc.
 */
export function useCanonicalFees() {
  const { data: fees, isLoading } = useQuery({
    queryKey: ["canonical-operational-fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operational_fees")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) {
        console.error("[useCanonicalFees] Failed to load fees:", error);
        throw error;
      }
      return (data || []) as OperationalFee[];
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const getFee = (key: string): number => {
    const fee = fees?.find(f => f.fee_key === key);
    return fee ? Number(fee.amount) : 0;
  };

  const getFeeRecord = (key: string): OperationalFee | undefined => {
    return fees?.find(f => f.fee_key === key);
  };

  return {
    fees: fees || [],
    isLoading,
    getFee,
    getFeeRecord,
    // Convenience accessors matching the old hardcoded constants
    activationSingle: getFee("activation_single"),
    activationBundle: getFee("activation_bundle"),
    installationTechnician: getFee("installation_technician"),
    deliveryStandard: getFee("delivery_standard"),
    deliveryUber: getFee("delivery_uber"),
    deliveryShipHome: getFee("delivery_ship_home"),
    deliverySelfInstall: getFee("delivery_self_install"),
    equipmentRouter: getFee("equipment_router"),
    equipmentTerminal: getFee("equipment_terminal"),
    equipmentSim: getFee("equipment_sim"),
    equipmentEsim: getFee("equipment_esim"),
  };
}
