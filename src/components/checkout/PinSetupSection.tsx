import { backendClient } from "@/integrations/backend/client";
import { PinSetupSectionBase, validatePinSetup } from "./PinSetupSectionBase";

export { validatePinSetup };

export const PinSetupSection = (
  props: Omit<React.ComponentProps<typeof PinSetupSectionBase>, "supabaseClient">
) => {
  return <PinSetupSectionBase {...props} supabaseClient={backendClient} />;
};
