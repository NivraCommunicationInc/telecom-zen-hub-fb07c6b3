import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SitePage {
  id: string;
  slug: string;
  title_fr: string;
  title_en: string | null;
  body_fr: string;
  body_en: string | null;
  meta_description_fr: string | null;
  meta_description_en: string | null;
  is_published: boolean;
  updated_at: string;
}

export function useSitePage(slug: string) {
  return useQuery({
    queryKey: ["site-page", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_pages")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();

      if (error) {
        console.error("Failed to fetch site page:", error);
        return null;
      }

      return data as SitePage | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSitePages() {
  return useQuery({
    queryKey: ["site-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_pages")
        .select("slug, title_fr, title_en, is_published, updated_at")
        .eq("is_published", true)
        .order("title_fr");

      if (error) {
        console.error("Failed to fetch site pages:", error);
        return [];
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
