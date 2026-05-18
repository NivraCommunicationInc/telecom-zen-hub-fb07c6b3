import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

export type CatalogSurface = "website" | "checkout" | "simulator" | "portal" | "all";

export interface PublicService {
  id: string;
  sku: string;
  name: string;
  short_description: string | null;
  description: string | null;
  category: string;
  price: number;
  billing_type: string | null;
  display_order: number;
  tags: string[];
  badges: string[];
  features_json: string[];
  is_featured: boolean;
  is_recommended: boolean;
  promo_eligible: boolean;
  visible_website: boolean;
  visible_simulator: boolean;
  visible_checkout: boolean;
  visible_portal: boolean;
  status: string | null;
  activation_fee_rule: string | null;
  installation_fee_rule: string | null;
  shipping_fee_rule: string | null;
}

export interface InternetPlan {
  id: string;
  sku: string;
  name: string;
  speed: string;
  price: number;
  description: string;
  features: string[];
  badge?: string;
  badgeColor?: string;
  featured?: boolean;
}

export interface MobilePlan {
  id: string;
  sku: string;
  name: string;
  price: number;
  description: string;
  dataAutoTopUp: string;
  dataNoAutoTopUp: string;
  features: string[];
  badge?: string;
  badgeColor?: string;
  featured?: boolean;
}

export interface TVPlan {
  id: string;
  sku: string;
  name: string;
  internetSpeed: string;
  price: number;
  previousPrice?: number;
  channels: number;
  channelType: string;
  description: string;
  features: string[];
  badge?: string;
  badgeColor?: string;
  featured?: boolean;
}

export interface Equipment {
  id: string;
  sku: string;
  name: string;
  price: number;
  description: string;
}

interface UsePublicServicesOptions {
  surface?: CatalogSurface;
  categories?: string[];
}

const visibilityColumnBySurface: Record<Exclude<CatalogSurface, "all">, keyof PublicService> = {
  website: "visible_website",
  checkout: "visible_checkout",
  simulator: "visible_simulator",
  portal: "visible_portal",
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
};

const splitDescriptionFeatures = (description?: string | null): string[] => {
  if (!description) return [];
  return description
    .split(/•|\||\n|;/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
};

const extractSpeed = (name: string, description: string): string => {
  const speedMatch = name.match(/(\d+)\s*(Mbps|Gbps|Giga)/i) || description.match(/(\d+)\s*(Mbps|Gbps)/i);
  if (speedMatch) {
    const value = parseInt(speedMatch[1]);
    const unit = speedMatch[2].toLowerCase();
    if (unit === "giga" || unit === "gbps" || value >= 940) return "940 Mbps";
    return `${value} Mbps`;
  }
  if (name.toLowerCase().includes("giga")) return "940 Mbps";
  return "100 Mbps";
};

const extractChannels = (description: string): number => {
  const match = description.match(/(\d+)\s*chaîne/i);
  return match ? parseInt(match[1]) : 26;
};

const extractDataInfo = (description: string): { autoTopUp: string; noTopUp: string } => {
  const autoMatch = description.match(/Auto.*?:\s*(\d+)\s*GB/i);
  const noMatch = description.match(/No.*?:\s*(\d+)\s*GB/i);

  return {
    autoTopUp: autoMatch ? `${autoMatch[1]} GB 4G` : "55 GB 4G",
    noTopUp: noMatch ? `${noMatch[1]} GB 4G` : "50 GB 4G",
  };
};

/**
 * Canonical public catalog hook.
 * Reads ONLY from services_public (admin-managed) and filters by visibility surface.
 */
export function usePublicServices(options: UsePublicServicesOptions = {}) {
  const { surface = "website", categories } = options;
  const queryClient = useQueryClient();
  const categoryKey = categories?.slice().sort().join("|") || "all";

  useEffect(() => {
    const channel = supabase
      .channel(`services-realtime-sync-${surface}-${categoryKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "services" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["public-services"] });
          queryClient.invalidateQueries({ queryKey: ["available-services"] });
          queryClient.invalidateQueries({ queryKey: ["tv-configurator-services"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, surface, categoryKey]);

  return useQuery({
    queryKey: ["public-services", surface, categoryKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services_public")
        .select(
          "id, name, short_description, description, category, price, billing_type, display_order, tags, badges, features_json, is_featured, is_recommended, promo_eligible, visible_website, visible_simulator, visible_checkout, visible_portal, status, activation_fee_rule, installation_fee_rule, shipping_fee_rule",
        )
        .order("category", { ascending: true })
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("price", { ascending: true });

      if (error) {
        console.error("[usePublicServices] Failed to load catalog:", error);
        throw error;
      }

      const rows = (data || []) as any[];
      const visibilityColumn = surface === "all" ? null : visibilityColumnBySurface[surface];

      return rows
        .filter((row) => {
          if (row.status && row.status !== "active") return false;
          if (visibilityColumn && row[visibilityColumn] === false) return false;
          if (categories?.length && (!row.category || !categories.includes(row.category))) return false;
          return true;
        })
        .map(
          (row): PublicService => ({
            id: row.id || "",
            sku: "",
            name: row.name || "",
            short_description: row.short_description || null,
            description: row.description || null,
            category: row.category || "",
            price: Number(row.price) || 0,
            billing_type: row.billing_type || null,
            display_order: Number(row.display_order) || 0,
            tags: toStringArray(row.tags),
            badges: toStringArray(row.badges),
            features_json: toStringArray(row.features_json),
            is_featured: Boolean(row.is_featured),
            is_recommended: Boolean(row.is_recommended),
            promo_eligible: Boolean(row.promo_eligible),
            visible_website: row.visible_website !== false,
            visible_simulator: Boolean(row.visible_simulator),
            visible_checkout: row.visible_checkout !== false,
            visible_portal: row.visible_portal !== false,
            status: row.status || null,
            activation_fee_rule: row.activation_fee_rule || null,
            installation_fee_rule: row.installation_fee_rule || null,
            shipping_fee_rule: row.shipping_fee_rule || null,
          }),
        );
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useInternetPlans(isFrench: boolean) {
  const { data: services = [], isLoading, error } = usePublicServices({
    surface: "website",
    categories: ["Internet"],
  });

  const internetPlans: InternetPlan[] = services.map((s) => {
    const speed = extractSpeed(s.name, s.description || "");
    const isGiga = speed === "940 Mbps" || s.name.toLowerCase().includes("giga");
    const is500 = speed === "500 Mbps";

    const fallbackFeatures = [
      isFrench ? `Téléchargement jusqu'à ${speed}` : `Download up to ${speed}`,
      isFrench ? "Données illimitées" : "Unlimited data",
      isFrench ? "Routeur Nivra Born Wifi inclus" : "Nivra Born Wifi router included",
      isGiga
        ? isFrench
          ? "Support technique VIP"
          : "VIP technical support"
        : is500
          ? isFrench
            ? "Support technique prioritaire"
            : "Priority technical support"
          : isFrench
            ? "Support technique 7j/7"
            : "24/7 technical support",
    ];

    return {
      id: s.id,
      sku: s.sku || "",
      name: s.name,
      speed,
      price: Number(s.price),
      description: s.short_description || s.description || "",
      features: s.features_json.length > 0 ? s.features_json : fallbackFeatures,
      badge:
        s.badges[0] ||
        (isGiga ? (isFrench ? "VITESSE GIGA" : "GIGA SPEED") : is500 ? (isFrench ? "MEILLEUR VENDEUR" : "BEST SELLER") : isFrench ? "OFFRE POPULAIRE" : "POPULAR OFFER"),
      badgeColor: isGiga ? "bg-purple-500" : is500 ? "bg-accent" : "bg-blue-500",
      featured: Boolean(s.is_featured || s.is_recommended),
    };
  });

  return { plans: internetPlans, isLoading, error };
}

export function useMobilePlans(isFrench: boolean) {
  const { data: services = [], isLoading, error } = usePublicServices({
    surface: "website",
    categories: ["Mobile"],
  });

  const mobilePlans: MobilePlan[] = services.map((s) => {
    const dataInfo = extractDataInfo(s.description || "");
    const isPremium = Number(s.price) >= 60;

    const fallbackFeatures = [
      isFrench ? "Appels Canada illimités" : "Unlimited Canada calls",
      isFrench ? "Textos/MMS internationaux illimités" : "Unlimited international texts/MMS",
      isFrench ? "Messagerie vocale" : "Voicemail",
      isFrench ? "Afficheur" : "Caller ID",
      isFrench ? "Mise en attente" : "Call waiting",
    ];

    return {
      id: s.id,
      sku: s.sku || "",
      name: s.name,
      price: Number(s.price),
      description: s.short_description || s.description || "",
      dataAutoTopUp: dataInfo.autoTopUp,
      dataNoAutoTopUp: dataInfo.noTopUp,
      features: s.features_json.length > 0 ? s.features_json : fallbackFeatures,
      badge: s.badges[0] || (isPremium ? (isFrench ? "POPULAIRE" : "POPULAR") : isFrench ? "ÉCONOMIQUE" : "VALUE"),
      badgeColor: isPremium ? "bg-cyan-500" : "bg-blue-500",
      featured: Boolean(s.is_featured || s.is_recommended),
    };
  });

  return { plans: mobilePlans, isLoading, error };
}

export function useTVPlans(isFrench: boolean) {
  const { data: services = [], isLoading, error } = usePublicServices({
    surface: "website",
    categories: ["TV"],
  });

  const tvServices = services;

  const mapTVPlan = (s: PublicService, isGigaPlan: boolean): TVPlan => {
    const channels = extractChannels(s.description || "");
    const lowerName = s.name.toLowerCase();
    const isBasic = lowerName.includes("basic");
    const choicesMatch = s.name.match(/(\d+)\s*choix/i);
    const choices = choicesMatch ? parseInt(choicesMatch[1]) : 0;

    const fallbackFeatures = [
      isFrench
        ? `${isGigaPlan ? "Internet GIGA" : "Internet"} ${isGigaPlan ? "1 Gbps" : "500 Mbps"} inclus`
        : `${isGigaPlan ? "GIGA 1 Gbps" : "500 Mbps"} internet included`,
      isFrench ? `${channels} chaînes` : `${channels} channels`,
      ...(choices > 0 ? [isFrench ? `${choices} chaînes au choix` : `${choices} channels of your choice`] : []),
      isFrench ? "Nivra 4K Smart Terminal" : "Nivra 4K Smart Terminal",
    ];

    return {
      id: s.id,
      sku: s.sku || "",
      name: s.name,
      internetSpeed: isGigaPlan ? "1 Gbps" : s.name.includes("100") ? "100 Mbps" : "500 Mbps",
      price: Number(s.price),
      channels,
      channelType: isBasic
        ? isFrench
          ? "chaînes générales"
          : "general channels"
        : isFrench
          ? "chaînes populaires"
          : "popular channels",
      description: s.short_description || s.description || "",
      features: s.features_json.length > 0 ? s.features_json : fallbackFeatures,
      badge: s.badges[0] || (isGigaPlan ? "GIGA" : isFrench ? "POPULAIRE" : "POPULAR"),
      badgeColor: isGigaPlan ? "bg-gradient-to-r from-orange-500 to-red-500" : "bg-accent",
      featured: Boolean(s.is_featured || s.is_recommended),
    };
  };

  const standardPlans = tvServices.filter((s) => !s.name.toLowerCase().includes("giga")).map((s) => mapTVPlan(s, false));
  const gigaPlans = tvServices.filter((s) => s.name.toLowerCase().includes("giga")).map((s) => mapTVPlan(s, true));

  return { standardPlans, gigaPlans, isLoading, error };
}

export function useEquipmentPrices() {
  const { data: equipment = [], isLoading, error } = usePublicServices({
    surface: "all",
    categories: ["Équipement"],
  });

  const findByName = (namePart: string, fallback: number): number => {
    const match = equipment.find((item) => item.name.toLowerCase().includes(namePart));
    return match ? Number(match.price) : fallback;
  };

  return {
    routerPrice: findByName("router", findByName("borne", 60)),
    simPrice: findByName("sim", 25),
    esimPrice: findByName("esim", 25),
    terminalPrice: findByName("terminal", 50),
    isLoading,
    error,
  };
}
