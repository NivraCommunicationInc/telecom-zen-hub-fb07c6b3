import { useState, useMemo, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tv, Wifi, Monitor, Truck, Wrench, Check, Plus, Minus,
  ShieldCheck, ArrowRight, MonitorPlay, Loader2, Package, Music,
  Sparkles, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

/* ─── Canonical cart payload for checkout handoff ─── */

export interface TVCartPayload {
  source: "tv-configurator";
  version: 3;
  selectedPlanId: string;
  selectedStreamingIds: string[];
  terminalProductId: string | null;
  terminalQuantity: number;
  routerProductId: string | null;
  installationChoice: "auto" | "technician" | null;
  includeShipping: boolean;
  createdAt: string;
}

/* ─── Tax constants (QC) — ESTIMATE ONLY, canonical math is server-side via compute_checkout_pricing ─── */
const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

/**
 * CANONICAL FEE VALUES — sourced from real Nivra checkout (ClientNewOrder.tsx)
 * 
 * Activation: $25 (1 service) / $45 (2+ services) — via calculate_activation_fee RPC at checkout
 * Technician install: $50 — from ClientNewOrder.tsx line 1545
 * Delivery (auto-install shipping): $30 — from DELIVERY_CONFIG.standard.fee
 * Terminal: from services_public (DB)
 * Router: from services_public (DB)
 */
const TECHNICIAN_INSTALL_FEE = 50;
const STANDARD_DELIVERY_FEE = 30;
const ACTIVATION_FEE_SINGLE = 25;

type InstallMethod = "technician" | "self" | null;

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
  const [extraTerminals, setExtraTerminals] = useState(0);
  const [includeRouter, setIncludeRouter] = useState(true);
  const [installMethod, setInstallMethod] = useState<InstallMethod>(null);

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
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Terminal always included with TV (per plan description: "Terminal inclus"), extras are additional
  const totalTerminals = 1 + extraTerminals;

  /* ─── Pricing calculation (ESTIMATES — canonical math is server-side) ─── */
  const pricing = useMemo(() => {
    const recurringItems: { name: string; price: number }[] = [];
    const oneTimeItems: { name: string; price: number }[] = [];

    if (selectedPlan) {
      recurringItems.push({ name: selectedPlan.name, price: selectedPlan.price });
    }

    selectedStreamingIds.forEach(id => {
      const svc = streamingServices.find(s => s.id === id);
      if (svc) recurringItems.push({ name: svc.name, price: svc.monthly_price });
    });

    // Terminal equipment (from DB price)
    if (terminalProduct) {
      oneTimeItems.push({
        name: `${terminalProduct.name}${totalTerminals > 1 ? ` ×${totalTerminals}` : ""}`,
        price: terminalProduct.price * totalTerminals,
      });
    }

    // Router (from DB price)
    if (includeRouter && routerProduct) {
      oneTimeItems.push({ name: routerProduct.name, price: routerProduct.price });
    }

    // Activation fee — canonical: $25 for 1 service
    if (selectedPlan) {
      oneTimeItems.push({ name: isFr ? "Frais d'activation" : "Activation fee", price: ACTIVATION_FEE_SINGLE });
    }

    // Installation — canonical: $50 for technician (from ClientNewOrder.tsx)
    if (installMethod === "technician") {
      oneTimeItems.push({ name: isFr ? "Installation technicien" : "Technician installation", price: TECHNICIAN_INSTALL_FEE });
    }

    // Delivery — canonical: $30 standard (from DELIVERY_CONFIG.standard.fee)
    if (installMethod === "self") {
      oneTimeItems.push({ name: isFr ? "Livraison standard" : "Standard shipping", price: STANDARD_DELIVERY_FEE });
    }

    const recurringSubtotal = recurringItems.reduce((s, i) => s + i.price, 0);
    const oneTimeSubtotal = oneTimeItems.reduce((s, i) => s + i.price, 0);
    const taxableBase = recurringSubtotal + oneTimeSubtotal;
    const tps = Math.round(taxableBase * TPS_RATE * 100) / 100;
    const tvq = Math.round(taxableBase * TVQ_RATE * 100) / 100;
    const grandTotal = Math.round((taxableBase + tps + tvq) * 100) / 100;

    return { recurringItems, oneTimeItems, recurringSubtotal, oneTimeSubtotal, tps, tvq, grandTotal };
  }, [selectedPlan, selectedStreamingIds, streamingServices, terminalProduct, totalTerminals, includeRouter, routerProduct, installMethod, isFr]);

  /* ─── Build canonical payload for checkout handoff ─── */
  const handleContinue = () => {
    if (!selectedPlanId) return;

    const payload: TVCartPayload = {
      source: "tv-configurator",
      version: 3,
      selectedPlanId,
      selectedStreamingIds: Array.from(selectedStreamingIds),
      terminalProductId: terminalProduct?.id || null,
      terminalQuantity: totalTerminals,
      routerProductId: includeRouter && routerProduct ? routerProduct.id : null,
      installationChoice: installMethod === "technician" ? "technician" : installMethod === "self" ? "auto" : null,
      includeShipping: installMethod === "self",
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
          <p className="text-muted-foreground">{isFr ? "Chargement..." : "Loading..."}</p>
        </div>
      </div>
    );
  }

  // Parse plan details for feature display
  const parsePlanFeatures = (plan: ServicePublic) => {
    const desc = plan.description || "";
    const features = desc.split("•").map(s => s.trim()).filter(Boolean);
    // Extract speed from name
    const speedMatch = plan.name.match(/(\d+)\s*Mbps|GIGA|1\s*Gbps/i);
    const speed = speedMatch ? speedMatch[0] : "";
    // Extract channel info
    const channelMatch = desc.match(/(\d+)\s*chaînes?/);
    const channels = channelMatch ? channelMatch[0] : "";
    return { features, speed, channels };
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ─── Hero ─── */}
      <section className="bg-[#003366] relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-blue-400/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-sky-500/8 to-transparent rounded-full translate-y-1/2 -translate-x-1/4" />
        </div>
        <div className="container mx-auto px-4 max-w-[1320px] py-14 md:py-20 relative z-10">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-px w-8 bg-sky-400" />
              <span className="text-sky-300 text-sm font-semibold tracking-widest uppercase">
                {isFr ? "Configurateur" : "Configurator"}
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-white leading-[1.1] mb-4">
              {isFr ? "Télévision sur mesure" : "Custom Television"}
            </h1>
            <p className="text-base md:text-lg text-blue-100/70 leading-relaxed max-w-xl">
              {isFr
                ? "Composez votre forfait Internet + TV parmi nos offres réelles. Ajoutez vos options et passez commande."
                : "Build your Internet + TV package from our real offers. Add your options and place your order."}
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-[1320px] py-8 md:py-12">
        <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-10">
          {/* ─── LEFT: Configurator ─── */}
          <div className="space-y-10">

            {/* ═══ STEP 1: TV Plan Selection ═══ */}
            <section>
              <StepHeader step={1} title={isFr ? "Choisissez votre forfait" : "Choose your plan"} subtitle={isFr ? `${tvPlans.length} forfaits Internet + TV disponibles` : `${tvPlans.length} Internet + TV plans available`} />
              
              <div className="grid gap-4">
                {tvPlans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  const { features } = parsePlanFeatures(plan);
                  
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={cn(
                        "group relative rounded-2xl border-2 p-5 md:p-6 cursor-pointer transition-all duration-200",
                        isSelected
                          ? "border-[#003366] bg-white shadow-lg shadow-blue-900/5 ring-1 ring-[#003366]/10"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        {/* Radio indicator */}
                        <div className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-colors",
                          isSelected ? "bg-[#003366] border-[#003366]" : "border-slate-300 group-hover:border-slate-400"
                        )}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-base md:text-lg font-bold text-slate-900 leading-snug">{plan.name}</h3>
                              {features.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {features.map((f, i) => (
                                    <span key={i} className="inline-flex items-center text-xs text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-2xl md:text-3xl font-bold text-slate-900">{plan.price.toFixed(0)}<span className="text-base font-semibold text-slate-500"> $</span></div>
                              <div className="text-xs text-slate-400 font-medium">/{isFr ? "mois" : "mo"}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {tvPlans.length === 0 && (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-12 text-center">
                    <p className="text-slate-400">{isFr ? "Aucun forfait TV disponible" : "No TV plans available"}</p>
                  </div>
                )}
              </div>
            </section>

            {/* ═══ STEP 2: Streaming Add-ons ═══ */}
            {streamingServices.length > 0 && (
              <section>
                <StepHeader step={2} title={isFr ? "Ajouts Streaming" : "Streaming add-ons"} subtitle={isFr ? "Optionnel — ajoutez vos plateformes préférées" : "Optional — add your favorite platforms"} />
                
                {videoStreaming.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                      <MonitorPlay className="w-4 h-4" /> {isFr ? "Vidéo" : "Video"}
                    </p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {videoStreaming.map(svc => (
                        <StreamingCard key={svc.id} service={svc} selected={selectedStreamingIds.has(svc.id)} onToggle={() => toggleStreaming(svc.id)} isFr={isFr} />
                      ))}
                    </div>
                  </div>
                )}

                {musicStreaming.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                      <Music className="w-4 h-4" /> {isFr ? "Musique" : "Music"}
                    </p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {musicStreaming.map(svc => (
                        <StreamingCard key={svc.id} service={svc} selected={selectedStreamingIds.has(svc.id)} onToggle={() => toggleStreaming(svc.id)} isFr={isFr} />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ═══ STEP 3: Equipment ═══ */}
            <section>
              <StepHeader step={3} title={isFr ? "Équipement" : "Equipment"} subtitle={isFr ? "Matériel requis pour votre installation" : "Required hardware for your setup"} />
              
              <div className="space-y-4">
                {/* Terminal — always included with TV */}
                {terminalProduct && (
                  <div className="rounded-2xl border-2 border-[#003366]/20 bg-white p-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#003366]/10 flex items-center justify-center shrink-0">
                        <Monitor className="w-6 h-6 text-[#003366]" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900">{terminalProduct.name}</h4>
                          <Badge className="bg-[#003366]/10 text-[#003366] border-0 text-[10px]">{isFr ? "Inclus" : "Included"}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{terminalProduct.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-slate-900">{terminalProduct.price.toFixed(2)} $</div>
                        <div className="text-[10px] text-slate-400">{isFr ? "par terminal" : "per terminal"}</div>
                      </div>
                    </div>
                    
                    {/* Extra terminals */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm text-slate-600">{isFr ? "Terminaux supplémentaires" : "Extra terminals"} <span className="text-slate-400">(max 4)</span></span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setExtraTerminals(Math.max(0, extraTerminals - 1))}
                          disabled={extraTerminals === 0}
                          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-bold text-slate-900">{extraTerminals}</span>
                        <button
                          onClick={() => setExtraTerminals(Math.min(3, extraTerminals + 1))}
                          className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Router — optional */}
                {routerProduct && (
                  <div
                    onClick={() => setIncludeRouter(!includeRouter)}
                    className={cn(
                      "rounded-2xl border-2 bg-white p-5 cursor-pointer transition-all",
                      includeRouter ? "border-[#003366]/20 shadow-sm" : "border-slate-200 opacity-60 hover:opacity-80"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                        includeRouter ? "bg-[#003366]/10" : "bg-slate-100"
                      )}>
                        <Wifi className={cn("w-6 h-6", includeRouter ? "text-[#003366]" : "text-slate-400")} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900">{routerProduct.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{routerProduct.description}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900">{routerProduct.price.toFixed(2)} $</span>
                        <div className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                          includeRouter ? "bg-[#003366] border-[#003366]" : "border-slate-300"
                        )}>
                          {includeRouter && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ═══ STEP 4: Installation ═══ */}
            <section>
              <StepHeader step={4} title={isFr ? "Mode d'installation" : "Installation method"} subtitle={isFr ? "Choisissez comment activer vos services" : "Choose how to activate your services"} />
              
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Technician */}
                <div
                  onClick={() => setInstallMethod(installMethod === "technician" ? null : "technician")}
                  className={cn(
                    "rounded-2xl border-2 p-5 cursor-pointer transition-all",
                    installMethod === "technician"
                      ? "border-[#003366] bg-white shadow-lg"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                  )}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center",
                      installMethod === "technician" ? "bg-[#003366] text-white" : "bg-slate-100 text-slate-500"
                    )}>
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{isFr ? "Technicien à domicile" : "Home technician"}</h4>
                      <span className="text-sm font-semibold text-[#003366]">{TECHNICIAN_INSTALL_FEE.toFixed(2)} $</span>
                    </div>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-500">
                    <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{isFr ? "Installation complète par un technicien certifié" : "Full setup by certified technician"}</li>
                    <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{isFr ? "Vérification du câblage et test de services" : "Wiring check and service testing"}</li>
                    <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{isFr ? "Activation et configuration sur place" : "On-site activation and configuration"}</li>
                  </ul>
                </div>

                {/* Self-install */}
                <div
                  onClick={() => setInstallMethod(installMethod === "self" ? null : "self")}
                  className={cn(
                    "rounded-2xl border-2 p-5 cursor-pointer transition-all",
                    installMethod === "self"
                      ? "border-[#003366] bg-white shadow-lg"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                  )}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center",
                      installMethod === "self" ? "bg-[#003366] text-white" : "bg-slate-100 text-slate-500"
                    )}>
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{isFr ? "Auto-installation" : "Self-install"}</h4>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">{isFr ? "Installation gratuite" : "Free install"}</Badge>
                        <span className="text-xs text-slate-400">{isFr ? `+ ${STANDARD_DELIVERY_FEE} $ livraison` : `+ $${STANDARD_DELIVERY_FEE} shipping`}</span>
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-500">
                    <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{isFr ? "Équipement livré à domicile" : "Equipment shipped to your door"}</li>
                    <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{isFr ? "Guide d'installation pas-à-pas" : "Step-by-step installation guide"}</li>
                    <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{isFr ? "Support technique si besoin" : "Tech support if needed"}</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Mobile CTA */}
            <div className="lg:hidden">
              <MobileSummary pricing={pricing} isFr={isFr} onContinue={handleContinue} fmt={fmt} disabled={!selectedPlanId || !installMethod} />
            </div>
          </div>

          {/* ─── RIGHT: Sticky Summary (desktop) ─── */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
                {/* Header */}
                <div className="bg-[#003366] px-6 py-5">
                  <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-sky-300" />
                    {isFr ? "Votre forfait" : "Your package"}
                  </h3>
                  <p className="text-blue-200/60 text-xs mt-1">{isFr ? "Prépayé • Sans contrat • Sans engagement" : "Prepaid • No contract • No commitment"}</p>
                </div>

                <div className="px-6 py-5 space-y-5">
                  {/* Recurring */}
                  {pricing.recurringItems.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                        {isFr ? "Services mensuels" : "Monthly services"}
                      </h4>
                      <div className="space-y-2">
                        {pricing.recurringItems.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-slate-700 truncate pr-3">{item.name}</span>
                            <span className="text-slate-900 font-semibold whitespace-nowrap">{item.price.toFixed(2)} $</span>
                          </div>
                        ))}
                      </div>
                      <Separator className="my-3" />
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-slate-800">{isFr ? "Sous-total mensuel" : "Monthly subtotal"}</span>
                        <span className="text-slate-900">{pricing.recurringSubtotal.toFixed(2)} $/{isFr ? "mois" : "mo"}</span>
                      </div>
                    </div>
                  )}

                  {/* One-time */}
                  {pricing.oneTimeItems.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                        {isFr ? "Frais uniques" : "One-time fees"}
                      </h4>
                      <div className="space-y-2">
                        {pricing.oneTimeItems.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-slate-700 truncate pr-3">{item.name}</span>
                            <span className="text-slate-900 font-semibold whitespace-nowrap">{item.price.toFixed(2)} $</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Taxes estimate */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>TPS (5%) <span className="italic">est.</span></span>
                        <span>~{pricing.tps.toFixed(2)} $</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>TVQ (9,975%) <span className="italic">est.</span></span>
                        <span>~{pricing.tvq.toFixed(2)} $</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-300 mt-1.5 italic">
                      {isFr ? "Taxes finales calculées au paiement" : "Final taxes computed at checkout"}
                    </p>
                  </div>

                  {/* Grand Total */}
                  <div className="bg-slate-50 -mx-6 px-6 py-5 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold text-slate-900">{isFr ? "Total estimé aujourd'hui" : "Estimated total today"}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {isFr ? "Puis" : "Then"} ~{pricing.recurringSubtotal.toFixed(2)} $/{isFr ? "mois" : "mo"}
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-[#003366]">~{fmt(pricing.grandTotal)}</div>
                    </div>
                  </div>

                  <div className="px-0">
                    <Button
                      onClick={handleContinue}
                      className="w-full h-12 text-base font-bold bg-[#003366] hover:bg-[#002244] rounded-xl"
                      disabled={!selectedPlanId || !installMethod}
                    >
                      {isFr ? "Passer la commande" : "Place order"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    {(!selectedPlanId || !installMethod) && (
                      <p className="text-[11px] text-amber-600 text-center mt-2">
                        {!selectedPlanId
                          ? (isFr ? "Sélectionnez un forfait" : "Select a plan")
                          : (isFr ? "Choisissez un mode d'installation" : "Choose an installation method")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Sub-components ─── */

function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 rounded-full bg-[#003366] text-white flex items-center justify-center text-sm font-bold shrink-0">
          {step}
        </div>
        <h2 className="text-lg md:text-xl font-bold text-slate-900">{title}</h2>
      </div>
      <p className="text-sm text-slate-400 ml-11">{subtitle}</p>
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
        "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
        selected
          ? "border-[#003366] bg-white shadow-md"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
        selected ? "bg-[#003366] text-white" : "bg-slate-100 text-slate-400"
      )}>
        <MonitorPlay className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-slate-900 truncate">{service.name}</div>
        <div className="text-xs text-slate-400 font-medium">{service.monthly_price.toFixed(2)} $/{isFr ? "mois" : "mo"}</div>
      </div>
      <div className={cn(
        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
        selected ? "bg-[#003366] border-[#003366]" : "border-slate-300"
      )}>
        {selected && <Check className="w-3 h-3 text-white" />}
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
    <div className="rounded-2xl border-2 border-[#003366]/20 bg-white shadow-xl p-5 space-y-4">
      <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
        <ShieldCheck className="w-5 h-5 text-[#003366]" />
        {isFr ? "Résumé" : "Summary"}
      </h3>

      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">{isFr ? "Mensuel" : "Monthly"}</span>
          <span className="font-bold text-slate-900">{pricing.recurringSubtotal.toFixed(2)} $/{isFr ? "mois" : "mo"}</span>
        </div>
        {pricing.oneTimeSubtotal > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-500">{isFr ? "Frais uniques" : "One-time"}</span>
            <span className="font-bold text-slate-900">{pricing.oneTimeSubtotal.toFixed(2)} $</span>
          </div>
        )}
        <div className="flex justify-between text-xs text-slate-400">
          <span>TPS + TVQ <span className="italic">est.</span></span>
          <span>~{(pricing.tps + pricing.tvq).toFixed(2)} $</span>
        </div>
        <Separator />
        <div className="flex justify-between items-center pt-1">
          <span className="font-bold text-slate-900">{isFr ? "Total estimé" : "Est. total"}</span>
          <span className="text-xl font-bold text-[#003366]">~{fmt(pricing.grandTotal)}</span>
        </div>
      </div>

      <Button onClick={onContinue} className="w-full h-12 text-base font-bold bg-[#003366] hover:bg-[#002244] rounded-xl" disabled={disabled}>
        {isFr ? "Passer la commande" : "Place order"}
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
      {disabled && (
        <p className="text-[11px] text-amber-600 text-center">
          {isFr ? "Sélectionnez un forfait et un mode d'installation" : "Select a plan and installation method"}
        </p>
      )}
    </div>
  );
}

export default TVConfigurator;
