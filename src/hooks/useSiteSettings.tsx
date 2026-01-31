import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";

export interface SiteSettings {
  support_email: string;
  support_phone: string;
  business_hours: string;
  address: string;
  outage_banner_enabled: boolean;
  outage_banner_message_fr: string;
  outage_banner_message_en: string;
}

const defaultSettings: SiteSettings = {
  support_email: "support@nivratelecom.com",
  support_phone: "438-544-2233",
  business_hours: "Lun–Ven : 9AM – 10PM | Sam–Dim : 9AM – 8PM",
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  outage_banner_enabled: false,
  outage_banner_message_fr: "",
  outage_banner_message_en: "",
};

export function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await backendClient
        .from("site_settings")
        .select("key, value_text")
        .eq("is_public", true);

      if (error) {
        console.error("Failed to fetch site settings:", error);
        return defaultSettings;
      }

      const settings: SiteSettings = { ...defaultSettings };

      data?.forEach((row) => {
        switch (row.key) {
          case "support_email":
            settings.support_email = row.value_text || defaultSettings.support_email;
            break;
          case "support_phone":
            settings.support_phone = row.value_text || defaultSettings.support_phone;
            break;
          case "business_hours":
            settings.business_hours = row.value_text || defaultSettings.business_hours;
            break;
          case "address":
            settings.address = row.value_text || defaultSettings.address;
            break;
          case "outage_banner_enabled":
            settings.outage_banner_enabled = row.value_text === "true";
            break;
          case "outage_banner_message_fr":
            settings.outage_banner_message_fr = row.value_text || "";
            break;
          case "outage_banner_message_en":
            settings.outage_banner_message_en = row.value_text || "";
            break;
        }
      });

      return settings;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
