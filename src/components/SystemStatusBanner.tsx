import type { ComponentProps } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  SystemStatusBanner as SystemStatusBannerBase,
  SystemStatusIndicator as SystemStatusIndicatorBase,
  ServiceStatusCards as ServiceStatusCardsBase,
} from "./SystemStatusBannerBase";

// Keep existing module API for admin/general usage.
export const SystemStatusBanner = (
  props: Omit<ComponentProps<typeof SystemStatusBannerBase>, "supabaseClient">
) => <SystemStatusBannerBase {...props} supabaseClient={supabase} />;

export const SystemStatusIndicator = (
  props: Omit<ComponentProps<typeof SystemStatusIndicatorBase>, "supabaseClient"> = {}
) => <SystemStatusIndicatorBase {...props} supabaseClient={supabase} />;

export const ServiceStatusCards = (
  props: Omit<ComponentProps<typeof ServiceStatusCardsBase>, "supabaseClient">
) => <ServiceStatusCardsBase {...props} supabaseClient={supabase} />;

export default SystemStatusBanner;

