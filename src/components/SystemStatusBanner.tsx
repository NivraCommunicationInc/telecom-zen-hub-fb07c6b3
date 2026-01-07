import type { ComponentProps } from "react";
import { backendClient } from "@/integrations/backend/client";
import {
  SystemStatusBannerBase,
  SystemStatusIndicator as SystemStatusIndicatorBase,
  ServiceStatusCards as ServiceStatusCardsBase,
} from "./SystemStatusBannerBase";

// Keep existing module API for admin/general usage.
export const SystemStatusBanner = (
  props: Omit<ComponentProps<typeof SystemStatusBannerBase>, "supabaseClient">
) => <SystemStatusBannerBase {...props} supabaseClient={backendClient} />;

export const SystemStatusIndicator = (
  props: Omit<ComponentProps<typeof SystemStatusIndicatorBase>, "supabaseClient"> = {}
) => <SystemStatusIndicatorBase {...props} supabaseClient={backendClient} />;

export const ServiceStatusCards = (
  props: Omit<ComponentProps<typeof ServiceStatusCardsBase>, "supabaseClient">
) => <ServiceStatusCardsBase {...props} supabaseClient={backendClient} />;

export default SystemStatusBanner;
