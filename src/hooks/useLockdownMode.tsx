import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LockdownConfig {
  enabled: boolean;
  activated_at: string | null;
  activated_by: string | null;
  message_fr: string;
  message_en: string;
}

const DEFAULT_CONFIG: LockdownConfig = {
  enabled: false,
  activated_at: null,
  activated_by: null,
  message_fr: "",
  message_en: "",
};

export const useLockdownMode = () => {
  const { data: lockdownConfig, isLoading } = useQuery({
    queryKey: ["total-lockdown"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("site_settings")
          .select("value_json")
          .eq("key", "total_lockdown")
          .maybeSingle();

        if (error || !data) return DEFAULT_CONFIG;
        return (data.value_json as unknown as LockdownConfig) ?? DEFAULT_CONFIG;
      } catch {
        return DEFAULT_CONFIG;
      }
    },
    // Safe default prevents the LockdownGuard from blocking render while the
    // query is pending — fixes the Secure Hub login redirect loop where the
    // guard returned null during OAuth session hydration.
    initialData: DEFAULT_CONFIG,
    placeholderData: DEFAULT_CONFIG,
    staleTime: 10000,
    refetchInterval: 15000,
    retry: false,
  });

  const isLockdownActive = (lockdownConfig?.enabled ?? false) === true;

  return {
    isLockdownActive,
    lockdownConfig,
    isLoading,
  };
};
