import { PinSetupSectionBase, PinSetupSectionBaseProps } from "@/components/checkout/PinSetupSectionBase";
import { portalSupabase } from "@/integrations/backend/portalClient";

type PortalPinSetupSectionProps = Omit<PinSetupSectionBaseProps, "supabaseClient">;

/**
 * Portal-only PIN Setup Section.
 * Uses portalSupabase client to avoid session conflicts with admin.
 */
export const PortalPinSetupSection = (props: PortalPinSetupSectionProps) => {
  return (
    <PinSetupSectionBase 
      {...props}
      supabaseClient={portalSupabase}
    />
  );
};
