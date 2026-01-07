import type { ComponentProps } from "react";
import type { AddressDetails } from "./AddressAutocompleteBase";
import AddressAutocompleteBase from "./AddressAutocompleteBase";
import { supabase } from "@/integrations/backend/client";

export type { AddressDetails };

// Wrapper that keeps the legacy import path for non-portal usage.
// Portal routes must use the portal-specific wrapper to avoid depending on the global client.
export default function AddressAutocomplete(
  props: Omit<ComponentProps<typeof AddressAutocompleteBase>, "supabaseClient">
) {
  return <AddressAutocompleteBase {...props} supabaseClient={supabase} />;
}

