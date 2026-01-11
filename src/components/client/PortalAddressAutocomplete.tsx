/**
 * PortalAddressAutocomplete — Simple pass-through wrapper around AddressAutocomplete.
 * 
 * DEPRECATED: Use AddressAutocomplete directly from "@/components/shared/AddressAutocomplete"
 * This file exists only for backwards compatibility during migration.
 * 
 * All props are passed directly to AddressAutocomplete with no state management or logic changes.
 */
import { AddressAutocomplete, type AddressAutocompleteProps, type AddressValue } from "@/components/shared/AddressAutocomplete";

// Re-export types for backwards compatibility
export type { AddressValue };

export type PortalAddressAutocompleteProps = AddressAutocompleteProps;

export const PortalAddressAutocomplete = (props: PortalAddressAutocompleteProps) => {
  return <AddressAutocomplete {...props} />;
};

export default PortalAddressAutocomplete;
