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

/* ─── Tax estimation — centralized server tax engine ─── */
import { estimateTaxes } from "@/lib/pricing/serverTaxEngine";

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
  else if (name.match(/1010/) || name.match(/1\s*010/)) speed = "1 010 Mbps";

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
  const canonicalFees = useCanonicalFees();

  // Canonical fee values (from DB, with fallbacks)
  const TECHNICIAN_INSTALL_FEE = canonicalFees.installationTechnician || 25;
  const STANDARD_DELIVERY_FEE = canonicalFees.deliverySelfInstall || 20;
  const ACTIVATION_FEE_SINGLE = canonicalFees.activationSingle || 10;

  // ─── Simulator step tracking ───
  const [activeStep, setActiveStep] = useState<SimulatorStep>(1);

  const { data: allServices = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["tv-configurator-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services_public")
        .select("id, name, category, price, description, billing_type, visible_simulator, display_order, status")
        .eq("visible_simulator", true)
        .eq("status", "active")
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("price", { ascending: true });
      if (error) throw error;
      return (data || []) as (ServicePublic & { visible_simulator?: boolean })[];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Equipment is ALWAYS loaded regardless of visibility flags — it's required for TV orders
  const { data: equipmentProducts = [], isLoading: equipmentLoading } = useQuery({
    queryKey: ["tv-configurator-equipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services_public")
        .select("id, name, category, price, description, billing_type, status")
        .eq("category", "Équipement")
        .eq("status", "active")
        .order("price", { ascending: true });
      if (error) throw error;
      return (data || []) as ServicePublic[];
    },
    staleTime: 0,
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
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Realtime: invalidate queries on any services table change
  useEffect(() => {
    const channel = supabase
      .channel("tv-configurator-live-catalog")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => {
        // staleTime: 0 ensures next render refetches; no manual invalidation needed here
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const tvPlans = useMemo(() => allServices.filter((s) => s.category === "TV"), [allServices]);
  // equipmentProducts loaded via separate query above (not filtered by visible_simulator)
  const terminalProduct = useMemo(() => equipmentProducts.find((e) => e.name.toLowerCase().includes("terminal")), [equipmentProducts]);
  const routerProduct = useMemo(
    () => equipmentProducts.find((e) => e.name.toLowerCase().includes("router") || e.name.toLowerCase().includes("borne")),
    [equipmentProducts],
  );
  const videoStreaming = useMemo(() => streamingServices.filter((s) => s.category === "video"), [streamingServices]);
  const musicStreaming = useMemo(() => streamingServices.filter((s) => s.category === "music"), [streamingServices]);

  // ─── Derive internet speeds + TV tiers from DB plans ───
  const internetSpeeds = useMemo(() => {
    const speeds: Array<{ key: string; label: string; speedNum: string }> = [];
    if (tvPlans.some(p => /Internet 100/i.test(p.name))) speeds.push({ key: '100', label: 'Internet 100', speedNum: '100' });
    if (tvPlans.some(p => /Internet 500/i.test(p.name))) speeds.push({ key: '500', label: 'Internet 500', speedNum: '500' });
    if (tvPlans.some(p => /GIGA/i.test(p.name))) speeds.push({ key: 'GIGA', label: 'Internet GIGA', speedNum: '940' });
    return speeds;
  }, [tvPlans]);

  const tvTiers = useMemo(() => {
    const tiers: Array<{ key: string; label: string; choix: number; totalChannels: number }> = [];
    const basePlan = tvPlans.find(p => p.name.toLowerCase().includes('la base'));
    if (basePlan) {
      const m = extractPlanMeta(basePlan);
      tiers.push({ key: 'la-base', label: isFr ? 'Télé La Base' : 'TV Base', choix: 0, totalChannels: m.channels || 24 });
    }
    [5, 10, 15, 25].forEach(n => {
      const plan = tvPlans.find(p => p.name.toLowerCase().includes(`${n} choix`));
      if (plan) {
        const m = extractPlanMeta(plan);
        tiers.push({ key: `${n}-choix`, label: isFr ? `Télé ${n} choix` : `TV ${n} picks`, choix: n, totalChannels: m.channels || (24 + n) });
      }
    });
    return tiers;
  }, [tvPlans, isFr]);

  // ─── Selection state ───
  const [selectedSpeedIndex, setSelectedSpeedIndex] = useState(internetSpeeds.length > 0 ? internetSpeeds.length - 1 : 0); // default GIGA
  const [selectedTierKey, setSelectedTierKey] = useState('15-choix');
  const [selectedStreamingIds, setSelectedStreamingIds] = useState<Set<string>>(new Set());
  const [extraTerminals, setExtraTerminals] = useState(0);
  const includeRouter = true;
  const [installMethod, setInstallMethod] = useState<InstallMethod>(null);

  // Init default speed index once plans load
  useEffect(() => {
    if (internetSpeeds.length > 0) setSelectedSpeedIndex(internetSpeeds.length - 1);
  }, [internetSpeeds.length]);

  // Init default tier once tiers load
  useEffect(() => {
    if (tvTiers.length > 0 && !tvTiers.find(t => t.key === selectedTierKey)) {
      setSelectedTierKey(tvTiers[Math.floor(tvTiers.length / 2)]?.key || tvTiers[0].key);
    }
  }, [tvTiers]);

  const goToSpeedIndex = (idx: number) => {
    setSelectedSpeedIndex(Math.max(0, Math.min(idx, internetSpeeds.length - 1)));
    setActiveStep(1);
  };

  // Find plan matching (speed + tier)
  const selectedPlan = useMemo(() => {
    const speed = internetSpeeds[selectedSpeedIndex];
    const tier = tvTiers.find(t => t.key === selectedTierKey);
    if (!speed || !tier) return tvPlans[0] || null;
    return tvPlans.find(p => {
      const n = p.name.toLowerCase();
      const hasSpeed = speed.key === 'GIGA' ? n.includes('giga') : n.includes(`internet ${speed.key}`);
      const hasTier = tier.choix === 0 ? n.includes('la base') : n.includes(`${tier.choix} choix`);
      return hasSpeed && hasTier;
    }) || null;
  }, [tvPlans, internetSpeeds, selectedSpeedIndex, selectedTierKey, tvTiers]);

  const selectedPlanId = selectedPlan?.id || null;
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
    const { tps, tvq, total: grandTotal } = estimateTaxes(taxableBase);

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
  const isLoading = servicesLoading || streamingLoading || equipmentLoading;
  const canProceed = !!selectedPlanId && !!installMethod;

  const scrollToStep = (step: SimulatorStep) => {
    setActiveStep(step);
    sectionRefs.current[step]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#020209' }} className="flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#7C3AED] mx-auto" />
          <p className="text-white/50 text-sm">{isFr ? "Chargement du simulateur..." : "Loading simulator..."}</p>
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
    <div style={{ minHeight: '100vh', background: '#020209' }} className="flex flex-col">
      <Header />
      {/* HERO */}
      <section className="relative overflow-hidden" style={{ paddingTop: 100, paddingBottom: 48 }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', animation: 'n-aurora-1 18s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', animation: 'n-aurora-2 14s ease-in-out infinite', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), rgba(6,182,212,0.4), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />
        <div className="container mx-auto px-4 max-w-[1100px] text-center" style={{ position: 'relative', zIndex: 2 }}>
          <div className="n-animate-in inline-flex items-center gap-2 mb-5" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 100, padding: '6px 16px' }}>
            <Tv style={{ width: 14, height: 14, color: '#7C3AED' }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#A78BFA', letterSpacing: '0.08em' }}>{isFr ? "SIMULATEUR NIVRA" : "NIVRA SIMULATOR"}</span>
          </div>
          <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(32px, 5vw, 56px)', letterSpacing: '-2.5px', lineHeight: 1.0, marginBottom: 16, color: '#fff' }}>
            {isFr ? <>Composez votre{' '}<span className="n-shimmer-text">forfait TV</span></> : <>Build your{' '}<span className="n-shimmer-text">TV package</span></>}
          </h1>
          <p className="n-animate-in-delay-2" style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', maxWidth: 480, margin: '0 auto' }}>
            {isFr
              ? "Sélectionnez votre plan, personnalisez vos options et commandez en quelques clics."
              : "Select your plan, customize your options and order in a few clicks."}
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* STEP PROGRESS BAR — telecom simulator nav */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl" style={{ background: 'rgba(2,2,9,0.85)' }}>
        <div className="container mx-auto px-4 max-w-[1100px]">
          <div className="flex items-center justify-between h-14 md:h-16 overflow-x-auto">
            {STEPS.map((step, i) => (
              <button
                key={step.num}
                onClick={() => scrollToStep(step.num)}
                className={cn(
                  "flex items-center gap-2.5 px-3 md:px-5 py-2 rounded-lg transition-colors whitespace-nowrap text-sm font-medium",
                  activeStep === step.num
                    ? "text-[#7C3AED]"
                    : step.done ? "text-white/55 hover:text-white/80" : "text-white/30"
                )}
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                  activeStep === step.num
                    ? "bg-[#7C3AED] text-white"
                    : step.done ? "bg-white/[0.08] text-white/65" : "bg-white/[0.04]/[0.02] text-white/30"
                )}>
                  {step.done && activeStep !== step.num ? <Check className="w-3.5 h-3.5" /> : step.num}
                </div>
                <span className="hidden sm:inline">{step.label}</span>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block w-8 lg:w-16 h-px bg-white/15 ml-2" />
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
          <div className="bg-white/[0.04]/[0.02] py-10 md:py-14">
            <div className="container mx-auto px-4 max-w-[1100px]">
              <SimulatorSectionHeader
                step={1}
                title={isFr ? "Composez votre forfait Internet + TV" : "Build your Internet + TV plan"}
                subtitle={isFr ? "Choisissez votre vitesse Internet, puis votre forfait TV — le prix s'ajuste automatiquement" : "Choose your Internet speed, then your TV tier — price updates instantly"}
              />

              {internetSpeeds.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.04] py-16 text-center">
                  <Tv className="w-10 h-10 text-white/30 mx-auto mb-3" />
                  <p className="text-white/40">{isFr ? "Aucun forfait disponible" : "No plans available"}</p>
                </div>
              ) : (
                <div>
                  {/* ── 1A: Internet speed carousel ── */}
                  <p className="text-center text-xs font-bold uppercase tracking-widest text-white/40 mb-5" style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: 2 }}>
                    {isFr ? '① Vitesse Internet' : '① Internet Speed'}
                  </p>

                  <div className="relative flex items-center justify-center gap-3 md:gap-5 mb-3" style={{ overflow: 'hidden', padding: '8px 0' }}>
                    {/* LEFT */}
                    <div
                      onClick={() => selectedSpeedIndex > 0 && goToSpeedIndex(selectedSpeedIndex - 1)}
                      style={{
                        flex: '0 0 clamp(160px, 24vw, 240px)',
                        opacity: selectedSpeedIndex > 0 ? 0.4 : 0,
                        transform: 'scale(0.86) translateX(24px)',
                        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
                        cursor: selectedSpeedIndex > 0 ? 'pointer' : 'default',
                        pointerEvents: selectedSpeedIndex > 0 ? 'auto' : 'none',
                        filter: 'brightness(0.55)',
                      }}
                    >
                      {selectedSpeedIndex > 0 && <SpeedCarouselCard speed={internetSpeeds[selectedSpeedIndex - 1]} isSelected={false} isFr={isFr} />}
                    </div>

                    {/* CENTER */}
                    <div style={{ flex: '0 0 clamp(240px, 32vw, 320px)', zIndex: 10, transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)' }}>
                      <SpeedCarouselCard speed={internetSpeeds[selectedSpeedIndex]} isSelected isFr={isFr} />
                    </div>

                    {/* RIGHT */}
                    <div
                      onClick={() => selectedSpeedIndex < internetSpeeds.length - 1 && goToSpeedIndex(selectedSpeedIndex + 1)}
                      style={{
                        flex: '0 0 clamp(160px, 24vw, 240px)',
                        opacity: selectedSpeedIndex < internetSpeeds.length - 1 ? 0.4 : 0,
                        transform: 'scale(0.86) translateX(-24px)',
                        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
                        cursor: selectedSpeedIndex < internetSpeeds.length - 1 ? 'pointer' : 'default',
                        pointerEvents: selectedSpeedIndex < internetSpeeds.length - 1 ? 'auto' : 'none',
                        filter: 'brightness(0.55)',
                      }}
                    >
                      {selectedSpeedIndex < internetSpeeds.length - 1 && <SpeedCarouselCard speed={internetSpeeds[selectedSpeedIndex + 1]} isSelected={false} isFr={isFr} />}
                    </div>
                  </div>

                  {/* Speed dots */}
                  <div className="flex items-center justify-center gap-2 mb-10">
                    <button onClick={() => goToSpeedIndex(selectedSpeedIndex - 1)} disabled={selectedSpeedIndex === 0}
                      className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-20"
                      style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)', color: '#A78BFA' }}>
                      <ChevronDown className="w-3.5 h-3.5 rotate-90" />
                    </button>
                    {internetSpeeds.map((_, i) => (
                      <button key={i} onClick={() => goToSpeedIndex(i)} style={{ width: i === selectedSpeedIndex ? 20 : 6, height: 6, borderRadius: 999, background: i === selectedSpeedIndex ? '#7C3AED' : 'rgba(255,255,255,0.2)', border: 'none', transition: 'all 0.3s', cursor: 'pointer', padding: 0 }} />
                    ))}
                    <button onClick={() => goToSpeedIndex(selectedSpeedIndex + 1)} disabled={selectedSpeedIndex === internetSpeeds.length - 1}
                      className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-20"
                      style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)', color: '#A78BFA' }}>
                      <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                    </button>
                  </div>

                  {/* ── 1B: TV tier comparison ── */}
                  <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.3), rgba(6,182,212,0.2), transparent)', marginBottom: 32 }} />

                  <p className="text-center text-xs font-bold uppercase tracking-widest text-white/40 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: 2 }}>
                    {isFr ? '② Comparez les forfaits divertissement télé' : '② Compare TV entertainment plans'}
                  </p>
                  <p className="text-center text-xs text-white/30 mb-6">{isFr ? 'Sélectionnez un forfait — le prix s\'ajuste automatiquement' : 'Select a plan — price updates automatically'}</p>

                  <div className="flex gap-3 overflow-x-auto pb-2 justify-start md:justify-center" style={{ scrollbarWidth: 'none' }}>
                    {tvTiers.map((tier) => {
                      const isTierSelected = selectedTierKey === tier.key;
                      const baseChannels = tier.choix > 0 ? tier.totalChannels - tier.choix : tier.totalChannels;
                      // Price for this tier with current speed
                      const tierPrice = tvPlans.find(p => {
                        const n = p.name.toLowerCase();
                        const spd = internetSpeeds[selectedSpeedIndex];
                        if (!spd) return false;
                        const hasSpeed = spd.key === 'GIGA' ? n.includes('giga') : n.includes(`internet ${spd.key}`);
                        const hasTier = tier.choix === 0 ? n.includes('la base') : n.includes(`${tier.choix} choix`);
                        return hasSpeed && hasTier;
                      })?.price;

                      return (
                        <div
                          key={tier.key}
                          onClick={() => setSelectedTierKey(tier.key)}
                          className="flex-shrink-0 cursor-pointer transition-all duration-200"
                          style={{
                            width: 155,
                            borderRadius: 16,
                            border: isTierSelected ? '2px solid rgba(124,58,237,0.7)' : '2px solid rgba(255,255,255,0.09)',
                            background: isTierSelected ? 'linear-gradient(160deg, rgba(124,58,237,0.2) 0%, rgba(10,10,15,1) 100%)' : 'rgba(255,255,255,0.04)',
                            boxShadow: isTierSelected ? '0 0 24px rgba(124,58,237,0.35)' : 'none',
                            overflow: 'hidden',
                            transform: isTierSelected ? 'translateY(-4px)' : 'translateY(0)',
                          }}
                        >
                          {/* Top accent */}
                          <div style={{ height: 3, background: isTierSelected ? 'linear-gradient(90deg, #7C3AED, #6D28D9)' : 'transparent', transition: 'all 0.2s' }} />

                          <div style={{ padding: '14px 14px 16px' }}>
                            {/* Tier name */}
                            <p style={{ fontSize: 12, fontWeight: 700, color: isTierSelected ? '#C4B5FD' : 'rgba(255,255,255,0.6)', marginBottom: 10, lineHeight: 1.3 }}>{tier.label}</p>

                            {/* Channel count big */}
                            <div className="flex items-baseline gap-1 mb-8px" style={{ marginBottom: 8 }}>
                              <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-2px', lineHeight: 1, color: isTierSelected ? '#fff' : 'rgba(255,255,255,0.65)' }}>{tier.totalChannels}</span>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 2 }}>{isFr ? 'ch.' : 'ch.'}</span>
                            </div>

                            {/* Base + choix breakdown */}
                            <div className="flex flex-col gap-1.5 mb-10px" style={{ marginBottom: 10 }}>
                              <span style={{ background: 'rgba(124,58,237,0.2)', borderRadius: 999, padding: '2px 7px', fontSize: 9.5, color: '#C4B5FD', fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
                                {baseChannels} {isFr ? 'La Base' : 'Base'}
                              </span>
                              {tier.choix > 0 && (
                                <span style={{ background: 'rgba(16,185,129,0.15)', borderRadius: 999, padding: '2px 7px', fontSize: 9.5, color: '#6EE7B7', fontWeight: 600, display: 'inline-block', width: 'fit-content' }}>
                                  +{tier.choix} {isFr ? 'au choix' : 'picks'}
                                </span>
                              )}
                            </div>

                            {/* Price */}
                            {tierPrice != null && (
                              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10, marginTop: 4 }}>
                                <span style={{ fontSize: 22, fontWeight: 800, color: isTierSelected ? '#A78BFA' : 'rgba(255,255,255,0.5)', letterSpacing: '-1px' }}>{tierPrice.toFixed(0)}</span>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 2 }}>$/{isFr ? 'mois' : 'mo'}</span>
                              </div>
                            )}

                            {isTierSelected && (
                              <div className="flex items-center gap-1 mt-2" style={{ color: '#A78BFA', fontSize: 10, fontWeight: 600 }}>
                                <Check className="w-3 h-3" strokeWidth={3} />
                                {isFr ? 'Sélectionné' : 'Selected'}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── STEP 2: Streaming ── */}
        {streamingServices.length > 0 && (
          <div ref={el => { sectionRefs.current[2] = el; }} className="scroll-mt-20">
            <div className="bg-white/[0.04] py-10 md:py-14 border-t border-white/10">
              <div className="container mx-auto px-4 max-w-[1100px]">
                <SimulatorSectionHeader
                  step={2}
                  title={isFr ? "Ajoutez du Streaming" : "Add Streaming"}
                  subtitle={isFr ? "Optionnel — ajoutez vos plateformes de streaming préférées à votre forfait" : "Optional — add your favorite streaming platforms to your package"}
                  optional
                />

                {videoStreaming.length > 0 && (
                  <div className="mb-8">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2 mb-4">
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
                    <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2 mb-4">
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
          <div className="bg-white/[0.04]/[0.02] py-10 md:py-14 border-t border-white/10">
            <div className="container mx-auto px-4 max-w-[1100px]">
              <SimulatorSectionHeader
                step={3}
                title={isFr ? "Votre équipement" : "Your equipment"}
                subtitle={isFr ? "Matériel nécessaire pour votre installation TV et Internet" : "Hardware needed for your TV and Internet setup"}
              />

              <div className="grid md:grid-cols-2 gap-5">
                {/* Terminal Card */}
                {terminalProduct && (
                  <div className="rounded-2xl border-2 border-[#7C3AED]/15 bg-white/[0.04] overflow-hidden">
                    <div className="bg-[#7C3AED]/5 px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-[#7C3AED]" />
                        <span className="text-xs font-bold text-[#7C3AED] uppercase tracking-wider">{isFr ? "Terminal TV" : "TV Terminal"}</span>
                      </div>
                      <Badge className="bg-[#7C3AED]/10 text-[#7C3AED] border-0 text-[10px] font-bold">{isFr ? "Requis" : "Required"}</Badge>
                    </div>
                    <div className="p-5">
                      <h4 className="font-bold text-white mb-1">{terminalProduct.name}</h4>
                      <p className="text-xs text-white/40 mb-4">{terminalProduct.description}</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-2xl font-extrabold text-white">{terminalProduct.price.toFixed(0)}</span>
                          <span className="text-sm text-white/40 ml-0.5">$ / {isFr ? "unité" : "unit"}</span>
                        </div>
                      </div>
                      <Separator className="my-4" />
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-white/65">{isFr ? "Quantité totale" : "Total quantity"}</span>
                        <div className="flex items-center gap-2.5">
                          <button onClick={() => setExtraTerminals(Math.max(0, extraTerminals - 1))} disabled={extraTerminals === 0}
                            className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/[0.04]/[0.02] disabled:opacity-20 transition-all">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center font-bold text-white tabular-nums">{totalTerminals}</span>
                          <button onClick={() => setExtraTerminals(Math.min(3, extraTerminals + 1))}
                            className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/[0.04]/[0.02] transition-all">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/40">{isFr ? "Sous-total équipement" : "Equipment subtotal"}</span>
                        <span className="text-sm font-bold text-white/80">{(terminalProduct.price * totalTerminals).toFixed(0)} $</span>
                      </div>
                      <p className="text-[10px] text-white/30 mt-2">{isFr ? "Minimum 1, maximum 4 terminaux par adresse" : "Minimum 1, maximum 4 terminals per address"}</p>
                    </div>
                  </div>
                )}

                {/* Router / Borne Card — ALWAYS REQUIRED */}
                {routerProduct && (
                  <div className="rounded-2xl border-2 border-[#7C3AED]/15 bg-white/[0.04] overflow-hidden">
                    <div className="bg-[#7C3AED]/5 px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-[#7C3AED]" />
                        <span className="text-xs font-bold text-[#7C3AED] uppercase tracking-wider">
                          {isFr ? "Borne WiFi (Routeur)" : "WiFi Router"}
                        </span>
                      </div>
                      <Badge className="bg-[#7C3AED]/10 text-[#7C3AED] border-0 text-[10px] font-bold">{isFr ? "Requis" : "Required"}</Badge>
                    </div>
                    <div className="p-5">
                      <h4 className="font-bold text-white mb-1">{routerProduct.name}</h4>
                      <p className="text-xs text-white/40 mb-4">{routerProduct.description || (isFr ? "1 borne requise par adresse" : "1 router required per address")}</p>
                      <div>
                        <span className="text-2xl font-extrabold text-white">{routerProduct.price.toFixed(0)}</span>
                        <span className="text-sm text-white/40 ml-0.5">$</span>
                      </div>
                      <p className="text-[10px] text-white/40 mt-3">{isFr ? "Exactement 1 borne par adresse · Inclus automatiquement" : "Exactly 1 per address · Automatically included"}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── STEP 4: Installation ── */}
        <div ref={el => { sectionRefs.current[4] = el; }} className="scroll-mt-20">
          <div className="bg-white/[0.04] py-10 md:py-14 border-t border-white/10">
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
                      ? "border-[#7C3AED] bg-[#7C3AED]/[0.02] shadow-xl shadow-purple-900/8"
                      : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:shadow-lg"
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors",
                    installMethod === "technician" ? "bg-[#7C3AED] text-white" : "bg-white/[0.08] text-white/40"
                  )}>
                    <Wrench className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-white mb-2">{isFr ? "Technicien à domicile" : "Home technician"}</h4>
                  <p className="text-lg font-extrabold text-[#7C3AED] mb-3">{TECHNICIAN_INSTALL_FEE} $</p>
                  <ul className="text-left space-y-2 text-xs text-white/55">
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
                      ? "border-[#7C3AED] bg-[#7C3AED]/[0.02] shadow-xl shadow-purple-900/8"
                      : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:shadow-lg"
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors",
                    installMethod === "self" ? "bg-[#7C3AED] text-white" : "bg-white/[0.08] text-white/40"
                  )}>
                    <Package className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-white mb-2">{isFr ? "Auto-installation" : "Self-install"}</h4>
                  <div className="mb-3">
                    <Badge className="bg-emerald-900/40 text-emerald-300 border-emerald-600/40 text-xs font-bold">{isFr ? "Gratuit" : "Free"}</Badge>
                    <span className="text-xs text-white/40 ml-2">+ {STANDARD_DELIVERY_FEE} $ {isFr ? "livraison" : "shipping"}</span>
                  </div>
                  <ul className="text-left space-y-2 text-xs text-white/55">
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
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/[0.04] border-t border-white/10 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.1)]">
        <div className="container mx-auto px-4 max-w-[1100px]">
          <div className="flex items-center justify-between h-[72px] md:h-20 gap-4">
            {/* Left: selected plan summary */}
            <div className="flex-1 min-w-0 hidden sm:block">
              {selectedPlan ? (
                <div>
                  <p className="text-xs text-white/40 font-medium">{isFr ? "Forfait sélectionné" : "Selected plan"}</p>
                  <p className="text-sm font-bold text-white truncate">{selectedPlan.name}</p>
                </div>
              ) : (
                <p className="text-sm text-white/40">{isFr ? "Aucun forfait sélectionné" : "No plan selected"}</p>
              )}
            </div>

            {/* Center: pricing breakdown */}
            <div className="flex items-center gap-4 md:gap-6">
              <div className="text-right">
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{isFr ? "Mensuel" : "Monthly"}</p>
                <p className="text-lg md:text-xl font-extrabold text-[#7C3AED] tabular-nums">{pricing.recurringSubtotal.toFixed(2)} $</p>
              </div>
              {pricing.oneTimeSubtotal > 0 && (
                <>
                  <div className="w-px h-8 bg-white/15" />
                  <div className="text-right">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{isFr ? "Unique" : "One-time"}</p>
                    <p className="text-lg md:text-xl font-extrabold text-white/80 tabular-nums">{pricing.oneTimeSubtotal.toFixed(2)} $</p>
                  </div>
                </>
              )}
              <div className="w-px h-8 bg-white/15 hidden md:block" />
              <div className="text-right hidden md:block">
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{isFr ? "Total est." : "Est. total"}</p>
                <p className="text-lg font-extrabold text-white tabular-nums">~{fmt(pricing.grandTotal)}</p>
              </div>
            </div>

            {/* Right: CTA */}
            <Button
              onClick={handleContinue}
              disabled={!canProceed}
              className="h-11 md:h-12 px-6 md:px-8 text-sm md:text-base font-bold bg-[#7C3AED] hover:bg-[#002244] rounded-xl shrink-0"
            >
              {isFr ? "Commander" : "Order"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

/* ═══ Sub-components ═══ */

function SimulatorSectionHeader({ step, title, subtitle, optional }: { step: number; title: string; subtitle: string; optional?: boolean }) {
  return (
    <div className="text-center mb-8 md:mb-10">
      <div className="inline-flex items-center gap-2 bg-white/[0.08] rounded-full px-3 py-1 mb-3">
        <span className="w-5 h-5 rounded-full bg-[#7C3AED] text-white flex items-center justify-center text-[10px] font-bold">{step}</span>
        {optional && <Badge variant="outline" className="text-[10px] border-slate-300 text-white/40">Optionnel</Badge>}
      </div>
      <h2 className="text-xl md:text-2xl font-extrabold text-white mb-1">{title}</h2>
      <p className="text-sm text-white/40 max-w-lg mx-auto">{subtitle}</p>
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
          ? "border-[#7C3AED] bg-[#7C3AED]/[0.02] shadow-md"
          : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:shadow-sm"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2.5 transition-colors",
        selected ? "bg-[#7C3AED] text-white" : "bg-white/[0.08] text-white/40"
      )}>
        <MonitorPlay className="w-5 h-5" />
      </div>
      <p className="font-semibold text-sm text-white mb-0.5 truncate">{service.name}</p>
      <p className="text-xs text-white/40 font-medium">{service.monthly_price.toFixed(2)} $/{isFr ? "mois" : "mo"}</p>
      {selected && (
        <div className="mt-2">
          <Badge className="bg-[#7C3AED]/10 text-[#7C3AED] border-0 text-[10px]">
            <Check className="w-3 h-3 mr-0.5" /> {isFr ? "Ajouté" : "Added"}
          </Badge>
        </div>
      )}
    </div>
  );
}

function SpeedCarouselCard({ speed, isSelected, isFr }: { speed: { key: string; label: string; speedNum: string }; isSelected: boolean; isFr: boolean }) {
  const isGiga = speed.key === 'GIGA';
  return (
    <div className="relative rounded-2xl overflow-hidden" style={{
      background: isSelected ? 'linear-gradient(160deg, rgba(124,58,237,0.2) 0%, rgba(10,10,15,1) 100%)' : 'rgba(255,255,255,0.05)',
      border: isSelected ? '2px solid rgba(124,58,237,0.6)' : '2px solid rgba(255,255,255,0.1)',
      boxShadow: isSelected ? '0 0 40px rgba(124,58,237,0.35)' : '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      {/* PRIX À VIE banner */}
      <div className="flex items-center justify-center gap-2 font-bold uppercase" style={{
        background: isSelected ? 'linear-gradient(90deg, #7C3AED, #6D28D9)' : 'linear-gradient(90deg, rgba(124,58,237,0.45), rgba(109,40,217,0.45))',
        color: '#fff', padding: '8px 0', fontSize: 9, letterSpacing: 1.8,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
        {isFr ? 'PRIX À VIE GARANTI' : 'PRICE LOCKED FOR LIFE'}
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
      </div>

      <div style={{ padding: '18px 18px 20px' }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, color: isSelected ? '#C4B5FD' : 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace", marginBottom: 12 }}>
          {isFr ? 'FORFAIT INTERNET' : 'INTERNET PLAN'}
        </p>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-0.4px' }}>{speed.label}</h3>

        <div style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.22)', borderRadius: 12, padding: '14px 16px' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Wifi className="w-3 h-3" style={{ color: '#67E8F9' }} />
            <span style={{ color: '#67E8F9', fontSize: 8.5, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>INTERNET</span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-2.5px', lineHeight: 1, color: '#fff' }}>{speed.speedNum}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{isFr ? 'Mbit/s' : 'Mbit/s'}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
              <Check className="w-3 h-3 shrink-0" strokeWidth={3} style={{ color: '#67E8F9' }} />
              {isFr ? `Jusqu'à ${speed.speedNum} Mbit/s` : `Up to ${speed.speedNum} Mbit/s`}
            </div>
            <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
              <Check className="w-3 h-3 shrink-0" strokeWidth={3} style={{ color: '#67E8F9' }} />
              {isFr ? 'Données illimitées' : 'Unlimited data'}
            </div>
            {isGiga && (
              <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                <Zap className="w-3 h-3 shrink-0" style={{ color: '#F59E0B' }} />
                {isFr ? 'Ultra-faible latence' : 'Ultra-low latency'}
              </div>
            )}
          </div>
        </div>

        {isSelected && (
          <div className="flex items-center justify-center gap-1.5 mt-3" style={{ color: '#A78BFA', fontSize: 11, fontWeight: 600 }}>
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
            {isFr ? 'Vitesse sélectionnée' : 'Selected speed'}
          </div>
        )}
      </div>
    </div>
  );
}

function PlanCarouselCard({ plan, isSelected, isFr }: { plan: ServicePublic; isSelected: boolean; isFr: boolean }) {
  const meta = extractPlanMeta(plan);
  const baseChannels = meta.choix > 0 ? meta.channels - meta.choix : meta.channels;
  const isGiga = meta.speed === "GIGA";

  return (
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: isSelected
          ? 'linear-gradient(160deg, rgba(124,58,237,0.2) 0%, rgba(10,10,15,1) 100%)'
          : 'rgba(255,255,255,0.05)',
        border: isSelected ? '2px solid rgba(124,58,237,0.6)' : '2px solid rgba(255,255,255,0.1)',
        boxShadow: isSelected ? '0 0 40px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* PRIX À VIE banner */}
      <div style={{ position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div className="flex items-center justify-center gap-2 font-bold uppercase" style={{
          background: isSelected ? 'linear-gradient(90deg, #7C3AED, #6D28D9)' : 'linear-gradient(90deg, rgba(124,58,237,0.5), rgba(109,40,217,0.5))',
          color: '#fff', padding: '8px 0', fontSize: 9, letterSpacing: 1.8,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
          {isFr ? 'PRIX À VIE GARANTI' : 'PRICE LOCKED FOR LIFE'}
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
        </div>
        {isSelected && <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '30%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)', animation: 'n-beam-h 4s ease-in-out infinite' }} />}
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Name + price */}
        <div className="flex items-start justify-between gap-2">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.3, flex: 1 }}>{plan.name}</h3>
          <div className="text-right shrink-0">
            <div style={{ fontSize: 28, fontWeight: 800, color: '#A78BFA', lineHeight: 1 }}>{plan.price.toFixed(0)}<span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>$</span></div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>/{isFr ? 'mois' : 'mo'}</div>
          </div>
        </div>

        {/* TÉLÉ */}
        {meta.channels > 0 && (
          <div style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.22)', borderRadius: 10, padding: '10px 12px' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Tv className="w-2.5 h-2.5 shrink-0" style={{ color: '#A78BFA' }} />
              <span style={{ color: '#A78BFA', fontSize: 8.5, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>{isFr ? 'TÉLÉ' : 'TV'}</span>
            </div>
            <div className="flex items-baseline gap-1 mb-1.5">
              <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1, color: '#fff' }}>{meta.channels}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{isFr ? 'chaînes' : 'ch.'}</span>
            </div>
            {meta.choix > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 999, padding: '1px 7px', fontSize: 10, color: '#C4B5FD', fontWeight: 600 }}>
                  {baseChannels} {isFr ? 'La Base' : 'Base'}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>+</span>
                <span style={{ background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 999, padding: '1px 7px', fontSize: 10, color: '#6EE7B7', fontWeight: 600 }}>
                  {meta.choix} {isFr ? 'choix' : 'picks'}
                </span>
              </div>
            ) : (
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{isFr ? 'Chaînes La Base' : 'Base channels'}</span>
            )}
          </div>
        )}

        {/* INTERNET */}
        {meta.speed && (
          <div style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 10, padding: '10px 12px' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Wifi className="w-2.5 h-2.5 shrink-0" style={{ color: '#67E8F9' }} />
              <span style={{ color: '#67E8F9', fontSize: 8.5, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>INTERNET</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{isGiga ? 'GIGA 940 Mbit/s' : `${meta.speed} illimité`}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 }}>{isFr ? 'Données illimitées' : 'Unlimited data'}</p>
              </div>
              {isGiga && <Zap className="w-4 h-4 shrink-0" style={{ color: '#F59E0B' }} />}
            </div>
          </div>
        )}

        {/* Selected indicator */}
        {isSelected && (
          <div className="flex items-center justify-center gap-1.5 pt-1" style={{ color: '#A78BFA', fontSize: 11, fontWeight: 600 }}>
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
            {isFr ? 'Forfait sélectionné' : 'Selected plan'}
          </div>
        )}
      </div>
    </div>
  );
}

export default TVConfigurator;
