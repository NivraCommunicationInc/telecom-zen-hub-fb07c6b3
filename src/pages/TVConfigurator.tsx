import { useState, useMemo, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { useCanonicalFees } from "@/hooks/useCanonicalFees";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tv, Wifi, Monitor, Wrench, Check, Plus, Minus,
  ShieldCheck, ArrowRight, MonitorPlay, Loader2, Package, Music,
  Zap, Signal, Layers, ChevronDown, Star
} from "lucide-react";
import { cn } from "@/lib/utils";

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

/* ─── Tax constants (QC) — ESTIMATE ONLY ─── */
const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

type InstallMethod = "technician" | "self" | null;
type SimulatorStep = 1 | 2 | 3 | 4;

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

/* ─── Plan parsing helpers ─── */
function extractPlanMeta(plan: ServicePublic) {
  const name = plan.name || "";
  const desc = plan.description || "";

  // Extract internet speed
  let speed = "";
  if (name.match(/GIGA/i) || name.match(/1010\s*Mbps/i) || name.match(/1\s*Gbps/i)) speed = "GIGA";
  else if (name.match(/500/)) speed = "500 Mbps";
  else if (name.match(/100/)) speed = "100 Mbps";
  else if (name.match(/940/)) speed = "940 Mbps";

  // Extract channel count from description
  const channelMatch = desc.match(/(\d+)\s*chaînes?/);
  const channels = channelMatch ? parseInt(channelMatch[1]) : 0;

  // Extract "choix" count from name
  const choixMatch = name.match(/(\d+)\s*choix/i);
  const choix = choixMatch ? parseInt(choixMatch[1]) : 0;

  // Features from description (split by •)
  const features = desc.split("•").map(s => s.trim()).filter(Boolean);

  // Determine tier for visual treatment
  let tier: "basic" | "mid" | "premium" = "basic";
  if (plan.price >= 95) tier = "premium";
  else if (plan.price >= 85) tier = "mid";

  return { speed, channels, choix, features, tier };
}

const TVConfigurator = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isFr = language === "fr";
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // ─── Simulator step tracking ───
  const [activeStep, setActiveStep] = useState<SimulatorStep>(1);

  const { data: allServices = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["tv-configurator-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services_public")
        .select("id, name, category, price, description, billing_type, visible_simulator")
        .order("category", { ascending: true })
        .order("price", { ascending: true });
      if (error) throw error;
      return (data || []) as (ServicePublic & { visible_simulator?: boolean })[];
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

  // Only show TV plans that are marked visible_simulator
  const tvPlans = useMemo(() => allServices.filter(s => s.category === "TV" && (s as any).visible_simulator), [allServices]);
  const equipmentProducts = useMemo(() => allServices.filter(s => s.category === "Équipement"), [allServices]);
  const terminalProduct = useMemo(() => equipmentProducts.find(e => e.name.toLowerCase().includes("terminal")), [equipmentProducts]);
  const routerProduct = useMemo(() => equipmentProducts.find(e => e.name.toLowerCase().includes("router")), [equipmentProducts]);
  const videoStreaming = useMemo(() => streamingServices.filter(s => s.category === "video"), [streamingServices]);
  const musicStreaming = useMemo(() => streamingServices.filter(s => s.category === "music"), [streamingServices]);

  // ─── Selection state ───
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedStreamingIds, setSelectedStreamingIds] = useState<Set<string>>(new Set());
  const [extraTerminals, setExtraTerminals] = useState(0); // extra beyond the required 1
  const includeRouter = true; // ALWAYS required — 1 borne per address, not toggleable
  const [installMethod, setInstallMethod] = useState<InstallMethod>(null);

  useEffect(() => {
    if (tvPlans.length > 0 && !selectedPlanId) setSelectedPlanId(tvPlans[0].id);
  }, [tvPlans, selectedPlanId]);

  const selectedPlan = useMemo(() => tvPlans.find(p => p.id === selectedPlanId) || null, [tvPlans, selectedPlanId]);
  const totalTerminals = 1 + extraTerminals;

  const toggleStreaming = (id: string) => {
    setSelectedStreamingIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /* ─── Pricing ─── */
  const pricing = useMemo(() => {
    const recurringItems: { name: string; price: number }[] = [];
    const oneTimeItems: { name: string; price: number }[] = [];

    if (selectedPlan) recurringItems.push({ name: selectedPlan.name, price: selectedPlan.price });
    selectedStreamingIds.forEach(id => {
      const svc = streamingServices.find(s => s.id === id);
      if (svc) recurringItems.push({ name: svc.name, price: svc.monthly_price });
    });

    if (terminalProduct) {
      oneTimeItems.push({ name: `${terminalProduct.name}${totalTerminals > 1 ? ` ×${totalTerminals}` : ""}`, price: terminalProduct.price * totalTerminals });
    }
    if (includeRouter && routerProduct) oneTimeItems.push({ name: routerProduct.name, price: routerProduct.price });
    if (selectedPlan) oneTimeItems.push({ name: isFr ? "Activation" : "Activation", price: ACTIVATION_FEE_SINGLE });
    if (installMethod === "technician") oneTimeItems.push({ name: isFr ? "Installation technicien" : "Technician install", price: TECHNICIAN_INSTALL_FEE });
    if (installMethod === "self") oneTimeItems.push({ name: isFr ? "Livraison" : "Shipping", price: STANDARD_DELIVERY_FEE });

    const recurringSubtotal = recurringItems.reduce((s, i) => s + i.price, 0);
    const oneTimeSubtotal = oneTimeItems.reduce((s, i) => s + i.price, 0);
    const taxableBase = recurringSubtotal + oneTimeSubtotal;
    const tps = Math.round(taxableBase * TPS_RATE * 100) / 100;
    const tvq = Math.round(taxableBase * TVQ_RATE * 100) / 100;
    const grandTotal = Math.round((taxableBase + tps + tvq) * 100) / 100;

    return { recurringItems, oneTimeItems, recurringSubtotal, oneTimeSubtotal, tps, tvq, grandTotal };
  }, [selectedPlan, selectedStreamingIds, streamingServices, terminalProduct, totalTerminals, includeRouter, routerProduct, installMethod, isFr]);

  const handleContinue = () => {
    if (!selectedPlanId) return;
    const payload: TVCartPayload = {
      source: "tv-configurator", version: 3, selectedPlanId,
      selectedStreamingIds: Array.from(selectedStreamingIds),
      terminalProductId: terminalProduct?.id || null, terminalQuantity: totalTerminals,
      routerProductId: includeRouter && routerProduct ? routerProduct.id : null,
      installationChoice: installMethod === "technician" ? "technician" : installMethod === "self" ? "auto" : null,
      includeShipping: installMethod === "self", createdAt: new Date().toISOString(),
    };
    sessionStorage.setItem("nivra_tv_cart", JSON.stringify(payload));
    navigate("/portal/new-order");
  };

  const fmt = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " $";
  const isLoading = servicesLoading || streamingLoading;
  const canProceed = !!selectedPlanId && !!installMethod;

  const scrollToStep = (step: SimulatorStep) => {
    setActiveStep(step);
    sectionRefs.current[step]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#003366] mx-auto" />
          <p className="text-slate-400 text-sm">{isFr ? "Chargement du simulateur..." : "Loading simulator..."}</p>
        </div>
      </div>
    );
  }

  const STEPS = [
    { num: 1 as SimulatorStep, label: isFr ? "Forfait" : "Plan", done: !!selectedPlanId },
    { num: 2 as SimulatorStep, label: "Streaming", done: true /* optional */ },
    { num: 3 as SimulatorStep, label: isFr ? "Équipement" : "Equipment", done: true },
    { num: 4 as SimulatorStep, label: "Installation", done: !!installMethod },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ═══════════════════════════════════════════════════════ */}
      {/* HERO — Full-width immersive header */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="bg-[#003366] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNCkiLz48L2c+PC9zdmc+')] opacity-60" />
        <div className="container mx-auto px-4 max-w-[1100px] py-12 md:py-16 relative z-10 text-center">
          <Badge className="bg-sky-400/15 text-sky-200 border-sky-400/20 mb-4 text-xs px-3 py-1 font-semibold">
            <Tv className="w-3.5 h-3.5 mr-1.5" />
            {isFr ? "Simulateur Nivra" : "Nivra Simulator"}
          </Badge>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-[1.08] mb-3">
            {isFr ? "Composez votre forfait TV" : "Build your TV package"}
          </h1>
          <p className="text-sm md:text-base text-blue-200/50 max-w-lg mx-auto">
            {isFr
              ? "Sélectionnez votre plan, personnalisez vos options et commandez en quelques clics."
              : "Select your plan, customize your options and order in a few clicks."}
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* STEP PROGRESS BAR — telecom simulator nav */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 max-w-[1100px]">
          <div className="flex items-center justify-between h-14 md:h-16 overflow-x-auto">
            {STEPS.map((step, i) => (
              <button
                key={step.num}
                onClick={() => scrollToStep(step.num)}
                className={cn(
                  "flex items-center gap-2.5 px-3 md:px-5 py-2 rounded-lg transition-colors whitespace-nowrap text-sm font-medium",
                  activeStep === step.num
                    ? "text-[#003366]"
                    : step.done ? "text-slate-500 hover:text-slate-700" : "text-slate-300"
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                  activeStep === step.num
                    ? "bg-[#003366] text-white"
                    : step.done ? "bg-slate-100 text-slate-600" : "bg-slate-50 text-slate-300"
                )}>
                  {step.done && activeStep !== step.num ? <Check className="w-3.5 h-3.5" /> : step.num}
                </div>
                <span className="hidden sm:inline">{step.label}</span>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block w-8 lg:w-16 h-px bg-slate-200 ml-2" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT — centered, no sidebar layout */}
      {/* ═══════════════════════════════════════════════════════ */}
      <main className="flex-1 pb-40">

        {/* ── STEP 1: Plan Selection ── */}
        <div ref={el => { sectionRefs.current[1] = el; }} className="scroll-mt-20">
          <div className="bg-slate-50 py-10 md:py-14">
            <div className="container mx-auto px-4 max-w-[1100px]">
              <SimulatorSectionHeader
                step={1}
                title={isFr ? "Choisissez votre forfait Internet + TV" : "Choose your Internet + TV plan"}
                subtitle={isFr ? `${tvPlans.length} forfaits disponibles — tous prépayés, sans contrat` : `${tvPlans.length} plans available — all prepaid, no contract`}
              />

              {/* Plan grid — 2-column on lg for comparison feel */}
              <div className="grid md:grid-cols-2 gap-4 md:gap-5">
                {tvPlans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  const meta = extractPlanMeta(plan);

                  return (
                    <div
                      key={plan.id}
                      onClick={() => { setSelectedPlanId(plan.id); setActiveStep(1); }}
                      className={cn(
                        "relative rounded-2xl border-2 cursor-pointer transition-all duration-200 overflow-hidden",
                        isSelected
                          ? "border-[#003366] shadow-xl shadow-blue-900/8 scale-[1.01]"
                          : "border-slate-200 hover:border-slate-300 hover:shadow-lg"
                      )}
                    >
                      {/* Selected indicator ribbon */}
                      {isSelected && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-[#003366]" />
                      )}

                      {/* Premium badge for top-tier */}
                      {meta.tier === "premium" && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold gap-1">
                            <Star className="w-3 h-3" /> VIP
                          </Badge>
                        </div>
                      )}

                      <div className="bg-white p-5 md:p-6">
                        {/* Price header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                              isSelected ? "bg-[#003366] border-[#003366] scale-110" : "border-slate-300"
                            )}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div>
                              <h3 className="text-sm md:text-base font-bold text-slate-900 leading-snug">{plan.name}</h3>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-extrabold text-[#003366] tabular-nums">{plan.price.toFixed(0)}<span className="text-sm font-bold text-slate-400">$</span></div>
                            <div className="text-[11px] text-slate-400 font-medium -mt-0.5">/{isFr ? "mois" : "mo"}</div>
                          </div>
                        </div>

                        {/* Speed + Channels badges */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {meta.speed && (
                            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                              <Signal className="w-3.5 h-3.5" />
                              {meta.speed}
                            </div>
                          )}
                          {meta.channels > 0 && (
                            <div className="flex items-center gap-1.5 bg-purple-50 text-purple-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                              <Layers className="w-3.5 h-3.5" />
                              {meta.channels} {isFr ? "chaînes" : "channels"}
                            </div>
                          )}
                          {meta.choix > 0 && (
                            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                              <Plus className="w-3.5 h-3.5" />
                              {meta.choix} {isFr ? "au choix" : "picks"}
                            </div>
                          )}
                        </div>

                        {/* Features */}
                        {meta.features.length > 0 && (
                          <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-100">
                            {meta.features.slice(0, 3).map((f, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-slate-500">
                                <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                <span>{f}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {tvPlans.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
                  <Tv className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400">{isFr ? "Aucun forfait disponible" : "No plans available"}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── STEP 2: Streaming ── */}
        {streamingServices.length > 0 && (
          <div ref={el => { sectionRefs.current[2] = el; }} className="scroll-mt-20">
            <div className="bg-white py-10 md:py-14 border-t border-slate-100">
              <div className="container mx-auto px-4 max-w-[1100px]">
                <SimulatorSectionHeader
                  step={2}
                  title={isFr ? "Ajoutez du Streaming" : "Add Streaming"}
                  subtitle={isFr ? "Optionnel — ajoutez vos plateformes de streaming préférées à votre forfait" : "Optional — add your favorite streaming platforms to your package"}
                  optional
                />

                {videoStreaming.length > 0 && (
                  <div className="mb-8">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
                      <MonitorPlay className="w-4 h-4" /> {isFr ? "Vidéo & Films" : "Video & Movies"}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {videoStreaming.map(svc => (
                        <StreamingTile key={svc.id} service={svc} selected={selectedStreamingIds.has(svc.id)} onToggle={() => toggleStreaming(svc.id)} isFr={isFr} />
                      ))}
                    </div>
                  </div>
                )}

                {musicStreaming.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
                      <Music className="w-4 h-4" /> {isFr ? "Musique" : "Music"}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {musicStreaming.map(svc => (
                        <StreamingTile key={svc.id} service={svc} selected={selectedStreamingIds.has(svc.id)} onToggle={() => toggleStreaming(svc.id)} isFr={isFr} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Equipment ── */}
        <div ref={el => { sectionRefs.current[3] = el; }} className="scroll-mt-20">
          <div className="bg-slate-50 py-10 md:py-14 border-t border-slate-100">
            <div className="container mx-auto px-4 max-w-[1100px]">
              <SimulatorSectionHeader
                step={3}
                title={isFr ? "Votre équipement" : "Your equipment"}
                subtitle={isFr ? "Matériel nécessaire pour votre installation TV et Internet" : "Hardware needed for your TV and Internet setup"}
              />

              <div className="grid md:grid-cols-2 gap-5">
                {/* Terminal Card */}
                {terminalProduct && (
                  <div className="rounded-2xl border-2 border-[#003366]/15 bg-white overflow-hidden">
                    <div className="bg-[#003366]/5 px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-[#003366]" />
                        <span className="text-xs font-bold text-[#003366] uppercase tracking-wider">{isFr ? "Terminal TV" : "TV Terminal"}</span>
                      </div>
                      <Badge className="bg-[#003366]/10 text-[#003366] border-0 text-[10px] font-bold">{isFr ? "Requis" : "Required"}</Badge>
                    </div>
                    <div className="p-5">
                      <h4 className="font-bold text-slate-900 mb-1">{terminalProduct.name}</h4>
                      <p className="text-xs text-slate-400 mb-4">{terminalProduct.description}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-2xl font-extrabold text-slate-900">{terminalProduct.price.toFixed(0)}</span>
                          <span className="text-sm text-slate-400 ml-0.5">$ / {isFr ? "unité" : "unit"}</span>
                        </div>
                      </div>
                      <Separator className="my-4" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">{isFr ? "Terminaux supplémentaires" : "Extra terminals"}</span>
                        <div className="flex items-center gap-2.5">
                          <button onClick={() => setExtraTerminals(Math.max(0, extraTerminals - 1))} disabled={extraTerminals === 0}
                            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-20 transition-all">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center font-bold text-slate-900 tabular-nums">{extraTerminals}</span>
                          <button onClick={() => setExtraTerminals(Math.min(3, extraTerminals + 1))}
                            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-2">{isFr ? "Maximum 4 terminaux au total" : "Maximum 4 terminals total"}</p>
                    </div>
                  </div>
                )}

                {/* Router / Borne Card — ALWAYS REQUIRED */}
                {routerProduct && (
                  <div className="rounded-2xl border-2 border-[#003366]/15 bg-white overflow-hidden">
                    <div className="bg-[#003366]/5 px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-[#003366]" />
                        <span className="text-xs font-bold text-[#003366] uppercase tracking-wider">
                          {isFr ? "Borne WiFi (Routeur)" : "WiFi Router"}
                        </span>
                      </div>
                      <Badge className="bg-[#003366]/10 text-[#003366] border-0 text-[10px] font-bold">{isFr ? "Requis" : "Required"}</Badge>
                    </div>
                    <div className="p-5">
                      <h4 className="font-bold text-slate-900 mb-1">{routerProduct.name}</h4>
                      <p className="text-xs text-slate-400 mb-4">{routerProduct.description || (isFr ? "1 borne requise par adresse" : "1 router required per address")}</p>
                      <div>
                        <span className="text-2xl font-extrabold text-slate-900">{routerProduct.price.toFixed(0)}</span>
                        <span className="text-sm text-slate-400 ml-0.5">$</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-3">{isFr ? "Exactement 1 borne par adresse · Inclus automatiquement" : "Exactly 1 per address · Automatically included"}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── STEP 4: Installation ── */}
        <div ref={el => { sectionRefs.current[4] = el; }} className="scroll-mt-20">
          <div className="bg-white py-10 md:py-14 border-t border-slate-100">
            <div className="container mx-auto px-4 max-w-[1100px]">
              <SimulatorSectionHeader
                step={4}
                title={isFr ? "Mode d'installation" : "Installation method"}
                subtitle={isFr ? "Comment souhaitez-vous activer vos services?" : "How would you like to activate your services?"}
              />

              <div className="grid md:grid-cols-2 gap-5 max-w-[800px] mx-auto">
                {/* Technician */}
                <div
                  onClick={() => setInstallMethod(installMethod === "technician" ? null : "technician")}
                  className={cn(
                    "rounded-2xl border-2 p-6 cursor-pointer transition-all text-center",
                    installMethod === "technician"
                      ? "border-[#003366] bg-[#003366]/[0.02] shadow-xl shadow-blue-900/8"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg"
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors",
                    installMethod === "technician" ? "bg-[#003366] text-white" : "bg-slate-100 text-slate-400"
                  )}>
                    <Wrench className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1">{isFr ? "Technicien à domicile" : "Home technician"}</h4>
                  <p className="text-lg font-extrabold text-[#003366] mb-3">{TECHNICIAN_INSTALL_FEE} $</p>
                  <ul className="text-left space-y-2 text-xs text-slate-500">
                    <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{isFr ? "Installation complète sur place" : "Complete on-site installation"}</li>
                    <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{isFr ? "Vérification du câblage" : "Wiring verification"}</li>
                    <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{isFr ? "Activation et test de services" : "Service activation & testing"}</li>
                  </ul>
                </div>

                {/* Self-install */}
                <div
                  onClick={() => setInstallMethod(installMethod === "self" ? null : "self")}
                  className={cn(
                    "rounded-2xl border-2 p-6 cursor-pointer transition-all text-center",
                    installMethod === "self"
                      ? "border-[#003366] bg-[#003366]/[0.02] shadow-xl shadow-blue-900/8"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg"
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors",
                    installMethod === "self" ? "bg-[#003366] text-white" : "bg-slate-100 text-slate-400"
                  )}>
                    <Package className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1">{isFr ? "Auto-installation" : "Self-install"}</h4>
                  <div className="mb-3">
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold">{isFr ? "Gratuit" : "Free"}</Badge>
                    <span className="text-xs text-slate-400 ml-2">+ {STANDARD_DELIVERY_FEE} $ {isFr ? "livraison" : "shipping"}</span>
                  </div>
                  <ul className="text-left space-y-2 text-xs text-slate-500">
                    <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{isFr ? "Équipement livré à domicile" : "Equipment shipped home"}</li>
                    <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{isFr ? "Guide d'installation inclus" : "Installation guide included"}</li>
                    <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{isFr ? "Support technique si besoin" : "Tech support if needed"}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* BOTTOM STICKY BAR — Premium pricing action bar */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.1)]">
        <div className="container mx-auto px-4 max-w-[1100px]">
          <div className="flex items-center justify-between h-[72px] md:h-20 gap-4">
            {/* Left: selected plan summary */}
            <div className="flex-1 min-w-0 hidden sm:block">
              {selectedPlan ? (
                <div>
                  <p className="text-xs text-slate-400 font-medium">{isFr ? "Forfait sélectionné" : "Selected plan"}</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{selectedPlan.name}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-400">{isFr ? "Aucun forfait sélectionné" : "No plan selected"}</p>
              )}
            </div>

            {/* Center: pricing breakdown */}
            <div className="flex items-center gap-4 md:gap-6">
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{isFr ? "Mensuel" : "Monthly"}</p>
                <p className="text-lg md:text-xl font-extrabold text-[#003366] tabular-nums">{pricing.recurringSubtotal.toFixed(2)} $</p>
              </div>
              {pricing.oneTimeSubtotal > 0 && (
                <>
                  <div className="w-px h-8 bg-slate-200" />
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{isFr ? "Unique" : "One-time"}</p>
                    <p className="text-lg md:text-xl font-extrabold text-slate-700 tabular-nums">{pricing.oneTimeSubtotal.toFixed(2)} $</p>
                  </div>
                </>
              )}
              <div className="w-px h-8 bg-slate-200 hidden md:block" />
              <div className="text-right hidden md:block">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{isFr ? "Total est." : "Est. total"}</p>
                <p className="text-lg font-extrabold text-slate-900 tabular-nums">~{fmt(pricing.grandTotal)}</p>
              </div>
            </div>

            {/* Right: CTA */}
            <Button
              onClick={handleContinue}
              disabled={!canProceed}
              className="h-11 md:h-12 px-6 md:px-8 text-sm md:text-base font-bold bg-[#003366] hover:bg-[#002244] rounded-xl shrink-0"
            >
              {isFr ? "Commander" : "Order"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══ Sub-components ═══ */

function SimulatorSectionHeader({ step, title, subtitle, optional }: { step: number; title: string; subtitle: string; optional?: boolean }) {
  return (
    <div className="text-center mb-8 md:mb-10">
      <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1 mb-3">
        <span className="w-5 h-5 rounded-full bg-[#003366] text-white flex items-center justify-center text-[10px] font-bold">{step}</span>
        {optional && <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-400">Optionnel</Badge>}
      </div>
      <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 mb-1">{title}</h2>
      <p className="text-sm text-slate-400 max-w-lg mx-auto">{subtitle}</p>
    </div>
  );
}

function StreamingTile({
  service, selected, onToggle, isFr,
}: {
  service: { id: string; name: string; description: string | null; monthly_price: number };
  selected: boolean; onToggle: () => void; isFr: boolean;
}) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        "rounded-xl border-2 p-4 cursor-pointer transition-all text-center",
        selected
          ? "border-[#003366] bg-[#003366]/[0.02] shadow-md"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2.5 transition-colors",
        selected ? "bg-[#003366] text-white" : "bg-slate-100 text-slate-400"
      )}>
        <MonitorPlay className="w-5 h-5" />
      </div>
      <p className="font-semibold text-sm text-slate-900 mb-0.5 truncate">{service.name}</p>
      <p className="text-xs text-slate-400 font-medium">{service.monthly_price.toFixed(2)} $/{isFr ? "mois" : "mo"}</p>
      {selected && (
        <div className="mt-2">
          <Badge className="bg-[#003366]/10 text-[#003366] border-0 text-[10px]">
            <Check className="w-3 h-3 mr-0.5" /> {isFr ? "Ajouté" : "Added"}
          </Badge>
        </div>
      )}
    </div>
  );
}

export default TVConfigurator;
