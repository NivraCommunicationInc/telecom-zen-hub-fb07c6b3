import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LockdownConfig {
  enabled: boolean;
  activated_at: string | null;
  activated_by: string | null;
  message_fr: string;
  message_en: string;
}

export const useLockdownMode = () => {
  const { data: lockdownConfig, isLoading } = useQuery({
    queryKey: ["total-lockdown"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 2500);
      let result;
      try {
        result = await supabase
          .from("site_settings")
          .select("value_json")
          .eq("key", "total_lockdown")
          .abortSignal(controller.signal)
          .maybeSingle();
      } finally {
        window.clearTimeout(timeout);
      }

      const { data, error } = result;

      if (error || !data) {
        return { enabled: false, activated_at: null, activated_by: null, message_fr: "", message_en: "" };
      }

      return data.value_json as unknown as LockdownConfig;
    },
    initialData: { enabled: false, activated_at: null, activated_by: null, message_fr: "", message_en: "" },
    retry: false,
    staleTime: 10000, // Check every 10 seconds for security
    refetchInterval: 15000,
  });

  const isLockdownActive = lockdownConfig?.enabled ?? false;

  return {
    isLockdownActive,
    lockdownConfig,
    isLoading,
  };
};
