import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchNivraProducts, mapProductTypeToCategory, type NivraProduct } from "@/lib/api/nivraApi";

export interface PublicService {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  description: string | null;
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

// Parse speed from service name or description
const extractSpeed = (name: string, description: string): string => {
  const speedMatch = name.match(/(\d+)\s*(Mbps|Gbps|Giga)/i) || description.match(/(\d+)\s*(Mbps|Gbps)/i);
  if (speedMatch) {
    const value = parseInt(speedMatch[1]);
    const unit = speedMatch[2].toLowerCase();
    if (unit === "giga" || unit === "gbps" || value >= 940) {
      return "940 Mbps";
    }
    return `${value} Mbps`;
  }
  if (name.toLowerCase().includes("giga")) return "940 Mbps";
  return "100 Mbps";
};

// Parse channel count from description
const extractChannels = (description: string): number => {
  const match = description.match(/(\d+)\s*chaîne/i);
  return match ? parseInt(match[1]) : 26;
};

// Parse data amounts from description
const extractDataInfo = (description: string): { autoTopUp: string; noTopUp: string } => {
  const autoMatch = description.match(/Auto.*?:\s*(\d+)\s*GB/i);
  const noMatch = description.match(/No.*?:\s*(\d+)\s*GB/i);
  return {
    autoTopUp: autoMatch ? `${autoMatch[1]} GB 4G` : "50 GB 4G",
    noTopUp: noMatch ? `${noMatch[1]} GB 4G` : "55 GB 4G",
  };
};

/**
 * Fetch active services from the database (admin-managed source of truth).
 * Falls back to Nivra external API if DB returns empty.
 */
export function usePublicServices() {
  return useQuery({
    queryKey: ["public-services"],
    queryFn: async () => {
      // Primary source: database services_public view (admin-managed)
      const { data: dbServices, error } = await supabase
        .from("services_public")
        .select("id, name, category, price, description, billing_type")
        .order("category", { ascending: true })
        .order("price", { ascending: true });

      if (!error && dbServices && dbServices.length > 0) {
        return dbServices.map((s): PublicService => ({
          id: s.id || "",
          sku: "",
          name: s.name || "",
          category: s.category || "",
          price: Number(s.price) || 0,
          description: s.description || null,
        }));
      }

      // Fallback: external API (for backward compatibility during transition)
      console.warn("[usePublicServices] DB empty or error, falling back to external API");
      const products = await fetchNivraProducts();
      return products.map((p): PublicService => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: mapProductTypeToCategory(p.product_type),
        price: p.base_price,
        description: null,
      }));
    },
    staleTime: 30 * 1000, // 30 seconds — picks up admin changes quickly
    refetchOnWindowFocus: true,
  });
}

export function useInternetPlans(isFrench: boolean) {
  const { data: services = [], isLoading, error } = usePublicServices();

  const internetPlans: InternetPlan[] = services
    .filter((s) => s.category === "Internet")
    .map((s, index) => {
      const speed = extractSpeed(s.name, s.description || "");
      const isGiga = speed === "940 Mbps" || s.name.toLowerCase().includes("giga");
      const is500 = speed === "500 Mbps";

      return {
        id: s.id,
        sku: s.sku || "",
        name: s.name,
        speed,
        price: Number(s.price),
        description: s.description || "",
        features: [
          isFrench ? `Téléchargement jusqu'à ${speed}` : `Download up to ${speed}`,
          isFrench ? "Données illimitées" : "Unlimited data",
          isFrench ? "Routeur Nivra Born Wifi inclus" : "Nivra Born Wifi router included",
          isGiga
            ? isFrench ? "Support technique VIP" : "VIP technical support"
            : is500
            ? isFrench ? "Support technique prioritaire" : "Priority technical support"
            : isFrench ? "Support technique 7j/7" : "24/7 technical support",
          ...(isGiga ? [isFrench ? "Latence ultra-faible" : "Ultra-low latency"] : []),
          ...(is500 || isGiga ? [isFrench ? "Streaming 4K sans interruption" : "Uninterrupted 4K streaming"] : []),
        ],
        badge: isGiga
          ? isFrench ? "VITESSE GIGA" : "GIGA SPEED"
          : is500
          ? isFrench ? "MEILLEUR VENDEUR" : "BEST SELLER"
          : isFrench ? "OFFRE POPULAIRE" : "POPULAR OFFER",
        badgeColor: isGiga ? "bg-purple-500" : is500 ? "bg-accent" : "bg-blue-500",
        featured: is500,
      };
    });

  return { plans: internetPlans, isLoading, error };
}

export function useMobilePlans(isFrench: boolean) {
  const { data: services = [], isLoading, error } = usePublicServices();

  const mobilePlans: MobilePlan[] = services
    .filter((s) => s.category === "Mobile")
    .map((s, index) => {
      const dataInfo = extractDataInfo(s.description || "");
      const is60 = Number(s.price) >= 60;

      return {
        id: s.id,
        sku: s.sku || "",
        name: s.name,
        price: Number(s.price),
        description: s.description || "",
        dataAutoTopUp: dataInfo.autoTopUp,
        dataNoAutoTopUp: dataInfo.noTopUp,
        features: [
          isFrench ? "Appels Canada illimités" : "Unlimited Canada calls",
          isFrench ? "Textos/MMS internationaux illimités" : "Unlimited international texts/MMS",
          isFrench ? "Messagerie vocale" : "Voicemail",
          isFrench ? "Afficheur" : "Caller ID",
          isFrench ? "Mise en attente" : "Call waiting",
          isFrench ? "Renvoi d'appel" : "Call forwarding",
          isFrench ? "Conférence" : "Conference calling",
        ],
        badge: is60 ? (isFrench ? "POPULAIRE" : "POPULAR") : (isFrench ? "ÉCONOMIQUE" : "VALUE"),
        badgeColor: is60 ? "bg-cyan-500" : "bg-blue-500",
        featured: is60,
      };
    });

  return { plans: mobilePlans, isLoading, error };
}

export function useTVPlans(isFrench: boolean) {
  const { data: services = [], isLoading, error } = usePublicServices();

  const tvServices = services.filter((s) => s.category === "TV");

  // Separate standard (500Mbps) and GIGA plans
  const standardPlans: TVPlan[] = tvServices
    .filter((s) => !s.name.toLowerCase().includes("giga"))
    .map((s) => {
      const channels = extractChannels(s.description || "");
      const isBasic = s.name.toLowerCase().includes("basic");
      const choicesMatch = s.name.match(/(\d+)\s*choix/i);
      const choices = choicesMatch ? parseInt(choicesMatch[1]) : 0;
      const is10Choices = choices === 10;
      const is15Choices = choices === 15;
      const is25Choices = choices === 25;
      const speed = s.name.includes("100") ? "100 Mbps" : "500 Mbps";

      return {
        id: s.id,
        sku: s.sku || "",
        name: s.name,
        internetSpeed: speed,
        price: Number(s.price),
        channels,
        channelType: isBasic
          ? isFrench ? "chaînes générales" : "general channels"
          : isFrench ? "chaînes populaires" : "popular channels",
        description: s.description || "",
        features: [
          isFrench ? `Internet ${speed} inclus` : `Internet ${speed} included`,
          isFrench ? `${channels} chaînes` : `${channels} channels`,
          ...(choices > 0 ? [isFrench ? `${choices} chaînes au choix` : `${choices} channels of your choice`] : []),
          isFrench ? "Nivra 4K Smart Terminal" : "Nivra 4K Smart Terminal",
          ...(!isBasic && choices >= 5 ? [isFrench ? "Télécommande vocale" : "Voice control remote"] : []),
          ...(is25Choices ? [isFrench ? "Support prioritaire VIP" : "VIP priority support"] : []),
        ],
        badge: is25Choices
          ? "PREMIUM"
          : is15Choices
          ? isFrench ? "ÉCONOMIE 26%" : "SAVE 26%"
          : is10Choices
          ? isFrench ? "MEILLEUR VENDEUR" : "BEST SELLER"
          : choices === 5
          ? isFrench ? "POPULAIRE" : "POPULAR"
          : isFrench ? "ÉCONOMIQUE" : "VALUE",
        badgeColor: is25Choices
          ? "bg-purple-500"
          : is15Choices
          ? "bg-emerald-500"
          : is10Choices
          ? "bg-accent"
          : choices === 5
          ? "bg-cyan-500"
          : "bg-blue-500",
        featured: is10Choices,
      };
    });

  const gigaPlans: TVPlan[] = tvServices
    .filter((s) => s.name.toLowerCase().includes("giga"))
    .map((s) => {
      const channels = extractChannels(s.description || "");
      const isBasic = s.name.toLowerCase().includes("basic");
      const choicesMatch = s.name.match(/(\d+)\s*choix/i);
      const choices = choicesMatch ? parseInt(choicesMatch[1]) : 0;
      const is10Choices = choices === 10;
      const is15Choices = choices === 15;
      const is25Choices = choices === 25;

      return {
        id: s.id,
        sku: s.sku || "",
        name: s.name,
        internetSpeed: "1 Gbps",
        price: Number(s.price),
        channels,
        channelType: isBasic
          ? isFrench ? "chaînes générales" : "general channels"
          : isFrench ? "chaînes populaires + sports" : "popular + sports channels",
        description: s.description || "",
        features: [
          isFrench ? "Internet GIGA 1 Gbps inclus" : "GIGA 1 Gbps Internet included",
          isFrench ? `${channels} chaînes` : `${channels} channels`,
          ...(choices > 0 ? [isFrench ? `${choices} chaînes au choix` : `${choices} channels of your choice`] : []),
          isFrench ? "Nivra 4K Smart Terminal" : "Nivra 4K Smart Terminal",
          ...(!isBasic && choices >= 5 ? [isFrench ? "Télécommande vocale" : "Voice control remote"] : []),
          ...(is25Choices ? [isFrench ? "Support prioritaire VIP" : "VIP priority support"] : []),
        ],
        badge: is25Choices
          ? isFrench ? "GIGA ULTIME" : "GIGA ULTIMATE"
          : is15Choices
          ? isFrench ? "GIGA FAMILLE" : "GIGA FAMILY"
          : is10Choices
          ? isFrench ? "GIGA VEDETTE" : "GIGA STAR"
          : choices === 5
          ? isFrench ? "GIGA POPULAIRE" : "GIGA POPULAR"
          : "GIGA",
        badgeColor: "bg-gradient-to-r from-orange-500 to-red-500",
        featured: is10Choices,
      };
    });

  return { standardPlans, gigaPlans, isLoading, error };
}

export function useEquipmentPrices() {
  const { data: services = [], isLoading, error } = usePublicServices();

  // Equipment and fees come from different categories in the API
  const allItems = services;

  const findBySkuOrName = (sku: string, namePart: string, fallback: number): number => {
    const bySku = allItems.find((s) => s.sku === sku);
    if (bySku) return Number(bySku.price);
    const byName = allItems.find((e) => e.name.toLowerCase().includes(namePart));
    if (byName) return Number(byName.price);
    return fallback;
  };

  return {
    routerPrice: findBySkuOrName("EQ-ROUTER", "router", 60),
    simPrice: findBySkuOrName("FEE-SIM", "carte sim", 25),
    esimPrice: findBySkuOrName("FEE-ESIM", "esim", 25),
    terminalPrice: findBySkuOrName("EQ-TVBOX", "terminal", 50),
    isLoading,
    error,
  };
}
