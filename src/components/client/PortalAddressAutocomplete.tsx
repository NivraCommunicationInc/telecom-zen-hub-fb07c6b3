import AddressAutocompleteBase, { AddressAutocompleteBaseProps } from "@/components/AddressAutocompleteBase";
import { portalClient as portalSupabase } from "@/integrations/backend";

type PortalAddressAutocompleteProps = Omit<AddressAutocompleteBaseProps, "supabaseClient">;

/**
 * Portal-only Address Autocomplete.
 * Uses portalSupabase client to avoid session conflicts with admin.
 */
export const PortalAddressAutocomplete = (props: PortalAddressAutocompleteProps) => {
  return (
    <AddressAutocompleteBase 
      {...props}
      supabaseClient={portalSupabase}
    />
  );
};
