import { TVChannelSelectionBase, TVChannelSelectionBaseProps } from "@/components/checkout/TVChannelSelectionBase";
import { portalSupabase } from "@/integrations/backend/portalClient";

type PortalTVChannelSelectionProps = Omit<TVChannelSelectionBaseProps, "supabaseClient">;

/**
 * Portal-only TV Channel Selection.
 * Uses portalSupabase client to avoid session conflicts with admin.
 */
export const PortalTVChannelSelection = (props: PortalTVChannelSelectionProps) => {
  return (
    <TVChannelSelectionBase 
      {...props}
      supabaseClient={portalSupabase}
    />
  );
};
