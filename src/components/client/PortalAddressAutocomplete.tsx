import AddressAutocompleteBase, { AddressAutocompleteBaseProps } from "@/components/AddressAutocompleteBase";
import { portalClient as portalSupabase } from "@/integrations/backend";

type PortalAddressAutocompleteProps = Omit<AddressAutocompleteBaseProps, "supabaseClient">;

/**
 * Portal-only Address Autocomplete using Mapbox.
 * Uses portalSupabase client to avoid session conflicts with admin.
 * 
 * Props:
 * - showDiagnostic: boolean (default: false) - Show diagnostic status line for debugging
 */
export const PortalAddressAutocomplete = (props: PortalAddressAutocompleteProps) => {
  return (
    <AddressAutocompleteBase 
      {...props}
      supabaseClient={portalSupabase}
    />
  );
};
