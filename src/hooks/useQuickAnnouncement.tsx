import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type QuickAnnouncementType = "info" | "warning" | "error" | "success";

export interface QuickAnnouncementConfig {
  active?: boolean;
  enabled?: boolean;
  message_fr: string;
  message_en: string;
  type: QuickAnnouncementType;
  link: string;
  link_text_fr?: string;
  link_text_en?: string;
  link_text?: string;
}

const DEFAULT: Required<Omit<QuickAnnouncementConfig, "enabled" | "link_text">> & { active: boolean } = {
  active: false,
  message_fr: "",
  message_en: "",
  type: "info",
  link: "",
  link_text_fr: "",
  link_text_en: "",
};

/**
 * useQuickAnnouncement
 * Reads the global quick-announcement banner config from site_settings.
 * Subscribes to Supabase Realtime so admin changes appear instantly site-wide.
 */
export const useQuickAnnouncement = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["site-settings", "quick_announcement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value_json")
        .eq("key", "quick_announcement")
        .maybeSingle();
      if (error || !data?.value_json) return DEFAULT;
      const raw = data.value_json as unknown as QuickAnnouncementConfig;
      return {
        ...DEFAULT,
        ...raw,
        active: Boolean(raw.active ?? raw.enabled ?? false),
        link_text_fr: raw.link_text_fr ?? raw.link_text ?? "",
        link_text_en: raw.link_text_en ?? raw.link_text ?? "",
      };
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("quick_announcement_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "site_settings",
          filter: "key=eq.quick_announcement",
        },
        (payload) => {
          console.log("[quick_announcement_realtime] change received", payload);
          queryClient.invalidateQueries({ queryKey: ["site-settings", "quick_announcement"] });
        },
      )
      .subscribe((status) => {
        console.log("[quick_announcement_realtime] status", status);
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { announcement: data ?? DEFAULT, isLoading };
};
