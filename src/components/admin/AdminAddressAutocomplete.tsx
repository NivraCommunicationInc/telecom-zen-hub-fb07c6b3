import AddressAutocompleteBase, { AddressAutocompleteBaseProps } from "@/components/AddressAutocompleteBase";
import { adminClient as adminSupabase } from "@/integrations/backend";

type AdminAddressAutocompleteProps = Omit<AddressAutocompleteBaseProps, "supabaseClient">;

/**
 * Admin-only Address Autocomplete using Mapbox.
 * Uses adminSupabase client to avoid session conflicts with portal.
 * 
 * Props:
 * - showDiagnostic: boolean (default: false) - Show diagnostic status line for debugging
 */
export const AdminAddressAutocomplete = (props: AdminAddressAutocompleteProps) => {
  return (
    <AddressAutocompleteBase 
      {...props}
      supabaseClient={adminSupabase}
    />
  );
};

export default AdminAddressAutocomplete;
