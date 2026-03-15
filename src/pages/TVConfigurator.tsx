import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tv, Wifi, Package, Film, Music, Globe2, Trophy, Users, Baby,
  Monitor, Truck, Wrench, ChevronRight, Check, Plus, Minus,
  ShieldCheck, Zap, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CartLineItem } from "@/lib/pricing/serverPricing";

/* ─── Canonical cart item with full metadata for checkout handoff ─── */
export interface TVConfiguratorCartItem extends CartLineItem {
  sku: string;
  recurrence: "monthly" | "one_time";
}

/**
 * Enriched payload persisted to sessionStorage for checkout pickup.
 * Contains both CartLineItem[] for pricing RPC and Service[] for wizard hydration.
 */
export interface TVCartPayload {
  source: "tv-configurator";
  version: 2;
  items: TVConfiguratorCartItem[];
  /** Pre-mapped services for direct wizard hydration (step 1 skip) */
  preSelectedServices: Array<{
    sku: string;
    name: string;
    price: number;
    category: string;
  }>;
  /** Terminal quantity for TV orders */
  terminalQuantity: number;
  /** Installation choice */
  installationChoice: "auto" | "technician" | null;
  /** Streaming add-on SKUs for cross-reference */
  streamingSkus: string[];
  /** Equipment SKUs selected */
  equipmentSkus: string[];
  /** Include shipping */
  includeShipping: boolean;
  /** Created timestamp for freshness check */
  createdAt: string;
}

/* ─── Canonical product catalog ─── */

interface TVProduct {
  sku: string;
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  price: number;
  type: "base" | "pack" | "streaming" | "equipment" | "fee";
  recurrence: "monthly" | "one_time";
  icon: React.ElementType;
  popular?: boolean;
  channels?: number;
  features?: string[];
  featuresFr?: string[];
}

const TV_PRODUCTS: TVProduct[] = [
  // Base package (required)
  {
    sku: "TV-ESS",
    name: "Nivra TV Essentiel",
    nameFr: "Nivra TV Essentiel",
    description: "70+ channels including HD news, entertainment & local stations",
    descriptionFr: "70+ chaînes incluant nouvelles HD, divertissement et stations locales",
    price: 25,
    type: "base",
    recurrence: "monthly",
    icon: Tv,
    channels: 70,
    features: ["HD channels", "Local stations", "News networks", "Basic entertainment"],
    featuresFr: ["Chaînes HD", "Stations locales", "Réseaux de nouvelles", "Divertissement de base"],
  },
  // Optional content packs
  {
    sku: "TV-PACK-DIV",
    name: "Entertainment Pack",
    nameFr: "Pack Divertissement",
    description: "25+ entertainment & lifestyle channels",
    descriptionFr: "25+ chaînes divertissement et style de vie",
    price: 12,
    type: "pack",
    recurrence: "monthly",
    icon: Film,
    channels: 25,
    popular: true,
  },
  {
    sku: "TV-PACK-SPORT",
    name: "Sports Pack",
    nameFr: "Pack Sports",
    description: "15+ sports channels including RDS, TSN & Sportsnet",
    descriptionFr: "15+ chaînes sportives incluant RDS, TSN et Sportsnet",
    price: 15,
    type: "pack",
    recurrence: "monthly",
    icon: Trophy,
    channels: 15,
  },
  {
    sku: "TV-PACK-CINEMA",
    name: "Cinema Pack",
    nameFr: "Pack Cinéma",
    description: "10+ movie channels with on-demand access",
    descriptionFr: "10+ chaînes cinéma avec accès sur demande",
    price: 14,
    type: "pack",
    recurrence: "monthly",
    icon: Monitor,
    channels: 10,
  },
  {
    sku: "TV-PACK-FAM",
    name: "Family Pack",
    nameFr: "Pack Famille",
    description: "20+ kids & family channels",
    descriptionFr: "20+ chaînes enfants et famille",
    price: 10,
    type: "pack",
    recurrence: "monthly",
    icon: Baby,
    channels: 20,
  },
  {
    sku: "TV-PACK-INTL",
    name: "International Pack",
    nameFr: "Pack International",
    description: "30+ international channels in multiple languages",
    descriptionFr: "30+ chaînes internationales en plusieurs langues",
    price: 18,
    type: "pack",
    recurrence: "monthly",
    icon: Globe2,
    channels: 30,
  },
  // Streaming add-ons
  {
    sku: "STR-NETFLIX",
    name: "Netflix Standard",
    nameFr: "Netflix Standard",
    description: "Stream on 2 devices in Full HD",
    descriptionFr: "Diffusion sur 2 appareils en Full HD",
    price: 16.49,
    type: "streaming",
    recurrence: "monthly",
    icon: Film,
  },
  {
    sku: "STR-DISNEY",
    name: "Disney+ Standard",
    nameFr: "Disney+ Standard",
    description: "Disney, Pixar, Marvel, Star Wars & more",
    descriptionFr: "Disney, Pixar, Marvel, Star Wars et plus",
    price: 9.99,
    type: "streaming",
    recurrence: "monthly",
    icon: Users,
  },
  {
    sku: "STR-PRIME",
    name: "Prime Video",
    nameFr: "Prime Video",
    description: "Thousands of movies & originals",
    descriptionFr: "Des milliers de films et d'originaux",
    price: 9.99,
    type: "streaming",
    recurrence: "monthly",
    icon: Zap,
  },
  {
    sku: "STR-SPOTIFY",
    name: "Spotify Premium",
    nameFr: "Spotify Premium",
    description: "Ad-free music streaming",
    descriptionFr: "Musique en continu sans publicité",
    price: 11.99,
    type: "streaming",
    recurrence: "monthly",
    icon: Music,
  },
  {
    sku: "STR-CRAVE",
    name: "Crave",
    nameFr: "Crave",
    description: "HBO, Showtime & Canadian originals",
    descriptionFr: "HBO, Showtime et originaux canadiens",
    price: 19.99,
    type: "streaming",
    recurrence: "monthly",
    icon: Film,
  },
  // Equipment
  {
    sku: "EQ-TVBOX",
    name: "Nivra TV Terminal",
    nameFr: "Terminal TV Nivra",
    description: "4K Smart Terminal with voice remote",
    descriptionFr: "Terminal intelligent 4K avec télécommande vocale",
    price: 50,
    type: "equipment",
    recurrence: "one_time",
    icon: Monitor,
  },
  {
    sku: "EQ-ROUTER",
    name: "Nivra Born WiFi Router",
    nameFr: "Routeur WiFi Nivra Born",
    description: "WiFi 6 dual-band router",
    descriptionFr: "Routeur WiFi 6 bi-bande",
    price: 60,
    type: "equipment",
    recurrence: "one_time",
    icon: Wifi,
  },
  // Fees
  {
    sku: "FEE-INSTALL",
    name: "Technician Installation",
    nameFr: "Installation par technicien",
    description: "Professional in-home setup by a Nivra technician",
    descriptionFr: "Installation professionnelle à domicile par un technicien Nivra",
    price: 75,
    type: "fee",
    recurrence: "one_time",
    icon: Wrench,
  },
  {
    sku: "FEE-DELIVERY",
    name: "Shipping & Handling",
    nameFr: "Livraison",
    description: "Equipment delivered to your door",
    descriptionFr: "Équipement livré à votre porte",
    price: 30,
    type: "fee",
    recurrence: "one_time",
    icon: Truck,
  },
];

/* ─── Tax constants (QC) — ESTIMATE ONLY, canonical math is server-side ─── */
const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

/* ─── Installation methods ─── */
type InstallMethod = "technician" | "self" | null;

/* ─── Component ─── */
const TVConfigurator = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isFr = language === "fr";

  // Selection state
  const [baseSelected, setBaseSelected] = useState(true);
  const [selectedPacks, setSelectedPacks] = useState<Set<string>>(new Set());
  const [selectedStreaming, setSelectedStreaming] = useState<Set<string>>(new Set());
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set(["EQ-TVBOX"]));
  const [extraTerminals, setExtraTerminals] = useState(0);
  const [installMethod, setInstallMethod] = useState<InstallMethod>(null);
  const [includeShipping, setIncludeShipping] = useState(true);

  const productMap = useMemo(() => {
    const map = new Map<string, TVProduct>();
    TV_PRODUCTS.forEach((p) => map.set(p.sku, p));
    return map;
  }, []);

  const toggleSet = (set: Set<string>, sku: string): Set<string> => {
    const next = new Set(set);
    if (next.has(sku)) next.delete(sku);
    else next.add(sku);
    return next;
  };

  /* ─── Pricing calculation ─── */
  const pricing = useMemo(() => {
    let recurringItems: { name: string; price: number }[] = [];
    let oneTimeItems: { name: string; price: number }[] = [];

    // Base
    if (baseSelected) {
      const base = productMap.get("TV-ESS")!;
      recurringItems.push({ name: isFr ? base.nameFr : base.name, price: base.price });
    }

    // Packs
    selectedPacks.forEach((sku) => {
      const p = productMap.get(sku)!;
      recurringItems.push({ name: isFr ? p.nameFr : p.name, price: p.price });
    });

    // Streaming
    selectedStreaming.forEach((sku) => {
      const p = productMap.get(sku)!;
      recurringItems.push({ name: isFr ? p.nameFr : p.name, price: p.price });
    });

    // Equipment
    selectedEquipment.forEach((sku) => {
      const p = productMap.get(sku)!;
      const qty = sku === "EQ-TVBOX" ? 1 + extraTerminals : 1;
      oneTimeItems.push({ name: `${isFr ? p.nameFr : p.name}${qty > 1 ? ` ×${qty}` : ""}`, price: p.price * qty });
    });

    // Activation fee (canonical)
    if (baseSelected) {
      oneTimeItems.push({ name: isFr ? "Frais d'activation" : "Activation fee", price: 25 });
    }

    // Installation
    if (installMethod === "technician") {
      const inst = productMap.get("FEE-INSTALL")!;
      oneTimeItems.push({ name: isFr ? inst.nameFr : inst.name, price: inst.price });
    }

    // Shipping
    if (includeShipping && selectedEquipment.size > 0) {
      const ship = productMap.get("FEE-DELIVERY")!;
      oneTimeItems.push({ name: isFr ? ship.nameFr : ship.name, price: ship.price });
    }

    const recurringSubtotal = recurringItems.reduce((s, i) => s + i.price, 0);
    const oneTimeSubtotal = oneTimeItems.reduce((s, i) => s + i.price, 0);
    const taxableBase = recurringSubtotal + oneTimeSubtotal;
    // ESTIMATE ONLY — canonical taxes computed server-side by compute_checkout_pricing RPC
    const tps = Math.round(taxableBase * TPS_RATE * 100) / 100;
    const tvq = Math.round(taxableBase * TVQ_RATE * 100) / 100;
    const grandTotal = Math.round((taxableBase + tps + tvq) * 100) / 100;

    return { recurringItems, oneTimeItems, recurringSubtotal, oneTimeSubtotal, tps, tvq, grandTotal };
  }, [baseSelected, selectedPacks, selectedStreaming, selectedEquipment, extraTerminals, installMethod, includeShipping, isFr, productMap]);

  /* ─── Activation fee (canonical: 1 service = $25, 2+ = $45) ─── */
  const activationFee = useMemo(() => {
    // TV counts as 1 service type; packs/streaming don't count as separate types
    return baseSelected ? 25 : 0;
  }, [baseSelected]);

  /* ─── Build Core-compatible cart with full SKU metadata ─── */
  const buildCartItems = (): TVConfiguratorCartItem[] => {
    const items: TVConfiguratorCartItem[] = [];

    // Base TV service
    if (baseSelected) {
      items.push({ type: "service", sku: "TV-ESS", name: "Nivra TV Essentiel", amount: 25, quantity: 1, recurrence: "monthly" });
    }

    // Content packs (recurring)
    selectedPacks.forEach((sku) => {
      const p = productMap.get(sku)!;
      items.push({ type: "service", sku: p.sku, name: p.name, amount: p.price, quantity: 1, recurrence: "monthly" });
    });

    // Streaming add-ons (recurring, must be individually itemized per canonical standard)
    selectedStreaming.forEach((sku) => {
      const p = productMap.get(sku)!;
      items.push({ type: "service", sku: p.sku, name: p.name, amount: p.price, quantity: 1, recurrence: "monthly" });
    });

    // Equipment (one-time)
    selectedEquipment.forEach((sku) => {
      const p = productMap.get(sku)!;
      const qty = sku === "EQ-TVBOX" ? 1 + extraTerminals : 1;
      items.push({ type: "equipment", sku: p.sku, name: p.name, amount: p.price, quantity: qty, recurrence: "one_time" });
    });

    // Activation fee (one-time, canonical)
    if (activationFee > 0) {
      items.push({ type: "activation", sku: "FEE-ACT-1", name: "Frais d'activation", amount: activationFee, quantity: 1, recurrence: "one_time" });
    }

    // Installation fee (one-time)
    if (installMethod === "technician") {
      items.push({ type: "installation", sku: "FEE-INSTALL", name: "Installation par technicien", amount: 75, quantity: 1, recurrence: "one_time" });
    }

    // Shipping (one-time)
    if (includeShipping && selectedEquipment.size > 0) {
      items.push({ type: "delivery", sku: "FEE-DELIVERY", name: "Livraison", amount: 30, quantity: 1, recurrence: "one_time" });
    }

    return items;
  };

  const handleContinue = () => {
    const items = buildCartItems();

    // Build enriched payload for checkout handoff
    const payload: TVCartPayload = {
      source: "tv-configurator",
      version: 2,
      items,
      preSelectedServices: [
        // Base TV
        ...(baseSelected ? [{ sku: "TV-ESS", name: "Nivra TV Essentiel", price: 25, category: "TV" }] : []),
        // Content packs map to TV category
        ...Array.from(selectedPacks).map((sku) => {
          const p = productMap.get(sku)!;
          return { sku: p.sku, name: p.name, price: p.price, category: "TV" };
        }),
      ],
      terminalQuantity: selectedEquipment.has("EQ-TVBOX") ? 1 + extraTerminals : 0,
      installationChoice: installMethod === "technician" ? "technician" : installMethod === "self" ? "auto" : null,
      streamingSkus: Array.from(selectedStreaming),
      equipmentSkus: Array.from(selectedEquipment),
      includeShipping,
      createdAt: new Date().toISOString(),
    };

    // Write enriched payload — read by ClientNewOrder on mount
    sessionStorage.setItem("nivra_tv_cart", JSON.stringify(payload));
    navigate("/portal/new-order");
  };

  const getName = (p: TVProduct) => (isFr ? p.nameFr : p.name);
  const getDesc = (p: TVProduct) => (isFr ? p.descriptionFr : p.description);

  const base = productMap.get("TV-ESS")!;
  const packs = TV_PRODUCTS.filter((p) => p.type === "pack");
  const streamingAddons = TV_PRODUCTS.filter((p) => p.type === "streaming");
  const equipment = TV_PRODUCTS.filter((p) => p.type === "equipment");

  const fmt = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " $";

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#003366] via-[#002244] to-[#001a33]">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white/20 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 max-w-[1320px] py-16 md:py-24 relative z-10">
          <div className="max-w-3xl">
            <Badge className="bg-white/15 text-white border-white/20 mb-6 text-sm px-4 py-1.5">
              <Tv className="w-4 h-4 mr-2" />
              {isFr ? "Configurateur TV" : "TV Configurator"}
            </Badge>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              {isFr ? "Télévision sur mesure" : "Custom Television"}
            </h1>
            <p className="text-lg md:text-xl text-blue-100/80 leading-relaxed max-w-2xl">
              {isFr
                ? "Composez votre forfait TV idéal. Choisissez vos chaînes, ajoutez vos plateformes de streaming préférées et personnalisez votre expérience de divertissement."
                : "Build your ideal TV package. Choose your channels, add your favorite streaming platforms and customize your entertainment experience."}
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-[1320px] py-8 md:py-12">
        <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 xl:gap-12">
          {/* ─── LEFT: Configurator ─── */}
          <div className="space-y-8 md:space-y-10">

            {/* § 1 — Base Package (required) */}
            <section>
              <SectionLabel step={1} label={isFr ? "Forfait de base requis" : "Required base package"} />
              <Card className={cn(
                "border-2 transition-all",
                baseSelected ? "border-primary shadow-md" : "border-border"
              )}>
                <CardContent className="p-5 md:p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Tv className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-foreground">{getName(base)}</h3>
                        <Badge variant="secondary" className="text-xs">{isFr ? "Requis" : "Required"}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{getDesc(base)}</p>
                      <div className="flex flex-wrap gap-2">
                        {(isFr ? base.featuresFr! : base.features!).map((f) => (
                          <span key={f} className="inline-flex items-center text-xs bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
                            <Check className="w-3 h-3 mr-1 text-primary" />{f}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-foreground">{base.price.toFixed(2)} $</div>
                      <div className="text-xs text-muted-foreground">{isFr ? "/mois" : "/mo"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* § 2 — Content Packs */}
            <section>
              <SectionLabel step={2} label={isFr ? "Packs de contenu optionnels" : "Optional content packs"} />
              <div className="grid sm:grid-cols-2 gap-4">
                {packs.map((p) => {
                  const selected = selectedPacks.has(p.sku);
                  return (
                    <Card
                      key={p.sku}
                      className={cn(
                        "border-2 cursor-pointer transition-all hover:shadow-md group",
                        selected ? "border-primary bg-primary/[0.02] shadow-sm" : "border-border hover:border-primary/40"
                      )}
                      onClick={() => setSelectedPacks(toggleSet(selectedPacks, p.sku))}
                    >
                      <CardContent className="p-4 md:p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                              selected ? "bg-primary text-white" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                            )}>
                              <p.icon className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground text-sm">{getName(p)}</h4>
                              {p.channels && (
                                <span className="text-xs text-muted-foreground">{p.channels}+ {isFr ? "chaînes" : "channels"}</span>
                              )}
                            </div>
                          </div>
                          {p.popular && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
                              {isFr ? "Populaire" : "Popular"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{getDesc(p)}</p>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">{p.price.toFixed(2)} $<span className="text-xs font-normal text-muted-foreground">/{isFr ? "mois" : "mo"}</span></span>
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                            selected ? "bg-primary border-primary" : "border-muted-foreground/30"
                          )}>
                            {selected && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* § 3 — Streaming Add-ons */}
            <section>
              <SectionLabel step={3} label={isFr ? "Ajouts Streaming" : "Streaming add-ons"} />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {streamingAddons.map((p) => {
                  const selected = selectedStreaming.has(p.sku);
                  return (
                    <div
                      key={p.sku}
                      onClick={() => setSelectedStreaming(toggleSet(selectedStreaming, p.sku))}
                      className={cn(
                        "flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all",
                        selected ? "border-primary bg-primary/[0.02]" : "border-border hover:border-primary/30"
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        selected ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                      )}>
                        <p.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground truncate">{getName(p)}</div>
                        <div className="text-xs text-muted-foreground">{p.price.toFixed(2)} $/{isFr ? "mois" : "mo"}</div>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                        selected ? "bg-primary border-primary" : "border-muted-foreground/30"
                      )}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* § 4 — Equipment */}
            <section>
              <SectionLabel step={4} label={isFr ? "Équipement" : "Equipment"} />
              <div className="space-y-3">
                {equipment.map((p) => {
                  const selected = selectedEquipment.has(p.sku);
                  const isTerminal = p.sku === "EQ-TVBOX";
                  return (
                    <Card key={p.sku} className={cn(
                      "border-2 transition-all",
                      selected ? "border-primary shadow-sm" : "border-border"
                    )}>
                      <CardContent className="p-4 md:p-5">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center",
                            selected ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                          )}>
                            <p.icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground text-sm">{getName(p)}</h4>
                            <p className="text-xs text-muted-foreground">{getDesc(p)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-foreground whitespace-nowrap">{p.price.toFixed(2)} $</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = new Set(selectedEquipment);
                                if (selected) next.delete(p.sku); else next.add(p.sku);
                                setSelectedEquipment(next);
                              }}
                              className={cn(
                                "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors",
                                selected ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-primary"
                              )}
                            >
                              {selected ? <Check className="w-3.5 h-3.5 text-white" /> : <Plus className="w-3.5 h-3.5 text-muted-foreground" />}
                            </button>
                          </div>
                        </div>
                        {isTerminal && selected && (
                          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">{isFr ? "Terminaux supplémentaires" : "Extra terminals"}</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setExtraTerminals(Math.max(0, extraTerminals - 1))}
                                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
                                disabled={extraTerminals === 0}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center font-semibold text-foreground">{extraTerminals}</span>
                              <button
                                onClick={() => setExtraTerminals(Math.min(4, extraTerminals + 1))}
                                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* § 5 — Installation */}
            <section>
              <SectionLabel step={5} label={isFr ? "Installation et livraison" : "Installation & delivery"} />
              <div className="grid sm:grid-cols-2 gap-4">
                <Card
                  className={cn(
                    "border-2 cursor-pointer transition-all hover:shadow-md",
                    installMethod === "technician" ? "border-primary bg-primary/[0.02]" : "border-border"
                  )}
                  onClick={() => setInstallMethod(installMethod === "technician" ? null : "technician")}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        installMethod === "technician" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                      )}>
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground text-sm">{isFr ? "Installation technicien" : "Technician installation"}</h4>
                        <span className="text-xs text-muted-foreground">75,00 $</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isFr
                        ? "Un technicien Nivra se déplace chez vous pour une installation complète."
                        : "A Nivra technician comes to your home for a complete setup."}
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className={cn(
                    "border-2 cursor-pointer transition-all hover:shadow-md",
                    installMethod === "self" ? "border-primary bg-primary/[0.02]" : "border-border"
                  )}
                  onClick={() => setInstallMethod(installMethod === "self" ? null : "self")}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        installMethod === "self" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                      )}>
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground text-sm">{isFr ? "Auto-installation" : "Self-install"}</h4>
                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700">{isFr ? "Gratuit" : "Free"}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isFr
                        ? "Recevez votre équipement et suivez notre guide d'installation simple."
                        : "Receive your equipment and follow our simple installation guide."}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {selectedEquipment.size > 0 && (
                <div className="mt-4 flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30">
                  <Truck className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">{isFr ? "Livraison" : "Shipping"}</span>
                    <span className="text-sm text-muted-foreground ml-2">— 30,00 $</span>
                  </div>
                  <button
                    onClick={() => setIncludeShipping(!includeShipping)}
                    className={cn(
                      "w-6 h-6 rounded border-2 flex items-center justify-center transition-colors",
                      includeShipping ? "bg-primary border-primary" : "border-muted-foreground/30"
                    )}
                  >
                    {includeShipping && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                </div>
              )}
            </section>

            {/* Mobile CTA */}
            <div className="lg:hidden">
              <MobileSummary pricing={pricing} isFr={isFr} onContinue={handleContinue} fmt={fmt} />
            </div>
          </div>

          {/* ─── RIGHT: Sticky Summary (desktop) ─── */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <Card className="border-2 border-border shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    {isFr ? "Résumé de votre forfait" : "Your package summary"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Recurring */}
                  {pricing.recurringItems.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        {isFr ? "Services mensuels" : "Monthly services"}
                      </h4>
                      <div className="space-y-1.5">
                        {pricing.recurringItems.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-foreground truncate pr-2">{item.name}</span>
                            <span className="text-foreground font-medium whitespace-nowrap">{item.price.toFixed(2)} $</span>
                          </div>
                        ))}
                      </div>
                      <Separator className="my-3" />
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-foreground">{isFr ? "Sous-total mensuel" : "Monthly subtotal"}</span>
                        <span className="text-foreground">{pricing.recurringSubtotal.toFixed(2)} $</span>
                      </div>
                    </div>
                  )}

                  {/* One-time */}
                  {pricing.oneTimeItems.length > 0 && (
                    <div>
                      <Separator className="my-2" />
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        {isFr ? "Frais uniques" : "One-time fees"}
                      </h4>
                      <div className="space-y-1.5">
                        {pricing.oneTimeItems.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-foreground truncate pr-2">{item.name}</span>
                            <span className="text-foreground font-medium whitespace-nowrap">{item.price.toFixed(2)} $</span>
                          </div>
                        ))}
                      </div>
                      <Separator className="my-3" />
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-foreground">{isFr ? "Sous-total unique" : "One-time subtotal"}</span>
                        <span className="text-foreground">{pricing.oneTimeSubtotal.toFixed(2)} $</span>
                      </div>
                    </div>
                  )}

                  {/* Taxes (ESTIMATE — canonical taxes computed at checkout) */}
                  <div className="pt-1">
                    <Separator className="mb-3" />
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>TPS (5%) <span className="italic">{isFr ? "est." : "est."}</span></span>
                        <span>~{pricing.tps.toFixed(2)} $</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>TVQ (9,975%) <span className="italic">{isFr ? "est." : "est."}</span></span>
                        <span>~{pricing.tvq.toFixed(2)} $</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 mt-1 italic">
                      {isFr ? "Montants estimés — taxes finales calculées au paiement" : "Estimated — final taxes calculated at checkout"}
                    </p>
                  </div>

                  {/* Grand Total */}
                  <div className="bg-muted/50 -mx-6 px-6 py-4 rounded-b-lg mt-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{isFr ? "Total estimé aujourd'hui" : "Estimated total today"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {isFr ? "Puis" : "Then"} ~{pricing.recurringSubtotal.toFixed(2)} $/{isFr ? "mois" : "mo"} + {isFr ? "taxes" : "tax"}
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-foreground">~{fmt(pricing.grandTotal)}</div>
                    </div>
                  </div>

                  <Button
                    onClick={handleContinue}
                    className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90"
                    disabled={!baseSelected}
                  >
                    {isFr ? "Continuer vers la commande" : "Continue to checkout"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>

                  <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                    {isFr
                      ? "Prépayé • Sans contrat • Annulable en tout temps"
                      : "Prepaid • No contract • Cancel anytime"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Sub-components ─── */

function SectionLabel({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">
        {step}
      </div>
      <h2 className="text-lg md:text-xl font-bold text-foreground">{label}</h2>
    </div>
  );
}

function MobileSummary({
  pricing,
  isFr,
  onContinue,
  fmt,
}: {
  pricing: ReturnType<any>;
  isFr: boolean;
  onContinue: () => void;
  fmt: (n: number) => string;
}) {
  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardContent className="p-5 space-y-4">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          {isFr ? "Résumé" : "Summary"}
        </h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{isFr ? "Mensuel" : "Monthly"}</span>
            <span className="font-semibold text-foreground">{pricing.recurringSubtotal.toFixed(2)} $</span>
          </div>
          {pricing.oneTimeSubtotal > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isFr ? "Frais uniques" : "One-time"}</span>
              <span className="font-semibold text-foreground">{pricing.oneTimeSubtotal.toFixed(2)} $</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>TPS + TVQ <span className="italic">{isFr ? "est." : "est."}</span></span>
            <span>~{(pricing.tps + pricing.tvq).toFixed(2)} $</span>
          </div>
          <Separator />
          <div className="flex justify-between items-center pt-1">
            <span className="font-bold text-foreground">{isFr ? "Total estimé" : "Estimated total"}</span>
            <span className="text-xl font-bold text-foreground">~{fmt(pricing.grandTotal)}</span>
          </div>
        </div>

        <Button onClick={onContinue} className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90">
          {isFr ? "Continuer" : "Continue"}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default TVConfigurator;
