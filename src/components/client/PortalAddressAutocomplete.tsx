import AddressAutocompleteBase, { AddressAutocompleteBaseProps } from "@/components/AddressAutocompleteBase";
import { portalSupabase } from "@/integrations/supabase/portalClient";

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
