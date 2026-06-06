import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { PhotoBg } from "@/components/PhotoBg";
import {
  Check, X, ArrowRight, Wifi, Tv, Smartphone, Filter,
  Zap, Shield, Info, Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOptionalAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import {
  useInternetPlans, useMobilePlans, useTVPlans, useEquipmentPrices,
} from "@/hooks/usePublicServices";

type CategoryFilter = "all" | "internet" | "tv" | "mobile";

interface ComparablePlan {
  id: string; name: string; category: "internet" | "tv" | "mobile";
  price: number; badge?: string; badgeColor?: string;
  speed?: string; channels?: number; channelType?: string;
  dataAutoTopUp?: string; dataNoAutoTopUp?: string;
  features: string[]; featured?: boolean;
}

const CAT_COLOR: Record<string, { accent: string; bg: string; border: string }> = {
  internet: { accent: "#06B6D4", bg: "rgba(6,182,212,0.1)",   border: "rgba(6,182,212,0.3)"   },
  tv:       { accent: "#A78BFA", bg: "rgba(124,58,237,0.1)",  border: "rgba(124,58,237,0.3)"  },
  mobile:   { accent: "#60A5FA", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.3)"  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.45, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] as const } }),
};

const ComparePlans = () => {
  const { language } = useLanguage();
  const { user } = useOptionalAuth();
  const navigate = useNavigate();
  const isFrench = language === "fr";

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);

  const { plans: internetPlans, isLoading: loadingInternet } = useInternetPlans(isFrench);
  const { plans: mobilePlans,   isLoading: loadingMobile   } = useMobilePlans(isFrench);
  const { standardPlans, gigaPlans, isLoading: loadingTV   } = useTVPlans(isFrench);
  const { routerPrice, simPrice, terminalPrice             } = useEquipmentPrices();

  const isLoading = loadingInternet || loadingMobile || loadingTV;

  const allPlans = useMemo<ComparablePlan[]>(() => {
    const plans: ComparablePlan[] = [];
    internetPlans.forEach((p) => plans.push({ id: p.id, name: p.name, category: "internet", price: p.price, badge: p.badge, badgeColor: p.badgeColor, speed: p.speed, features: p.features, featured: p.featured }));
    mobilePlans.forEach((p)   => plans.push({ id: p.id, name: p.name, category: "mobile",   price: p.price, badge: p.badge, badgeColor: p.badgeColor, dataAutoTopUp: p.dataAutoTopUp, dataNoAutoTopUp: p.dataNoAutoTopUp, features: p.features, featured: p.featured }));
    [...standardPlans, ...gigaPlans].forEach((p) => plans.push({ id: p.id, name: p.name, category: "tv", price: p.price, badge: p.badge, badgeColor: p.badgeColor, speed: p.internetSpeed, channels: p.channels, channelType: p.channelType, features: p.features, featured: p.featured }));
    return plans.sort((a, b) => a.price - b.price);
  }, [internetPlans, mobilePlans, standardPlans, gigaPlans]);

  const filteredPlans = useMemo(() =>
    categoryFilter === "all" ? allPlans : allPlans.filter((p) => p.category === categoryFilter),
    [allPlans, categoryFilter]
  );
  const comparisonPlans = useMemo(() => allPlans.filter((p) => selectedPlans.includes(p.id)), [allPlans, selectedPlans]);

  const togglePlan = (id: string) => setSelectedPlans((prev) => {
    if (prev.includes(id)) return prev.filter((x) => x !== id);
    if (prev.length >= 4) return prev;
    return [...prev, id];
  });

  const getCategoryIcon = (cat: string) => ({ internet: Wifi, tv: Tv, mobile: Smartphone })[cat] ?? Wifi;
  const getCategoryLabel = (cat: string) => ({ internet: isFrench ? "Internet" : "Internet", tv: isFrench ? "TV + Internet" : "TV + Internet", mobile: isFrench ? "Mobile" : "Mobile" })[cat] ?? cat;
  const getEquipmentFee = (cat: string) => ({
    internet: { label: isFrench ? "Routeur" : "Router", price: routerPrice },
    tv:       { label: isFrench ? "Terminal 4K" : "4K Terminal", price: terminalPrice },
    mobile:   { label: "SIM", price: simPrice },
  })[cat] ?? null;

  const CATS: { id: CategoryFilter; label: string; icon: React.ElementType }[] = [
    { id: "all",      label: isFrench ? "Tous" : "All",             icon: Filter     },
    { id: "internet", label: isFrench ? "Internet" : "Internet",    icon: Wifi       },
    { id: "tv",       label: isFrench ? "TV" : "TV",                icon: Tv         },
    { id: "mobile",   label: isFrench ? "Mobile" : "Mobile",        icon: Smartphone },
  ];

  const ROW_ODD  = { background: "rgba(255,255,255,0.02)" };
  const ROW_EVEN = { background: "rgba(255,255,255,0.045)" };

  return (
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden">
      <PhotoBg url="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80" opacity={0.08} filter="saturate(0.6) brightness(0.65)" />
      <div aria-hidden style={{ position: 'absolute', top: '-10%', right: '-8%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-10%', left: '-6%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.05) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <SEOHead
        title={isFrench ? "Comparer les forfaits | Nivra Telecom" : "Compare Plans | Nivra Telecom"}
        description={isFrench ? "Comparez nos forfaits Internet, TV et Mobile côte-à-côte." : "Compare our Internet, TV, and Mobile plans side-by-side."}
      />
      <Header />

      {/* ── Hero ── */}
      <section style={{ paddingTop: 110, paddingBottom: 60, position: "relative", overflow: "hidden" }}>
        {/* Earth from space — all our plans visible from above */}
        <PhotoBg url="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80" opacity={0.15} filter="saturate(0.6) brightness(0.65)" />
        <div aria-hidden style={{ position: "absolute", top: "-20%", right: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.25) 0%, transparent 65%)", animation: "n-aurora-1 14s ease-in-out infinite", pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", bottom: "-15%", left: "-8%", width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, transparent 65%)", animation: "n-aurora-2 18s ease-in-out infinite", pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.5), rgba(6,182,212,0.5), transparent)", animation: "n-scanline 10s linear infinite", pointerEvents: "none" }} />
        <div className="max-w-[1100px] mx-auto px-5 sm:px-10 text-center relative">
          <div className="n-animate-in inline-flex items-center gap-2.5 mb-8" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 999, padding: "7px 18px" }}>
            <Filter className="w-3.5 h-3.5" style={{ color: "#A78BFA" }} />
            <span style={{ color: "#A78BFA", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
              {isFrench ? "Comparateur de forfaits" : "Plan Comparator"}
            </span>
          </div>
          <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "clamp(36px, 5.5vw, 64px)", letterSpacing: "-2.5px", lineHeight: 1.0, marginBottom: 16, color: "#fff" }}>
            {isFrench ? <><span>Comparez </span><span className="n-shimmer-text">nos forfaits</span></> : <><span>Compare </span><span className="n-shimmer-text">Our Plans</span></>}
          </h1>
          <p className="n-animate-in-delay-2" style={{ color: "rgba(255,255,255,0.55)", fontSize: 18, lineHeight: 1.65, maxWidth: 560, margin: "0 auto" }}>
            {isFrench ? "Sélectionnez jusqu'à 4 forfaits pour les comparer côte-à-côte." : "Select up to 4 plans to compare side-by-side."}
          </p>
        </div>
      </section>

      <main style={{ paddingBottom: 80 }}>
        {isLoading && (
          <div className="flex justify-center items-center py-16 gap-3">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#7C3AED" }} />
            <span style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
              {isFrench ? "Chargement des forfaits..." : "Loading plans..."}
            </span>
          </div>
        )}

        {!isLoading && (
          <div className="max-w-[1200px] mx-auto px-5 sm:px-10">
            {/* ── Category Filter Chips ── */}
            <div className="flex flex-wrap gap-2 mb-8">
              {CATS.map(({ id, label, icon: Icon }) => {
                const active = categoryFilter === id;
                return (
                  <button key={id} onClick={() => setCategoryFilter(id)}
                    className="inline-flex items-center gap-2"
                    style={{ height: 38, padding: "0 16px", borderRadius: 10, background: active ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)", border: `1px solid ${active ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.1)"}`, color: active ? "#A78BFA" : "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, cursor: "pointer", transition: "all .15s" }}
                  >
                    <Icon style={{ width: 14, height: 14 }} />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* ── Selected counter bar ── */}
            {selectedPlans.length > 0 && (
              <div className="flex items-center justify-between mb-6 rounded-xl px-4 py-3"
                style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)" }}>
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>
                  {selectedPlans.length} {isFrench ? "forfait(s) sélectionné(s)" : "plan(s) selected"}
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginLeft: 6 }}>(max 4)</span>
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedPlans([])}
                    style={{ height: 34, padding: "0 14px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
                    {isFrench ? "Effacer" : "Clear"}
                  </button>
                  <button onClick={() => document.getElementById("comparison-section")?.scrollIntoView({ behavior: "smooth" })}
                    disabled={selectedPlans.length < 2}
                    className="inline-flex items-center gap-1.5"
                    style={{ height: 34, padding: "0 16px", borderRadius: 8, background: selectedPlans.length >= 2 ? "linear-gradient(135deg, #7C3AED, #6D28D9)" : "rgba(255,255,255,0.05)", color: selectedPlans.length >= 2 ? "#fff" : "rgba(255,255,255,0.3)", fontSize: 13, cursor: selectedPlans.length >= 2 ? "pointer" : "not-allowed", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, border: "none" }}>
                    {isFrench ? "Comparer" : "Compare"} <ArrowRight style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Plans Grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-16">
              {filteredPlans.map((plan, i) => {
                const Icon = getCategoryIcon(plan.category);
                const isSelected = selectedPlans.includes(plan.id);
                const equipment = getEquipmentFee(plan.category);
                const cat = CAT_COLOR[plan.category];
                return (
                  <motion.div key={plan.id} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                    <div onClick={() => togglePlan(plan.id)} className="relative rounded-2xl cursor-pointer h-full"
                      style={{ background: isSelected ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.03)", border: `1.5px solid ${isSelected ? "rgba(124,58,237,0.6)" : "rgba(255,255,255,0.08)"}`, padding: "20px 18px", transition: "border-color .18s, box-shadow .18s, transform .15s", boxShadow: isSelected ? "0 0 24px rgba(124,58,237,0.25)" : "none" }}
                      onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = "rgba(124,58,237,0.3)"; e.currentTarget.style.transform = "translateY(-2px)"; }}}
                      onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.transform = "none"; }}}
                    >
                      {/* Selection indicator */}
                      <div style={{ position: "absolute", top: 12, left: 12, width: 20, height: 20, borderRadius: 6, background: isSelected ? "#7C3AED" : "rgba(255,255,255,0.07)", border: `1.5px solid ${isSelected ? "#A78BFA" : "rgba(255,255,255,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}>
                        {isSelected && <Check style={{ width: 11, height: 11, color: "#fff" }} />}
                      </div>

                      {/* Badge */}
                      {plan.badge && (
                        <div style={{ position: "absolute", top: 10, right: 10 }}>
                          <span style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)", borderRadius: 999, padding: "3px 9px", color: "#fff", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{plan.badge}</span>
                        </div>
                      )}

                      <div style={{ paddingTop: 28 }}>
                        {/* Category */}
                        <div className="flex items-center gap-2 mb-3">
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: cat.bg, border: `1px solid ${cat.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon style={{ width: 14, height: 14, color: cat.accent }} />
                          </div>
                          <span style={{ borderRadius: 999, padding: "2px 10px", background: cat.bg, border: `1px solid ${cat.border}`, color: cat.accent, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                            {getCategoryLabel(plan.category)}
                          </span>
                        </div>

                        {/* Name */}
                        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 10, lineHeight: 1.35 }}>{plan.name}</h3>

                        {/* Key specs */}
                        <div className="space-y-1 mb-4">
                          {plan.speed && <div className="flex items-center gap-1.5"><Zap style={{ width: 12, height: 12, color: "#06B6D4" }} /><span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{plan.speed}</span></div>}
                          {plan.channels && <div className="flex items-center gap-1.5"><Tv style={{ width: 12, height: 12, color: "#A78BFA" }} /><span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{plan.channels} {plan.channelType}</span></div>}
                          {plan.dataAutoTopUp && <div className="flex items-center gap-1.5"><Smartphone style={{ width: 12, height: 12, color: "#60A5FA" }} /><span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{plan.dataAutoTopUp}</span></div>}
                        </div>

                        {/* Price */}
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 12 }}>
                          <div className="flex items-baseline gap-0.5">
                            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 24, color: "#fff" }}>${plan.price}</span>
                            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>/{isFrench ? "mois" : "mo"}</span>
                          </div>
                          {equipment && (
                            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>
                              + {equipment.label}: ${equipment.price} {isFrench ? "(unique)" : "(one-time)"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Need 1 more hint ── */}
            {selectedPlans.length === 1 && (
              <div className="max-w-md mx-auto text-center mb-16 rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Info className="mx-auto mb-3" style={{ width: 40, height: 40, color: "rgba(255,255,255,0.25)" }} />
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 8 }}>
                  {isFrench ? "Sélectionnez au moins 2 forfaits" : "Select at least 2 plans"}
                </h3>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                  {isFrench ? "Cliquez sur les forfaits ci-dessus pour les ajouter à la comparaison." : "Click on the plans above to add them to the comparison."}
                </p>
              </div>
            )}

            {/* ── Comparison Table ── */}
            {comparisonPlans.length >= 2 && (
              <section id="comparison-section" style={{ marginBottom: 64 }}>
                <div className="text-center mb-8">
                  <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "clamp(24px, 4vw, 36px)", letterSpacing: "-1px", color: "#fff", marginBottom: 8 }}>
                    {isFrench ? <><span>Comparaison </span><span className="n-shimmer-text">détaillée</span></> : <><span>Detailed </span><span className="n-shimmer-text">Comparison</span></>}
                  </h2>
                  <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15 }}>
                    {isFrench ? "Visualisez les différences entre vos forfaits sélectionnés" : "See the differences between your selected plans"}
                  </p>
                </div>

                <div style={{ borderRadius: 20, border: "1px solid rgba(124,58,237,0.25)", overflow: "hidden", background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ overflowX: "auto" }}>
                    <div style={{ minWidth: 640 }}>
                      {/* Header Row */}
                      <div style={{ display: "grid", gridTemplateColumns: `180px repeat(${comparisonPlans.length}, 1fr)`, gap: 16, padding: "18px 20px", background: "rgba(124,58,237,0.08)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", alignSelf: "center" }}>
                          {isFrench ? "Caractéristiques" : "Features"}
                        </span>
                        {comparisonPlans.map((plan) => {
                          const Icon = getCategoryIcon(plan.category);
                          const cat = CAT_COLOR[plan.category];
                          return (
                            <div key={plan.id} className="text-center">
                              <div style={{ width: 40, height: 40, borderRadius: 10, background: cat.bg, border: `1px solid ${cat.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
                                <Icon style={{ width: 18, height: 18, color: cat.accent }} />
                              </div>
                              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: "#fff", lineHeight: 1.3 }}>{plan.name}</p>
                              {plan.badge && <span style={{ display: "inline-block", marginTop: 4, borderRadius: 999, padding: "2px 8px", background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.4)", color: "#A78BFA", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{plan.badge}</span>}
                            </div>
                          );
                        })}
                      </div>

                      {[
                        { label: isFrench ? "Prix mensuel" : "Monthly Price",     rowStyle: ROW_ODD,
                          render: (p: ComparablePlan) => <><span style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:800, fontSize:22, color:"#A78BFA" }}>${p.price}</span><span style={{ color:"rgba(255,255,255,0.35)", fontSize:12 }}>/{isFrench ? "mois" : "mo"}</span></> },
                        { label: isFrench ? "Type" : "Type",                      rowStyle: ROW_EVEN,
                          render: (p: ComparablePlan) => { const cat = CAT_COLOR[p.category]; return <span style={{ borderRadius:999, padding:"3px 10px", background:cat.bg, border:`1px solid ${cat.border}`, color:cat.accent, fontSize:11, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{getCategoryLabel(p.category)}</span>; } },
                        { label: isFrench ? "Vitesse Internet" : "Internet Speed", rowStyle: ROW_ODD,
                          render: (p: ComparablePlan) => p.speed ? <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:14, color:"#06B6D4" }}>{p.speed}</span> : <X style={{ width:16, height:16, color:"rgba(255,255,255,0.2)", margin:"0 auto" }} /> },
                        { label: isFrench ? "Chaînes TV" : "TV Channels",         rowStyle: ROW_EVEN,
                          render: (p: ComparablePlan) => p.channels ? <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:14, color:"#A78BFA" }}>{p.channels} {p.channelType}</span> : <X style={{ width:16, height:16, color:"rgba(255,255,255,0.2)", margin:"0 auto" }} /> },
                        { label: isFrench ? "Données mobiles" : "Mobile Data",    rowStyle: ROW_ODD,
                          render: (p: ComparablePlan) => p.dataAutoTopUp ? <div><span style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:14, color:"#60A5FA" }}>{p.dataAutoTopUp}</span><p style={{ color:"rgba(255,255,255,0.3)", fontSize:11, marginTop:2 }}>(Auto Top-Up)</p></div> : <X style={{ width:16, height:16, color:"rgba(255,255,255,0.2)", margin:"0 auto" }} /> },
                        { label: isFrench ? "Frais équipement" : "Equipment Fee", rowStyle: ROW_EVEN,
                          render: (p: ComparablePlan) => { const eq = getEquipmentFee(p.category); return eq ? <span style={{ color:"#FBBF24", fontFamily:"'Space Grotesk',sans-serif", fontWeight:600, fontSize:14 }}>${eq.price} ({eq.label})</span> : <X style={{ width:16, height:16, color:"rgba(255,255,255,0.2)", margin:"0 auto" }} />; } },
                        { label: isFrench ? "Caractéristiques" : "Features",      rowStyle: ROW_ODD,
                          render: (p: ComparablePlan) => <div className="space-y-1.5">{p.features.slice(0,5).map((f, i) => <div key={i} className="flex items-start gap-1.5"><Check style={{ width:12, height:12, color:"#10B981", flexShrink:0, marginTop:2 }} /><span style={{ color:"rgba(255,255,255,0.5)", fontSize:12, lineHeight:1.5 }}>{f}</span></div>)}</div> },
                      ].map(({ label, rowStyle, render }) => (
                        <div key={label} style={{ display: "grid", gridTemplateColumns: `180px repeat(${comparisonPlans.length}, 1fr)`, gap: 16, padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", ...rowStyle }}>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, alignSelf: "center" }}>{label}</span>
                          {comparisonPlans.map((p) => <div key={p.id} className="text-center flex items-center justify-center">{render(p)}</div>)}
                        </div>
                      ))}

                      {/* CTA Row */}
                      <div style={{ display: "grid", gridTemplateColumns: `180px repeat(${comparisonPlans.length}, 1fr)`, gap: 16, padding: "16px 20px", background: "rgba(124,58,237,0.06)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                        <div />
                        {comparisonPlans.map((plan) => (
                          <div key={plan.id} className="flex justify-center">
                            <button onClick={() => {
                              let path = "/internet";
                              if (plan.category === "tv") path = "/tv";
                              if (plan.category === "mobile") path = "/mobile";
                              navigate(path);
                            }}
                              className="inline-flex items-center justify-center gap-1.5 w-full"
                              style={{ height: 40, borderRadius: 10, background: plan.featured ? "linear-gradient(135deg, #7C3AED, #6D28D9)" : "rgba(255,255,255,0.06)", border: plan.featured ? "none" : "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, cursor: "pointer", transition: "box-shadow .15s", boxShadow: plan.featured ? "0 4px 20px rgba(124,58,237,0.4)" : "none" }}
                              onMouseEnter={(e) => { if (plan.featured) e.currentTarget.style.boxShadow = "0 6px 28px rgba(124,58,237,0.6)"; }}
                              onMouseLeave={(e) => { if (plan.featured) e.currentTarget.style.boxShadow = "0 4px 20px rgba(124,58,237,0.4)"; }}
                            >
                              {isFrench ? "Choisir" : "Select"} <ArrowRight style={{ width: 13, height: 13 }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ── CTA ── */}
            <div className="max-w-[720px] mx-auto text-center" style={{ borderRadius: 24, background: "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(6,182,212,0.06) 100%)", border: "1px solid rgba(124,58,237,0.25)", padding: "52px 40px", position: "relative", overflow: "hidden" }}>
              <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.6), transparent)", pointerEvents: "none" }} />
              <Shield className="mx-auto mb-4" style={{ width: 44, height: 44, color: "#A78BFA" }} />
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "clamp(22px, 3.5vw, 34px)", letterSpacing: "-1px", color: "#fff", marginBottom: 12 }}>
                {isFrench ? <><span>Besoin d'aide </span><span className="n-shimmer-text">pour choisir?</span></> : <><span>Need Help </span><span className="n-shimmer-text">Choosing?</span></>}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, lineHeight: 1.7, maxWidth: 480, margin: "0 auto 32px" }}>
                {isFrench ? "Notre équipe est disponible pour vous guider vers le forfait idéal." : "Our team is available to guide you to the ideal plan for your needs."}
              </p>
              <button onClick={() => navigate("/contact")} className="inline-flex items-center gap-2"
                style={{ height: 52, padding: "0 36px", borderRadius: 12, background: "linear-gradient(135deg, #7C3AED, #6D28D9)", color: "#fff", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, cursor: "pointer", border: "none", boxShadow: "0 8px 32px rgba(124,58,237,0.4)", transition: "box-shadow .15s, transform .15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 12px 40px rgba(124,58,237,0.6)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(124,58,237,0.4)"; e.currentTarget.style.transform = "none"; }}
              >
                {isFrench ? "Contactez-nous" : "Contact Us"} <ArrowRight style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ComparePlans;
