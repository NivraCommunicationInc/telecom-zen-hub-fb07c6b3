import { SystemStatusBannerBase } from "@/components/SystemStatusBannerBase";
import { portalSupabase } from "@/integrations/supabase/portalClient";

interface PortalSystemStatusBannerProps {
  userType?: "public" | "client" | "admin";
}

/**
 * Portal-only System Status Banner.
 * Uses portalSupabase client to avoid session conflicts with admin.
 */
export const PortalSystemStatusBanner = ({ userType = "client" }: PortalSystemStatusBannerProps) => {
  return (
    <SystemStatusBannerBase 
      userType={userType} 
      supabaseClient={portalSupabase} 
    />
  );
};
