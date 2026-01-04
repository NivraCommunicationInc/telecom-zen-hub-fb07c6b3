import { supabase } from "@/integrations/supabase/client";
import { TVChannelSelectionBase } from "./TVChannelSelectionBase";

export const TVChannelSelection = (
  props: Omit<React.ComponentProps<typeof TVChannelSelectionBase>, "supabaseClient">
) => {
  return <TVChannelSelectionBase {...props} supabaseClient={supabase} />;
};
