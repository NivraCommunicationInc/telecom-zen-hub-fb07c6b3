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
  ArrowRight, MonitorPlay, Loader2, Package, Music,
  Zap, ChevronDown, Star, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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

/* ─── helpers ─── */
function matchesSpeed(planName: string, speedKey: string): boolean {
  const n = planName.toLowerCase();
  if (speedKey === 'GIGA') return /giga/i.test(n);
  if (speedKey === '500')  return /\b500\b/.test(n) && !/giga/i.test(n);
  if (speedKey === '100')  return /\b100\b/.test(n) && !/500/.test(n) && !/giga/i.test(n);
  return false;
}

function matchesTier(planName: string, choix: number): boolean {
  const n = planName.toLowerCase();
  if (choix === 0) return /la\s*base/i.test(n) || /basic/i.test(n);
  return new RegExp(`\\b${choix}\\s*choix\\b`, 'i').test(n);
}

function extractFeatures(description: string | null): string[] {
  if (!description) return [];
  return description
    .split(/[•|]/)
    .map(s => s.trim())
    .filter(s => s.length > 5 && s.length < 90);
}

function extractChannels(description: string | null): number {
  if (!description) return 0;
  const m = description.match(/(\d+)\s*chaînes?\s+au\s+total/i)
    || description.match(/^(\d+)\s*chaînes?/i)
    || description.match(/(\d+)\s*chaînes?/i);
  return m ? parseInt(m[1]) : 0;
}

/* ─── Catalog builder ─── */
interface SpeedItem { key: string; label: string; speedNum: string }
interface TierItem  { key: string; choix: number; totalChannels: number; baseChannels: number; features: string[] }

function buildCatalog(tvPlans: ServicePublic[]) {
  // Speeds
  const speeds: SpeedItem[] = [];
  if (tvPlans.some(p => matchesSpeed(p.name, '100')))  speeds.push({ key: '100',  label: 'Internet 100',  speedNum: '100'  });
  if (tvPlans.some(p => matchesSpeed(p.name, '500')))  speeds.push({ key: '500',  label: 'Internet 500',  speedNum: '500'  });
  if (tvPlans.some(p => matchesSpeed(p.name, 'GIGA'))) speeds.push({ key: 'GIGA', label: 'Internet GIGA', speedNum: '940'  });

  // TV tiers (La Base + 5/10/15/25 choix)
  const tierDefs = [
    { key: 'la-base', choix: 0  },
    { key: '5-choix', choix: 5  },
    { key: '10-choix', choix: 10 },
    { key: '15-choix', choix: 15 },
    { key: '25-choix', choix: 25 },
  ];
  const tiers: TierItem[] = [];
  tierDefs.forEach(({ key, choix }) => {
    // Use the first matching plan to extract channel/feature info
    const sample = tvPlans.find(p => matchesTier(p.name, choix));
    if (!sample) return;
    const total = extractChannels(sample.description);
    const base  = choix > 0 ? (total > 0 ? total - choix : 24) : (total > 0 ? total : 24);
    tiers.push({
      key,
      choix,
      totalChannels: total > 0 ? total : (choix === 0 ? 24 : 24 + choix),
      baseChannels: base,
      features: extractFeatures(sample.description),
    });
  });

  // Price matrix: `${speedKey}|${tierKey}` → ServicePublic
  const matrix = new Map<string, ServicePublic>();
  speeds.forEach(spd => {
    tiers.forEach(tier => {
      const plan = tvPlans.find(p => matchesSpeed(p.name, spd.key) && matchesTier(p.name, tier.choix));
      if (plan) matrix.set(`${spd.key}|${tier.key}`, plan);
    });
  });

  return { speeds, tiers, matrix };
}

/* ═══════════════════════════════════════════════════════ */

const TVConfigurator = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isFr = language === "fr";
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const canonicalFees = useCanonicalFees();

  const TECHNICIAN_INSTALL_FEE = canonicalFees.installationTechnician || 25;
  const STANDARD_DELIVERY_FEE = canonicalFees.deliverySelfInstall || 20;
  const ACTIVATION_FEE_SINGLE  = canonicalFees.activationSingle || 10;

  const [activeStep, setActiveStep] = useState<SimulatorStep>(1);

  /* ─── Data fetching ─── */
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
      return (data || []) as ServicePublic[];
    },
    staleTime: 0,
  });

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
  });

  const tvPlans = useMemo(() => allServices.filter(s => s.category === "TV"), [allServices]);
  const terminalProduct = useMemo(() => equipmentProducts.find(e => e.name.toLowerCase().includes("terminal")), [equipmentProducts]);
  const routerProduct   = useMemo(() => equipmentProducts.find(e => e.name.toLowerCase().includes("router") || e.name.toLowerCase().includes("borne")), [equipmentProducts]);
  const videoStreaming   = useMemo(() => streamingServices.filter(s => s.category === "video"), [streamingServices]);
  const musicStreaming   = useMemo(() => streamingServices.filter(s => s.category === "music"), [streamingServices]);

  /* ─── Catalog (speeds + tiers + price matrix) ─── */
  const catalog = useMemo(() => buildCatalog(tvPlans), [tvPlans]);

  /* ─── Selection state ─── */
  const [selectedSpeedIdx, setSelectedSpeedIdx] = useState(0);
  const [selectedTierKey,  setSelectedTierKey]  = useState('15-choix');
  const [selectedStreamingIds, setSelectedStreamingIds] = useState<Set<string>>(new Set());
  const [extraTerminals, setExtraTerminals] = useState(0);
  const includeRouter = true;
  const [installMethod, setInstallMethod] = useState<InstallMethod>(null);

  // Set defaults once catalog loads
  useEffect(() => {
    if (catalog.speeds.length > 0) {
      setSelectedSpeedIdx(catalog.speeds.length - 1); // fastest by default
    }
  }, [catalog.speeds.length]);

  useEffect(() => {
    if (catalog.tiers.length > 0 && !catalog.tiers.find(t => t.key === selectedTierKey)) {
      setSelectedTierKey(catalog.tiers[Math.min(2, catalog.tiers.length - 1)].key);
    }
  }, [catalog.tiers.length]); // eslint-disable-line

  /* ─── Derived selected plan ─── */
  const selectedPlan = useMemo<ServicePublic | null>(() => {
    if (!catalog.speeds.length || !catalog.tiers.length) return null;
    const spd = catalog.speeds[Math.min(selectedSpeedIdx, catalog.speeds.length - 1)];
    return catalog.matrix.get(`${spd.key}|${selectedTierKey}`) || null;
  }, [catalog, selectedSpeedIdx, selectedTierKey]);

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
    const oneTimeItems:   { name: string; price: number }[] = [];

    if (selectedPlan) recurringItems.push({ name: selectedPlan.name, price: selectedPlan.price });
    selectedStreamingIds.forEach(id => {
      const svc = streamingServices.find(s => s.id === id);
      if (svc) recurringItems.push({ name: svc.name, price: svc.monthly_price });
    });
    if (terminalProduct) oneTimeItems.push({ name: `${terminalProduct.name}${totalTerminals > 1 ? ` ×${totalTerminals}` : ""}`, price: terminalProduct.price * totalTerminals });
    if (includeRouter && routerProduct) oneTimeItems.push({ name: routerProduct.name, price: routerProduct.price });
    if (selectedPlan) oneTimeItems.push({ name: "Activation", price: ACTIVATION_FEE_SINGLE });
    if (installMethod === "technician") oneTimeItems.push({ name: isFr ? "Installation technicien" : "Technician install", price: TECHNICIAN_INSTALL_FEE });
    if (installMethod === "self") oneTimeItems.push({ name: isFr ? "Livraison" : "Shipping", price: STANDARD_DELIVERY_FEE });

    const recurringSubtotal = recurringItems.reduce((s, i) => s + i.price, 0);
    const oneTimeSubtotal   = oneTimeItems.reduce((s, i) => s + i.price, 0);
    const { total: grandTotal } = estimateTaxes(recurringSubtotal + oneTimeSubtotal);
    return { recurringItems, oneTimeItems, recurringSubtotal, oneTimeSubtotal, grandTotal };
  }, [selectedPlan, selectedStreamingIds, streamingServices, terminalProduct, totalTerminals, routerProduct, installMethod, isFr, ACTIVATION_FEE_SINGLE, TECHNICIAN_INSTALL_FEE, STANDARD_DELIVERY_FEE]);

  const handleContinue = () => {
    if (!selectedPlan) return;
    const payload: TVCartPayload = {
      source: "tv-configurator", version: 3, selectedPlanId: selectedPlan.id,
      selectedStreamingIds: Array.from(selectedStreamingIds),
      terminalProductId: terminalProduct?.id || null, terminalQuantity: totalTerminals,
      routerProductId: includeRouter && routerProduct ? routerProduct.id : null,
      installationChoice: installMethod === "technician" ? "technician" : installMethod === "self" ? "auto" : null,
      includeShipping: installMethod === "self", createdAt: new Date().toISOString(),
    };
    sessionStorage.setItem("nivra_tv_cart", JSON.stringify(payload));
    navigate(`/commander?plan=${selectedPlan.id}`);
  };

  const fmt = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " $";
  const isLoading   = servicesLoading || streamingLoading || equipmentLoading;
  const canProceed  = !!selectedPlan && !!installMethod;

  const goToSpeed = (idx: number) => {
    setSelectedSpeedIdx(Math.max(0, Math.min(idx, catalog.speeds.length - 1)));
    setActiveStep(1);
  };

  const STEPS = [
    { num: 1 as SimulatorStep, label: isFr ? "Forfait" : "Plan",       done: !!selectedPlan },
    { num: 2 as SimulatorStep, label: "Streaming",                       done: true },
    { num: 3 as SimulatorStep, label: isFr ? "Équipement" : "Equipment", done: true },
    { num: 4 as SimulatorStep, label: "Installation",                    done: !!installMethod },
  ];

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

  const scrollToStep = (step: SimulatorStep) => {
    setActiveStep(step);
    sectionRefs.current[step]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#020209' }} className="flex flex-col">
      <Header />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden" style={{ paddingTop: 100, paddingBottom: 48 }}>
        <div aria-hidden style={{ position: 'absolute', top: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', animation: 'n-aurora-1 18s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', animation: 'n-aurora-2 14s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />
        <div className="container mx-auto px-4 max-w-[1100px] text-center relative">
          <div className="inline-flex items-center gap-2 mb-5" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 100, padding: '6px 16px' }}>
            <Tv style={{ width: 14, height: 14, color: '#7C3AED' }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#A78BFA', letterSpacing: '0.08em' }}>{isFr ? "SIMULATEUR NIVRA" : "NIVRA SIMULATOR"}</span>
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(32px, 5vw, 56px)', letterSpacing: '-2.5px', lineHeight: 1.0, marginBottom: 16, color: '#fff' }}>
            {isFr ? <>Composez votre{' '}<span className="n-shimmer-text">forfait TV</span></> : <>Build your{' '}<span className="n-shimmer-text">TV package</span></>}
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', maxWidth: 480, margin: '0 auto' }}>
            {isFr ? "Choisissez votre vitesse Internet, puis votre forfait TV — prix instantané." : "Choose your Internet speed, then your TV tier — instant pricing."}
          </p>
        </div>
      </section>

      {/* ── Step nav ── */}
      <div className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl" style={{ background: 'rgba(2,2,9,0.85)' }}>
        <div className="container mx-auto px-4 max-w-[1100px]">
          <div className="flex items-center justify-between h-14 md:h-16 overflow-x-auto">
            {STEPS.map((step, i) => (
              <button key={step.num} onClick={() => scrollToStep(step.num)}
                className={cn("flex items-center gap-2.5 px-3 md:px-5 py-2 rounded-lg transition-colors whitespace-nowrap text-sm font-medium",
                  activeStep === step.num ? "text-[#7C3AED]" : step.done ? "text-white/55 hover:text-white/80" : "text-white/30"
                )}>
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                  activeStep === step.num ? "bg-[#7C3AED] text-white" : step.done ? "bg-white/[0.08] text-white/65" : "bg-white/[0.04] text-white/30"
                )}>
                  {step.done && activeStep !== step.num ? <Check className="w-3.5 h-3.5" /> : step.num}
                </div>
                <span className="hidden sm:inline">{step.label}</span>
                {i < STEPS.length - 1 && <div className="hidden md:block w-8 lg:w-16 h-px bg-white/15 ml-2" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 pb-40">

        {/* ══════════════════════════════════════ */}
        {/* STEP 1 — Internet speed + TV tier     */}
        {/* ══════════════════════════════════════ */}
        <div ref={el => { sectionRefs.current[1] = el; }} className="scroll-mt-20">
          <div className="py-10 md:py-14" style={{ background: 'rgba(255,255,255,0.01)' }}>
            <div className="container mx-auto px-4 max-w-[1100px]">
              <SimulatorSectionHeader
                step={1}
                title={isFr ? "Composez votre forfait Internet + TV" : "Build your Internet + TV plan"}
                subtitle={isFr ? "① Choisissez votre vitesse Internet · ② Choisissez votre forfait TV · Prix instantané" : "① Choose Internet speed · ② Choose TV tier · Instant pricing"}
              />

              {catalog.speeds.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.04] py-16 text-center">
                  <Tv className="w-10 h-10 text-white/30 mx-auto mb-3" />
                  <p className="text-white/40">{isFr ? "Aucun forfait disponible" : "No plans available"}</p>
                </div>
              ) : (<>

                {/* ── 1A: Internet speed carousel ── */}
                <p className="text-center text-[10px] font-bold uppercase tracking-[3px] text-white/35 mb-5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {isFr ? '① Vitesse Internet' : '① Internet Speed'}
                </p>

                <div className="flex items-center justify-center gap-3 md:gap-4 mb-3" style={{ overflow: 'hidden', padding: '8px 0' }}>
                  {/* LEFT */}
                  <div onClick={() => selectedSpeedIdx > 0 && goToSpeed(selectedSpeedIdx - 1)} style={{
                    flex: '0 0 clamp(150px, 22vw, 230px)',
                    opacity: selectedSpeedIdx > 0 ? 0.38 : 0,
                    transform: selectedSpeedIdx > 0 ? 'scale(0.85) translateX(20px)' : 'scale(0.85)',
                    transition: 'all 0.28s ease',
                    cursor: selectedSpeedIdx > 0 ? 'pointer' : 'default',
                    pointerEvents: selectedSpeedIdx > 0 ? 'auto' : 'none',
                  }}>
                    {selectedSpeedIdx > 0 && <SpeedCard speed={catalog.speeds[selectedSpeedIdx - 1]} isSelected={false} isFr={isFr} />}
                  </div>
                  {/* CENTER */}
                  <div style={{ flex: '0 0 clamp(240px, 30vw, 310px)', zIndex: 10, transition: 'all 0.28s ease' }}>
                    <SpeedCard speed={catalog.speeds[selectedSpeedIdx]} isSelected isFr={isFr} />
                  </div>
                  {/* RIGHT */}
                  <div onClick={() => selectedSpeedIdx < catalog.speeds.length - 1 && goToSpeed(selectedSpeedIdx + 1)} style={{
                    flex: '0 0 clamp(150px, 22vw, 230px)',
                    opacity: selectedSpeedIdx < catalog.speeds.length - 1 ? 0.38 : 0,
                    transform: selectedSpeedIdx < catalog.speeds.length - 1 ? 'scale(0.85) translateX(-20px)' : 'scale(0.85)',
                    transition: 'all 0.28s ease',
                    cursor: selectedSpeedIdx < catalog.speeds.length - 1 ? 'pointer' : 'default',
                    pointerEvents: selectedSpeedIdx < catalog.speeds.length - 1 ? 'auto' : 'none',
                  }}>
                    {selectedSpeedIdx < catalog.speeds.length - 1 && <SpeedCard speed={catalog.speeds[selectedSpeedIdx + 1]} isSelected={false} isFr={isFr} />}
                  </div>
                </div>

                {/* Dots */}
                <div className="flex items-center justify-center gap-2 mb-10">
                  <button onClick={() => goToSpeed(selectedSpeedIdx - 1)} disabled={selectedSpeedIdx === 0}
                    className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-20 transition-opacity"
                    style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)', color: '#A78BFA' }}>
                    <ChevronDown className="w-3.5 h-3.5 rotate-90" />
                  </button>
                  {catalog.speeds.map((_, i) => (
                    <button key={i} onClick={() => goToSpeed(i)} style={{
                      width: i === selectedSpeedIdx ? 22 : 6, height: 6,
                      borderRadius: 999, background: i === selectedSpeedIdx ? '#7C3AED' : 'rgba(255,255,255,0.2)',
                      border: 'none', transition: 'all 0.25s', cursor: 'pointer', padding: 0,
                    }} />
                  ))}
                  <button onClick={() => goToSpeed(selectedSpeedIdx + 1)} disabled={selectedSpeedIdx === catalog.speeds.length - 1}
                    className="w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-20 transition-opacity"
                    style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)', color: '#A78BFA' }}>
                    <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                  </button>
                </div>

                {/* ── 1B: TV tier comparison ── */}
                <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.3), rgba(6,182,212,0.2), transparent)', marginBottom: 28 }} />

                <p className="text-center text-[10px] font-bold uppercase tracking-[3px] text-white/35 mb-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {isFr ? '② Comparez les forfaits divertissement télé' : '② Compare TV entertainment plans'}
                </p>
                <p className="text-center text-xs text-white/30 mb-6">
                  {isFr ? 'Le prix s\'ajuste selon votre vitesse Internet sélectionnée ci-dessus' : 'Price adjusts based on Internet speed selected above'}
                </p>

                <div className="flex gap-4 overflow-x-auto pb-3 px-1 justify-start md:justify-center" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(124,58,237,0.3) transparent' }}>
                  {catalog.tiers.map(tier => {
                    const isSel = selectedTierKey === tier.key;
                    const spd   = catalog.speeds[Math.min(selectedSpeedIdx, catalog.speeds.length - 1)];
                    const plan  = spd ? catalog.matrix.get(`${spd.key}|${tier.key}`) : null;

                    return (
                      <div
                        key={tier.key}
                        onClick={() => setSelectedTierKey(tier.key)}
                        className="flex-shrink-0 cursor-pointer"
                        style={{
                          width: 200,
                          borderRadius: 18,
                          border: isSel ? '2px solid rgba(124,58,237,0.75)' : '2px solid rgba(255,255,255,0.08)',
                          background: isSel ? 'linear-gradient(160deg, rgba(124,58,237,0.22) 0%, rgba(10,10,15,1) 100%)' : 'rgba(255,255,255,0.04)',
                          boxShadow: isSel ? '0 0 28px rgba(124,58,237,0.4)' : '0 2px 12px rgba(0,0,0,0.3)',
                          transform: isSel ? 'translateY(-6px)' : 'translateY(0)',
                          transition: 'all 0.2s ease',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Top bar */}
                        <div style={{ height: 4, background: isSel ? 'linear-gradient(90deg, #7C3AED, #6D28D9)' : 'rgba(255,255,255,0.05)', transition: 'background 0.2s' }} />

                        <div style={{ padding: '16px 16px 18px' }}>
                          {/* Tier label */}
                          <div className="flex items-center justify-between mb-3">
                            <p style={{ fontSize: 12.5, fontWeight: 700, color: isSel ? '#C4B5FD' : 'rgba(255,255,255,0.65)', lineHeight: 1.3 }}>
                              {isFr ? (tier.choix === 0 ? 'Télé La Base' : `Télé ${tier.choix} choix`) : (tier.choix === 0 ? 'TV Base' : `TV ${tier.choix} picks`)}
                            </p>
                            {isSel && <Check className="w-4 h-4 text-[#A78BFA]" strokeWidth={2.5} />}
                          </div>

                          {/* Big channel count */}
                          <div className="flex items-baseline gap-1 mb-3">
                            <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-3px', lineHeight: 1, color: isSel ? '#fff' : 'rgba(255,255,255,0.7)' }}>{tier.totalChannels}</span>
                            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginLeft: 3, marginBottom: 4 }}>{isFr ? 'chaînes' : 'ch.'}</span>
                          </div>

                          {/* La Base + choix pills */}
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            <span style={{ background: 'rgba(124,58,237,0.22)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 999, padding: '2px 8px', fontSize: 10.5, color: '#C4B5FD', fontWeight: 600 }}>
                              {tier.baseChannels} {isFr ? 'La Base' : 'Base'}
                            </span>
                            {tier.choix > 0 && (
                              <span style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 999, padding: '2px 8px', fontSize: 10.5, color: '#6EE7B7', fontWeight: 600 }}>
                                +{tier.choix} {isFr ? 'au choix' : 'picks'}
                              </span>
                            )}
                          </div>

                          {/* Key features from plan description */}
                          <div className="flex flex-col gap-1.5 mb-3">
                            {(tier.choix > 0
                              ? [isFr ? `Chaînes Populaires et Sportives` : 'Popular & Sports channels', isFr ? 'Données illimitées incluses' : 'Unlimited data included', isFr ? 'Prix à vie garanti' : 'Price locked for life']
                              : [isFr ? 'TVA · ICI RC · Noovo · CTV' : 'TVA · ICI RC · Noovo · CTV', isFr ? 'Données illimitées incluses' : 'Unlimited data included', isFr ? 'Prix à vie garanti' : 'Price locked for life']
                            ).map((f, i) => (
                              <div key={i} className="flex items-start gap-1.5" style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                                <Check className="w-3 h-3 shrink-0 mt-0.5" strokeWidth={2.5} style={{ color: isSel ? '#A78BFA' : 'rgba(255,255,255,0.3)' }} />
                                {f}
                              </div>
                            ))}
                          </div>

                          {/* Price */}
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
                            {plan ? (
                              <>
                                <span style={{ fontSize: 28, fontWeight: 800, color: isSel ? '#A78BFA' : 'rgba(255,255,255,0.6)', letterSpacing: '-1px', lineHeight: 1 }}>{plan.price.toFixed(0)}</span>
                                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginLeft: 3 }}>$/{isFr ? 'mois' : 'mo'}</span>
                                <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5 }}>
                                  {isFr ? 'TAXES INCL. · PRIX À VIE' : 'TAXES INCL. · LIFE PRICE'}
                                </p>
                              </>
                            ) : (
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>{isFr ? 'Non disponible' : 'Not available'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected plan summary */}
                {selectedPlan && (
                  <div className="flex items-center justify-center gap-3 mt-8 px-4 py-3 mx-auto" style={{ maxWidth: 520, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 14 }}>
                    <Check className="w-4 h-4 text-[#A78BFA] shrink-0" strokeWidth={2.5} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{selectedPlan.name}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{isFr ? 'Prix à vie garanti — peut seulement diminuer' : 'Price locked for life — can only go down'}</p>
                    </div>
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#A78BFA', marginLeft: 'auto', letterSpacing: '-1px' }}>{selectedPlan.price.toFixed(0)} $</span>
                  </div>
                )}

              </>)}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════ */}
        {/* STEP 2 — Streaming                    */}
        {/* ══════════════════════════════════════ */}
        {streamingServices.length > 0 && (
          <div ref={el => { sectionRefs.current[2] = el; }} className="scroll-mt-20">
            <div className="bg-white/[0.04] py-10 md:py-14 border-t border-white/10">
              <div className="container mx-auto px-4 max-w-[1100px]">
                <SimulatorSectionHeader step={2}
                  title={isFr ? "Ajoutez du Streaming" : "Add Streaming"}
                  subtitle={isFr ? "Optionnel — ajoutez vos plateformes préférées" : "Optional — add your favorite streaming platforms"}
                  optional
                />
                {videoStreaming.length > 0 && (
                  <div className="mb-8">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2 mb-4">
                      <MonitorPlay className="w-4 h-4" /> {isFr ? "Vidéo & Films" : "Video & Movies"}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {videoStreaming.map(svc => <StreamingTile key={svc.id} service={svc} selected={selectedStreamingIds.has(svc.id)} onToggle={() => toggleStreaming(svc.id)} isFr={isFr} />)}
                    </div>
                  </div>
                )}
                {musicStreaming.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2 mb-4">
                      <Music className="w-4 h-4" /> {isFr ? "Musique" : "Music"}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {musicStreaming.map(svc => <StreamingTile key={svc.id} service={svc} selected={selectedStreamingIds.has(svc.id)} onToggle={() => toggleStreaming(svc.id)} isFr={isFr} />)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════ */}
        {/* STEP 3 — Equipment                    */}
        {/* ══════════════════════════════════════ */}
        <div ref={el => { sectionRefs.current[3] = el; }} className="scroll-mt-20">
          <div className="py-10 md:py-14 border-t border-white/10" style={{ background: 'rgba(255,255,255,0.01)' }}>
            <div className="container mx-auto px-4 max-w-[1100px]">
              <SimulatorSectionHeader step={3}
                title={isFr ? "Votre équipement" : "Your equipment"}
                subtitle={isFr ? "Matériel requis — frais uniques payables avant installation" : "Required hardware — one-time fees payable before installation"}
              />
              <div className="grid md:grid-cols-2 gap-5">
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
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span className="text-2xl font-extrabold text-white">{terminalProduct.price.toFixed(0)}</span>
                          <span className="text-sm text-white/40 ml-0.5">$ / {isFr ? "unité" : "unit"}</span>
                        </div>
                      </div>
                      <Separator className="my-4 bg-white/10" />
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-white/65">{isFr ? "Quantité totale" : "Total quantity"}</span>
                        <div className="flex items-center gap-2.5">
                          <button onClick={() => setExtraTerminals(Math.max(0, extraTerminals - 1))} disabled={extraTerminals === 0}
                            className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/[0.06] disabled:opacity-20 transition-all text-white">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center font-bold text-white tabular-nums">{totalTerminals}</span>
                          <button onClick={() => setExtraTerminals(Math.min(3, extraTerminals + 1))}
                            className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/[0.06] transition-all text-white">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/40">{isFr ? "Sous-total" : "Subtotal"}</span>
                        <span className="text-sm font-bold text-white/80">{(terminalProduct.price * totalTerminals).toFixed(0)} $</span>
                      </div>
                      <p className="text-[10px] text-white/30 mt-2">{isFr ? "Minimum 1, maximum 4 terminaux par adresse" : "Min 1, max 4 terminals per address"}</p>
                    </div>
                  </div>
                )}
                {routerProduct && (
                  <div className="rounded-2xl border-2 border-[#7C3AED]/15 bg-white/[0.04] overflow-hidden">
                    <div className="bg-[#7C3AED]/5 px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-[#7C3AED]" />
                        <span className="text-xs font-bold text-[#7C3AED] uppercase tracking-wider">{isFr ? "Borne WiFi" : "WiFi Router"}</span>
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
                      <p className="text-[10px] text-white/40 mt-3">{isFr ? "1 borne par adresse — incluse automatiquement" : "1 per address — automatically included"}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════ */}
        {/* STEP 4 — Installation                 */}
        {/* ══════════════════════════════════════ */}
        <div ref={el => { sectionRefs.current[4] = el; }} className="scroll-mt-20">
          <div className="bg-white/[0.04] py-10 md:py-14 border-t border-white/10">
            <div className="container mx-auto px-4 max-w-[1100px]">
              <SimulatorSectionHeader step={4}
                title={isFr ? "Mode d'installation" : "Installation method"}
                subtitle={isFr ? "Comment souhaitez-vous activer vos services ?" : "How would you like to activate your services?"}
              />
              <div className="grid md:grid-cols-2 gap-5 max-w-[800px] mx-auto">
                <div onClick={() => setInstallMethod(installMethod === "technician" ? null : "technician")}
                  className={cn("rounded-2xl border-2 p-6 cursor-pointer transition-all text-center",
                    installMethod === "technician" ? "border-[#7C3AED] bg-[#7C3AED]/5 shadow-xl shadow-purple-900/20" : "border-white/10 bg-white/[0.04] hover:border-white/20"
                  )}>
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors",
                    installMethod === "technician" ? "bg-[#7C3AED] text-white" : "bg-white/[0.08] text-white/40")}>
                    <Wrench className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-white mb-2">{isFr ? "Technicien à domicile" : "Home technician"}</h4>
                  <p className="text-xl font-extrabold text-[#7C3AED] mb-3">{TECHNICIAN_INSTALL_FEE} $</p>
                  <ul className="text-left space-y-2 text-xs text-white/55">
                    <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{isFr ? "Installation complète sur place" : "Complete on-site installation"}</li>
                    <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{isFr ? "Vérification du câblage" : "Wiring verification"}</li>
                    <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />{isFr ? "Activation et test de services" : "Service activation & testing"}</li>
                  </ul>
                </div>
                <div onClick={() => setInstallMethod(installMethod === "self" ? null : "self")}
                  className={cn("rounded-2xl border-2 p-6 cursor-pointer transition-all text-center",
                    installMethod === "self" ? "border-[#7C3AED] bg-[#7C3AED]/5 shadow-xl shadow-purple-900/20" : "border-white/10 bg-white/[0.04] hover:border-white/20"
                  )}>
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors",
                    installMethod === "self" ? "bg-[#7C3AED] text-white" : "bg-white/[0.08] text-white/40")}>
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

      {/* ══ Bottom sticky bar ══ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 backdrop-blur-xl" style={{ background: 'rgba(2,2,9,0.92)' }}>
        <div className="container mx-auto px-4 max-w-[1100px]">
          <div className="flex items-center justify-between h-[72px] md:h-20 gap-4">
            <div className="flex-1 min-w-0 hidden sm:block">
              {selectedPlan ? (
                <div>
                  <p className="text-xs text-white/40 font-medium">{isFr ? "Forfait sélectionné" : "Selected plan"}</p>
                  <p className="text-sm font-bold text-white truncate">{selectedPlan.name}</p>
                </div>
              ) : (
                <p className="text-sm text-white/40">{isFr ? "Sélectionnez un forfait" : "Select a plan"}</p>
              )}
            </div>
            <div className="flex items-center gap-4 md:gap-6">
              <div className="text-right">
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{isFr ? "Mensuel" : "Monthly"}</p>
                <p className="text-lg md:text-xl font-extrabold text-[#A78BFA] tabular-nums">{pricing.recurringSubtotal.toFixed(2)} $</p>
              </div>
              {pricing.oneTimeSubtotal > 0 && (<>
                <div className="w-px h-8 bg-white/15" />
                <div className="text-right">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{isFr ? "Unique" : "One-time"}</p>
                  <p className="text-lg md:text-xl font-extrabold text-white/80 tabular-nums">{pricing.oneTimeSubtotal.toFixed(2)} $</p>
                </div>
              </>)}
              <div className="w-px h-8 bg-white/15 hidden md:block" />
              <div className="text-right hidden md:block">
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{isFr ? "Total est." : "Est. total"}</p>
                <p className="text-lg font-extrabold text-white tabular-nums">~{fmt(pricing.grandTotal)}</p>
              </div>
            </div>
            <Button onClick={handleContinue} disabled={!canProceed}
              className="h-11 md:h-12 px-6 md:px-8 text-sm md:text-base font-bold bg-[#7C3AED] hover:bg-[#6D28D9] rounded-xl shrink-0">
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

function SpeedCard({ speed, isSelected, isFr }: { speed: SpeedItem; isSelected: boolean; isFr: boolean }) {
  const isGiga = speed.key === 'GIGA';
  return (
    <div className="relative rounded-2xl overflow-hidden" style={{
      background: isSelected ? 'linear-gradient(160deg, rgba(124,58,237,0.2) 0%, rgba(10,10,15,1) 100%)' : 'rgba(255,255,255,0.05)',
      border: isSelected ? '2px solid rgba(124,58,237,0.6)' : '2px solid rgba(255,255,255,0.1)',
      boxShadow: isSelected ? '0 0 36px rgba(124,58,237,0.35)' : '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <div className="flex items-center justify-center gap-1.5 font-bold uppercase" style={{
        background: isSelected ? 'linear-gradient(90deg, #7C3AED, #6D28D9)' : 'rgba(124,58,237,0.4)',
        color: '#fff', padding: '8px 0', fontSize: 9, letterSpacing: 1.8,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
        {isFr ? 'PRIX À VIE GARANTI' : 'PRICE LOCKED FOR LIFE'}
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
      </div>
      <div style={{ padding: '18px 18px 20px' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: isSelected ? '#C4B5FD' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: "'JetBrains Mono', monospace", marginBottom: 10 }}>
          {isFr ? 'FORFAIT INTERNET' : 'INTERNET PLAN'}
        </p>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 14, letterSpacing: '-0.4px' }}>{speed.label}</h3>
        <div style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.22)', borderRadius: 12, padding: '13px 14px' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Wifi className="w-3 h-3" style={{ color: '#67E8F9' }} />
            <span style={{ color: '#67E8F9', fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>INTERNET</span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2.5">
            <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-2.5px', lineHeight: 1, color: '#fff' }}>{speed.speedNum}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Mbit/s</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              isFr ? `Jusqu'à ${speed.speedNum} Mbit/s` : `Up to ${speed.speedNum} Mbit/s`,
              isFr ? 'Données illimitées incluses' : 'Unlimited data included',
              ...(isGiga ? [isFr ? 'Ultra-faible latence · CGNAT-Free' : 'Ultra-low latency · CGNAT-Free'] : []),
            ].map((line, i) => (
              <div key={i} className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.65)' }}>
                {i === 2 ? <Zap className="w-3 h-3 shrink-0" style={{ color: '#F59E0B' }} /> : <Check className="w-3 h-3 shrink-0" strokeWidth={3} style={{ color: '#67E8F9' }} />}
                {line}
              </div>
            ))}
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

function SimulatorSectionHeader({ step, title, subtitle, optional }: { step: number; title: string; subtitle: string; optional?: boolean }) {
  return (
    <div className="text-center mb-8 md:mb-10">
      <div className="inline-flex items-center gap-2 bg-white/[0.08] rounded-full px-3 py-1 mb-3">
        <span className="w-5 h-5 rounded-full bg-[#7C3AED] text-white flex items-center justify-center text-[10px] font-bold">{step}</span>
        {optional && <Badge variant="outline" className="text-[10px] border-white/20 text-white/40">Optionnel</Badge>}
      </div>
      <h2 className="text-xl md:text-2xl font-extrabold text-white mb-1">{title}</h2>
      <p className="text-sm text-white/40 max-w-lg mx-auto">{subtitle}</p>
    </div>
  );
}

function StreamingTile({ service, selected, onToggle, isFr }: {
  service: { id: string; name: string; description: string | null; monthly_price: number };
  selected: boolean; onToggle: () => void; isFr: boolean;
}) {
  return (
    <div onClick={onToggle} className={cn("rounded-xl border-2 p-4 cursor-pointer transition-all text-center",
      selected ? "border-[#7C3AED] bg-[#7C3AED]/5 shadow-md" : "border-white/10 bg-white/[0.04] hover:border-white/20"
    )}>
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2.5 transition-colors",
        selected ? "bg-[#7C3AED] text-white" : "bg-white/[0.08] text-white/40")}>
        <MonitorPlay className="w-5 h-5" />
      </div>
      <p className="font-semibold text-sm text-white mb-0.5 truncate">{service.name}</p>
      <p className="text-xs text-white/40 font-medium">{service.monthly_price.toFixed(2)} $/{isFr ? "mois" : "mo"}</p>
      {selected && <Badge className="mt-2 bg-[#7C3AED]/10 text-[#7C3AED] border-0 text-[10px]"><Check className="w-3 h-3 mr-0.5" />{isFr ? "Ajouté" : "Added"}</Badge>}
    </div>
  );
}

export default TVConfigurator;
