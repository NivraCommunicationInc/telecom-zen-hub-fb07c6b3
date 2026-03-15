import { useState, useMemo, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tv, Wifi, Package, Film, Music, Monitor, Truck, Wrench,
  Check, Plus, Minus, ShieldCheck, Zap, ArrowRight, MonitorPlay, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Canonical cart payload for checkout handoff ─── */

export interface TVCartPayload {
  source: "tv-configurator";
  version: 3;
  /** Exact services_public.id of the selected TV plan */
  selectedPlanId: string;
  /** Exact streaming_services.id[] for selected streaming add-ons */
  selectedStreamingIds: string[];
  /** Exact services_public.id for Terminal equipment */
  terminalProductId: string | null;
  terminalQuantity: number;
  /** Exact services_public.id for Router equipment */
  routerProductId: string | null;
  /** Installation choice */
  installationChoice: "auto" | "technician" | null;
  /** Include shipping */
  includeShipping: boolean;
  /** Created timestamp for freshness check */
  createdAt: string;
}

/* ─── Tax constants (QC) — ESTIMATE ONLY, canonical math is server-side ─── */
const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

/* ─── Known operational fee amounts (not product catalog items) ─── */
const ACTIVATION_FEE = 25;
const INSTALL_FEE = 75;
const SHIPPING_FEE = 30;

type InstallMethod = "technician" | "self" | null;

/* ─── DB types ─── */
interface ServicePublic {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string | null;
  billing_type: string | null;
}

interface StreamingService {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  category: string | null;
  features: any;
  is_active: boolean | null;
}

/* ─── Component ─── */
const TVConfigurator = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isFr = language === "fr";

  // ─── Load canonical products from DB ───
  const { data: allServices = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["tv-configurator-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services_public")
        .select("id, name, category, price, description, billing_type")
        .order("category", { ascending: true })
        .order("price", { ascending: true });
      if (error) throw error;
      return (data || []) as ServicePublic[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: streamingServices = [], isLoading: streamingLoading } = useQuery({
    queryKey: ["tv-configurator-streaming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_services")
        .select("id, name, description, monthly_price, category, features, is_active")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("monthly_price", { ascending: true });
      if (error) throw error;
      return (data || []) as StreamingService[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // ─── Derived product lists from canonical source ───
  const tvPlans = useMemo(() => allServices.filter(s => s.category === "TV"), [allServices]);
  const equipmentProducts = useMemo(() => allServices.filter(s => s.category === "Équipement"), [allServices]);

  const terminalProduct = useMemo(
    () => equipmentProducts.find(e => e.name.toLowerCase().includes("terminal")),
    [equipmentProducts]
  );
  const routerProduct = useMemo(
    () => equipmentProducts.find(e => e.name.toLowerCase().includes("router")),
    [equipmentProducts]
  );

  const videoStreaming = useMemo(() => streamingServices.filter(s => s.category === "video"), [streamingServices]);
  const musicStreaming = useMemo(() => streamingServices.filter(s => s.category === "music"), [streamingServices]);

  // ─── Selection state ───
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedStreamingIds, setSelectedStreamingIds] = useState<Set<string>>(new Set());
  const [includeTerminal, setIncludeTerminal] = useState(true);
  const [extraTerminals, setExtraTerminals] = useState(0);
  const [includeRouter, setIncludeRouter] = useState(true);
  const [installMethod, setInstallMethod] = useState<InstallMethod>(null);
  const [includeShipping, setIncludeShipping] = useState(true);

  // Auto-select first TV plan once loaded
  useEffect(() => {
    if (tvPlans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(tvPlans[0].id);
    }
  }, [tvPlans, selectedPlanId]);

  const selectedPlan = useMemo(
    () => tvPlans.find(p => p.id === selectedPlanId) || null,
    [tvPlans, selectedPlanId]
  );

  const toggleStreaming = (id: string) => {
    setSelectedStreamingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ─── Pricing calculation (ESTIMATES — canonical math is server-side) ─── */
  const pricing = useMemo(() => {
    const recurringItems: { name: string; price: number }[] = [];
    const oneTimeItems: { name: string; price: number }[] = [];

    // Selected TV plan (recurring)
    if (selectedPlan) {
      recurringItems.push({ name: selectedPlan.name, price: selectedPlan.price });
    }

    // Streaming add-ons (recurring)
    selectedStreamingIds.forEach(id => {
      const svc = streamingServices.find(s => s.id === id);
      if (svc) recurringItems.push({ name: svc.name, price: svc.monthly_price });
    });

    // Equipment (one-time)
    if (includeTerminal && terminalProduct) {
      const qty = 1 + extraTerminals;
      oneTimeItems.push({
        name: `${terminalProduct.name}${qty > 1 ? ` ×${qty}` : ""}`,
        price: terminalProduct.price * qty,
      });
    }
    if (includeRouter && routerProduct) {
      oneTimeItems.push({ name: routerProduct.name, price: routerProduct.price });
    }

    // Activation fee
    if (selectedPlan) {
      oneTimeItems.push({ name: isFr ? "Frais d'activation" : "Activation fee", price: ACTIVATION_FEE });
    }

    // Installation
    if (installMethod === "technician") {
      oneTimeItems.push({ name: isFr ? "Installation par technicien" : "Technician installation", price: INSTALL_FEE });
    }

    // Shipping
    if (includeShipping && (includeTerminal || includeRouter)) {
      oneTimeItems.push({ name: isFr ? "Livraison" : "Shipping", price: SHIPPING_FEE });
    }

    const recurringSubtotal = recurringItems.reduce((s, i) => s + i.price, 0);
    const oneTimeSubtotal = oneTimeItems.reduce((s, i) => s + i.price, 0);
    const taxableBase = recurringSubtotal + oneTimeSubtotal;
    const tps = Math.round(taxableBase * TPS_RATE * 100) / 100;
    const tvq = Math.round(taxableBase * TVQ_RATE * 100) / 100;
    const grandTotal = Math.round((taxableBase + tps + tvq) * 100) / 100;

    return { recurringItems, oneTimeItems, recurringSubtotal, oneTimeSubtotal, tps, tvq, grandTotal };
  }, [selectedPlan, selectedStreamingIds, streamingServices, includeTerminal, terminalProduct, extraTerminals, includeRouter, routerProduct, installMethod, includeShipping, isFr]);

  /* ─── Build canonical payload for checkout handoff ─── */
  const handleContinue = () => {
    if (!selectedPlanId) return;

    const payload: TVCartPayload = {
      source: "tv-configurator",
      version: 3,
      selectedPlanId,
      selectedStreamingIds: Array.from(selectedStreamingIds),
      terminalProductId: includeTerminal && terminalProduct ? terminalProduct.id : null,
      terminalQuantity: includeTerminal ? 1 + extraTerminals : 0,
      routerProductId: includeRouter && routerProduct ? routerProduct.id : null,
      installationChoice: installMethod === "technician" ? "technician" : installMethod === "self" ? "auto" : null,
      includeShipping: includeShipping && (includeTerminal || includeRouter),
      createdAt: new Date().toISOString(),
    };

    sessionStorage.setItem("nivra_tv_cart", JSON.stringify(payload));
    navigate("/portal/new-order");
  };

  const fmt = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " $";

  const isLoading = servicesLoading || streamingLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">{isFr ? "Chargement du configurateur..." : "Loading configurator..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(var(--primary)/1)] via-[hsl(var(--primary)/0.85)] to-[hsl(var(--primary)/0.7)]">
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
            <p className="text-lg md:text-xl text-white/70 leading-relaxed max-w-2xl">
              {isFr
                ? "Composez votre forfait TV idéal. Choisissez votre plan Internet + TV, ajoutez vos plateformes de streaming préférées et personnalisez votre expérience."
                : "Build your ideal TV package. Choose your Internet + TV plan, add your favorite streaming platforms and customize your experience."}
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-[1320px] py-8 md:py-12">
        <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 xl:gap-12">
          {/* ─── LEFT: Configurator ─── */}
          <div className="space-y-8 md:space-y-10">

            {/* § 1 — TV Plan Selection (from services_public) */}
            <section>
              <SectionLabel step={1} label={isFr ? "Choisissez votre forfait Internet + TV" : "Choose your Internet + TV plan"} />
              <div className="space-y-3">
                {tvPlans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <Card
                      key={plan.id}
                      className={cn(
                        "border-2 cursor-pointer transition-all hover:shadow-md",
                        isSelected ? "border-primary shadow-md bg-primary/[0.02]" : "border-border hover:border-primary/40"
                      )}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      <CardContent className="p-5 md:p-6">
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                            isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                          )}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-foreground mb-1">{plan.name}</h3>
                            {plan.description && (
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {plan.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-2xl font-bold text-foreground">{plan.price.toFixed(2)} $</div>
                            <div className="text-xs text-muted-foreground">/{isFr ? "mois" : "mo"}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {tvPlans.length === 0 && (
                  <Card className="border-border">
                    <CardContent className="py-8 text-center">
                      <p className="text-muted-foreground">{isFr ? "Aucun forfait TV disponible" : "No TV plans available"}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>

            {/* § 2 — Streaming Add-ons (from streaming_services) */}
            {streamingServices.length > 0 && (
              <section>
                <SectionLabel step={2} label={isFr ? "Ajouts Streaming (optionnel)" : "Streaming add-ons (optional)"} />

                {videoStreaming.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                      <MonitorPlay className="w-4 h-4" /> {isFr ? "Vidéo & Films" : "Video & Movies"}
                    </p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {videoStreaming.map((svc) => (
                        <StreamingCard
                          key={svc.id}
                          service={svc}
                          selected={selectedStreamingIds.has(svc.id)}
                          onToggle={() => toggleStreaming(svc.id)}
                          isFr={isFr}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {musicStreaming.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
                      <Music className="w-4 h-4" /> {isFr ? "Musique" : "Music"}
                    </p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {musicStreaming.map((svc) => (
                        <StreamingCard
                          key={svc.id}
                          service={svc}
                          selected={selectedStreamingIds.has(svc.id)}
                          onToggle={() => toggleStreaming(svc.id)}
                          isFr={isFr}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* § 3 — Equipment (from services_public, Équipement category) */}
            <section>
              <SectionLabel step={3} label={isFr ? "Équipement" : "Equipment"} />
              <div className="space-y-3">
                {/* Terminal */}
                {terminalProduct && (
                  <Card className={cn(
                    "border-2 transition-all",
                    includeTerminal ? "border-primary shadow-sm" : "border-border"
                  )}>
                    <CardContent className="p-4 md:p-5">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center",
                          includeTerminal ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          <Monitor className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground text-sm">{terminalProduct.name}</h4>
                          <p className="text-xs text-muted-foreground">{terminalProduct.description}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-foreground whitespace-nowrap">{terminalProduct.price.toFixed(2)} $</span>
                          <button
                            onClick={() => setIncludeTerminal(!includeTerminal)}
                            className={cn(
                              "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors",
                              includeTerminal ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-primary"
                            )}
                          >
                            {includeTerminal ? <Check className="w-3.5 h-3.5 text-primary-foreground" /> : <Plus className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                        </div>
                      </div>
                      {includeTerminal && (
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
                )}

                {/* Router */}
                {routerProduct && (
                  <Card className={cn(
                    "border-2 transition-all",
                    includeRouter ? "border-primary shadow-sm" : "border-border"
                  )}>
                    <CardContent className="p-4 md:p-5">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center",
                          includeRouter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          <Wifi className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground text-sm">{routerProduct.name}</h4>
                          <p className="text-xs text-muted-foreground">{routerProduct.description}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-foreground whitespace-nowrap">{routerProduct.price.toFixed(2)} $</span>
                          <button
                            onClick={() => setIncludeRouter(!includeRouter)}
                            className={cn(
                              "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors",
                              includeRouter ? "bg-primary border-primary" : "border-muted-foreground/30 hover:border-primary"
                            )}
                          >
                            {includeRouter ? <Check className="w-3.5 h-3.5 text-primary-foreground" /> : <Plus className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>

            {/* § 4 — Installation & Delivery */}
            <section>
              <SectionLabel step={4} label={isFr ? "Installation et livraison" : "Installation & delivery"} />
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
                        installMethod === "technician" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground text-sm">{isFr ? "Installation technicien" : "Technician installation"}</h4>
                        <span className="text-xs text-muted-foreground">{INSTALL_FEE.toFixed(2)} $</span>
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
                        installMethod === "self" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
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

              {(includeTerminal || includeRouter) && (
                <div className="mt-4 flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30">
                  <Truck className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">{isFr ? "Livraison" : "Shipping"}</span>
                    <span className="text-sm text-muted-foreground ml-2">— {SHIPPING_FEE.toFixed(2)} $</span>
                  </div>
                  <button
                    onClick={() => setIncludeShipping(!includeShipping)}
                    className={cn(
                      "w-6 h-6 rounded border-2 flex items-center justify-center transition-colors",
                      includeShipping ? "bg-primary border-primary" : "border-muted-foreground/30"
                    )}
                  >
                    {includeShipping && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                  </button>
                </div>
              )}
            </section>

            {/* Mobile CTA */}
            <div className="lg:hidden">
              <MobileSummary pricing={pricing} isFr={isFr} onContinue={handleContinue} fmt={fmt} disabled={!selectedPlanId} />
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

                  {/* Taxes (ESTIMATE) */}
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
                    className="w-full h-12 text-base font-semibold"
                    disabled={!selectedPlanId}
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
      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
        {step}
      </div>
      <h2 className="text-lg md:text-xl font-bold text-foreground">{label}</h2>
    </div>
  );
}

function StreamingCard({
  service,
  selected,
  onToggle,
  isFr,
}: {
  service: { id: string; name: string; description: string | null; monthly_price: number };
  selected: boolean;
  onToggle: () => void;
  isFr: boolean;
}) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        "flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all",
        selected ? "border-primary bg-primary/[0.02]" : "border-border hover:border-primary/30"
      )}
    >
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
        selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        <MonitorPlay className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-foreground truncate">{service.name}</div>
        <div className="text-xs text-muted-foreground">{service.monthly_price.toFixed(2)} $/{isFr ? "mois" : "mo"}</div>
      </div>
      <div className={cn(
        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
        selected ? "bg-primary border-primary" : "border-muted-foreground/30"
      )}>
        {selected && <Check className="w-3 h-3 text-primary-foreground" />}
      </div>
    </div>
  );
}

function MobileSummary({
  pricing,
  isFr,
  onContinue,
  fmt,
  disabled,
}: {
  pricing: any;
  isFr: boolean;
  onContinue: () => void;
  fmt: (n: number) => string;
  disabled: boolean;
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

        <Button onClick={onContinue} className="w-full h-12 text-base font-semibold" disabled={disabled}>
          {isFr ? "Continuer" : "Continue"}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default TVConfigurator;
