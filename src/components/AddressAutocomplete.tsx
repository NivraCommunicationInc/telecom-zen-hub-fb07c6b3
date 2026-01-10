import type { ComponentProps } from "react";
import type { AddressDetails } from "./AddressAutocompleteBase";
import AddressAutocompleteBase from "./AddressAutocompleteBase";
import { backendClient } from "@/integrations/backend/client";

export type { AddressDetails };

type AddressAutocompleteProps = Omit<ComponentProps<typeof AddressAutocompleteBase>, "supabaseClient">;

/**
 * Public/shared Address Autocomplete using Mapbox.
 * Uses backendClient for public-facing forms.
 * 
 * Props:
 * - showDiagnostic: boolean (default: false) - Show diagnostic status line for debugging
 */
export default function AddressAutocomplete(props: AddressAutocompleteProps) {
  return <AddressAutocompleteBase {...props} supabaseClient={backendClient} />;
}
