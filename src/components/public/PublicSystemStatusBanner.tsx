import { SystemStatusBannerBase } from "@/components/SystemStatusBannerBase";
import { supabase } from "@/integrations/supabase/client";

/**
 * Public-facing System Status Banner.
 * Displays maintenance, incident, and announcement banners on the public website.
 * Uses the standard supabase client (no auth required for public viewing).
 */
export const PublicSystemStatusBanner = () => {
  return (
    <SystemStatusBannerBase 
      userType="public" 
      supabaseClient={supabase} 
    />
  );
};

export default PublicSystemStatusBanner;
