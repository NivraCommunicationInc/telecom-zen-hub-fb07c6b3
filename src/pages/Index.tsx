import { motion, type Variants, useInView, useMotionValue, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { PhotoBg } from "@/components/PhotoBg";
import { Link } from "react-router-dom";
import {
  ArrowRight, Wifi, Zap, Shield, Headphones,
  Star, CheckCircle2, Tv, Smartphone, ChevronRight,
  Award, Clock, MapPin, Signal, Server, Globe,
  Activity, Cpu, Lock, CheckCheck,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";
import SchemaMarkup from "@/components/seo/SchemaMarkup";
import LocalBusinessSchema from "@/components/LocalBusinessSchema";
import HomeStatusBanner from "@/components/HomeStatusBanner";
import LaunchOfferPopup from "@/components/marketing/LaunchOfferPopup";
import { useLanguage } from "@/contexts/LanguageContext";
import { useInternetPlans } from "@/hooks/usePublicServices";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const WHY = [
  { icon: Zap,        title: "Activation 10 min",     desc: "Votre service actif en moins de 10 minutes. Sans technicien, sans attente.",        accent: "#A78BFA", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.35)", stat: "10 min" },
  { icon: Shield,     title: "Zéro contrat",           desc: "Résiliez ou changez à tout moment, sans frais cachés ni pénalité.",                 accent: "#06B6D4", bg: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.35)",   stat: "0$" },
  { icon: Wifi,       title: "Réseau 99,9% uptime",    desc: "Infrastructure haute disponibilité dédiée aux clients Nivra.",                      accent: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)",  stat: "99.9%" },
  { icon: Headphones, title: "Support québécois 24/7", desc: "Équipe locale disponible à toute heure par téléphone, chat et courriel.",           accent: "#FBBF24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.35)",  stat: "24/7" },
];

const TESTIMONIALS = [
  { name: "Marie-Claude B.", city: "Montréal",   rating: 5, quote: "Jamais aussi peu de problèmes avec Internet. Le service client est vraiment humain — ils répondent vraiment.", initials: "MB" },
  { name: "Jean-François L.", city: "Laval",     rating: 5, quote: "Activation en 8 minutes chrono. Le 500 Mbps tourne parfaitement pour 4 personnes en télétravail.",            initials: "JL" },
  { name: "Sophie T.",        city: "Longueuil", rating: 5, quote: "Prix honnêtes, pas de surprise à la facture, et ils répondent vraiment au téléphone. Rare de nos jours.",      initials: "ST" },
];

const SERVICES = [
  { icon: Wifi,       label: "Internet",   sub: "Jusqu'à 940 Mbps",  to: "/internet", accent: "#A78BFA", bg: "rgba(124,58,237,0.12)",  border: "rgba(124,58,237,0.35)" },
  { icon: Tv,         label: "Télévision", sub: "26+ chaînes HD",    to: "/tv",       accent: "#06B6D4", bg: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.35)"  },
  { icon: Smartphone, label: "Mobile",     sub: "Sans contrat",      to: "/mobile",   accent: "#10B981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.35)" },
];

const BADGE_COLORS: Record<string, string> = {
  "bg-purple-500":  "#8B5CF6",
  "bg-accent":      "#7C3AED",
  "bg-blue-500":    "#3B82F6",
  "bg-cyan-500":    "#06B6D4",
  "bg-gradient-to-r from-orange-500 to-red-500": "#F97316",
};

const COVERAGE_CITIES = [
  { name: "Montréal",         status: "full",    speed: "940" },
  { name: "Laval",            status: "full",    speed: "940" },
  { name: "Longueuil",        status: "full",    speed: "940" },
  { name: "Québec",           status: "full",    speed: "940" },
  { name: "Sherbrooke",       status: "full",    speed: "500" },
  { name: "Trois-Rivières",   status: "full",    speed: "500" },
  { name: "Gatineau",         status: "partial", speed: "300" },
  { name: "Saguenay",         status: "partial", speed: "300" },
  { name: "Lévis",            status: "partial", speed: "300" },
  { name: "Terrebonne",       status: "full",    speed: "500" },
  { name: "Saint-Jean",       status: "partial", speed: "150" },
  { name: "Repentigny",       status: "full",    speed: "500" },
];

const TECH_FEATURES = [
  { icon: Zap,    text: "XGS-PON — Fibre jusqu'à 10 Gbit/s symétrique",      accent: "#A78BFA" },
  { icon: Globe,  text: "IPv6 natif + dual-stack sans configuration",          accent: "#06B6D4" },
  { icon: Lock,   text: "Chiffrement WPA3 + TLS 1.3 sur tout le réseau",      accent: "#10B981" },
  { icon: Cpu,    text: "Nœuds redondants — zéro point de défaillance unique", accent: "#FBBF24" },
];

const TRUST_ITEMS = ["CRTC Réglementé", "IPv6 Ready", "XGS-PON Fibre", "5G LTE", "WPA3 Enterprise", "SSL/TLS 1.3", "ISO 27001", "PIPEDA Conforme"];

function AnimatedCounter({ target, suffix = "", duration = 1800 }: { target: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const val = useMotionValue(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(val, target, {
      duration: duration / 1000,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = Math.floor(v) + suffix;
      },
    });
    return controls.stop;
  }, [inView, target, suffix, duration, val]);

  return <span ref={ref}>0{suffix}</span>;
}

const Index = () => {
  const { language, t } = useLanguage();
  const isFr = language === "fr";
  const { plans } = useInternetPlans(isFr);
  const displayPlans = plans.slice(0, 3);

  return (
    <div className="min-h-screen" style={{ background: "#020209", position: "relative" }}>
      <style>{`
        @keyframes n-aurora-1 {
          0%,100% { transform: translate(0,0); } 50% { transform: translate(-60px,40px); }
        }
        @keyframes n-aurora-2 {
          0%,100% { transform: translate(0,0); } 50% { transform: translate(50px,-30px); }
        }
        @keyframes n-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fiber-pulse {
          0%   { stroke-dashoffset: 200; opacity:.9; }
          100% { stroke-dashoffset: 0;   opacity:.3; }
        }
        @keyframes shine-sweep {
          0%   { left: -100%; }
          100% { left: 200%; }
        }
        @keyframes trust-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes city-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
          50%      { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
        }
        @keyframes bar-fill {
          from { width: 0; }
          to   { width: var(--w); }
        }
        .n-shimmer-text {
          background: linear-gradient(90deg,#A78BFA 0%,#06B6D4 50%,#A78BFA 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: n-shimmer 3s linear infinite;
        }
        .plan-card-shine:hover::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0;
          width: 60%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
          animation: shine-sweep .7s ease-in-out forwards;
          pointer-events: none;
        }
      `}</style>

      {/* Global ambient */}
      <div aria-hidden style={{ position:"fixed", inset:0, backgroundImage:"linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)", backgroundSize:"80px 80px", pointerEvents:"none", zIndex:0 }} />
      <div aria-hidden style={{ position:"fixed", top:"30%", right:"-20%", width:800, height:800, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)", pointerEvents:"none", zIndex:0, animation:"n-aurora-1 20s ease-in-out infinite" }} />
      <div aria-hidden style={{ position:"fixed", bottom:"10%", left:"-15%", width:700, height:700, borderRadius:"50%", background:"radial-gradient(circle, rgba(6,182,212,0.04) 0%, transparent 70%)", pointerEvents:"none", zIndex:0, animation:"n-aurora-2 26s ease-in-out infinite" }} />

      <SEOHead {...SEO_DATA.home} />
      <LocalBusinessSchema />
      <SchemaMarkup includeBrand={false} includeHomeFaq includeProducts />
      <Header />
      <HomeStatusBanner />

      <main id="main-content" tabIndex={-1} style={{ position:"relative", zIndex:1 }}>

        {/* ══ HERO ══ */}
        <Hero />

        {/* ══ SERVICES NAV ══ */}
        <section style={{ background:"#06040F", paddingTop:32, paddingBottom:32, borderTop:"1px solid rgba(124,58,237,0.12)" }}>
          <div className="container mx-auto px-4 sm:px-10 max-w-[1200px]">
            <div className="grid grid-cols-3 gap-3">
              {SERVICES.map((s, i) => (
                <motion.div key={s.label} initial={{ opacity:0, y:16 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.4, delay:i*0.08 }}>
                  <Link
                    to={s.to}
                    className="flex items-center gap-3 sm:gap-5 rounded-xl sm:rounded-2xl p-3 sm:p-5"
                    style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", textDecoration:"none", transition:"all 0.22s", display:"flex" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor=s.border; e.currentTarget.style.boxShadow=`0 6px 24px ${s.bg}`; e.currentTarget.style.transform="translateY(-2px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor="rgba(255,255,255,0.07)"; e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="none"; }}
                  >
                    <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center" style={{ background:s.bg, border:`1px solid ${s.border}` }}>
                      <s.icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color:s.accent }} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-sm sm:text-base truncate" style={{ fontFamily:"'Space Grotesk', sans-serif" }}>{s.label}</div>
                      <div className="hidden sm:block" style={{ fontSize:11, color:"rgba(255,255,255,0.4)", fontFamily:"'JetBrains Mono', monospace" }}>{s.sub}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 ml-auto shrink-0" style={{ color:s.accent }} />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ STATS METRICS ══ */}
        <section style={{ background:"#020209", paddingTop:64, paddingBottom:64, borderTop:"1px solid rgba(124,58,237,0.08)", position:"relative", overflow:"hidden" }}>
          <PhotoBg url="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80" opacity={0.10} filter="saturate(0.5) brightness(0.7)" />
          <div className="container mx-auto px-4 sm:px-10 max-w-[1200px]" style={{ position:"relative", zIndex:1 }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { val:940,  suffix:"",     label:isFr?"Mbps max fibre":"Max fibre Mbps",   sub:isFr?"Vitesse symétrique":"Symmetrical speed",    accent:"#A78BFA", bg:"rgba(124,58,237,0.08)",  border:"rgba(124,58,237,0.2)"  },
                { val:99,   suffix:".9%",  label:isFr?"Disponibilité":"Network uptime",    sub:isFr?"Uptime annuel garanti":"Annual guaranteed",  accent:"#10B981", bg:"rgba(16,185,129,0.08)",  border:"rgba(16,185,129,0.2)"  },
                { val:4,    suffix:" ms",  label:isFr?"Latence moy.":"Avg latency",        sub:isFr?"Ping résidentiel":"Residential ping",        accent:"#06B6D4", bg:"rgba(6,182,212,0.08)",   border:"rgba(6,182,212,0.2)"   },
                { val:22,   suffix:"+",    label:isFr?"Villes couvertes":"Cities covered", sub:isFr?"Et en expansion":"And expanding",            accent:"#FBBF24", bg:"rgba(251,191,36,0.08)",  border:"rgba(251,191,36,0.2)"  },
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.5, delay:i*0.08 }}>
                  <div className="relative rounded-2xl overflow-hidden" style={{ background:stat.bg, border:`1px solid ${stat.border}`, padding:"28px 24px" }}>
                    <div aria-hidden style={{ position:"absolute", top:0, right:0, width:80, height:80, background:`radial-gradient(circle at 100% 0%, ${stat.accent}22 0%, transparent 60%)`, pointerEvents:"none" }} />
                    <div style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(36px, 5vw, 52px)", lineHeight:1, letterSpacing:"-2px", color:stat.accent, marginBottom:8 }}>
                      <AnimatedCounter target={stat.val} suffix={stat.suffix} />
                    </div>
                    <div style={{ color:"#FFFFFF", fontWeight:700, fontSize:14, fontFamily:"'Space Grotesk', sans-serif", marginBottom:3 }}>{stat.label}</div>
                    <div style={{ color:"rgba(255,255,255,0.35)", fontSize:12, fontFamily:"'JetBrains Mono', monospace" }}>{stat.sub}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ FORFAITS ══ */}
        <section style={{ background:"#06040F", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)" }}>
          <div className="container mx-auto px-4 sm:px-10 max-w-[1200px]">

            <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.55 }} className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background:"rgba(124,58,237,0.15)", border:"1px solid rgba(124,58,237,0.35)", borderRadius:100 }}>
                <Wifi className="w-3.5 h-3.5" style={{ color:"#A78BFA" }} />
                <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#A78BFA", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>
                  {isFr ? "Forfaits Internet" : "Internet Plans"}
                </span>
              </div>
              <h2 className="font-extrabold text-white" style={{ fontFamily:"'Space Grotesk', sans-serif", fontSize:"clamp(26px, 4vw, 48px)", letterSpacing:"-1.5px", lineHeight:1.08, marginTop:14 }}>
                {isFr ? <>Internet <span className="n-shimmer-text">sans compromis</span></> : <>Internet <span className="n-shimmer-text">without compromise</span></>}
              </h2>
              <p style={{ color:"rgba(255,255,255,0.45)", fontSize:16, marginTop:10 }}>
                {isFr ? "Sans contrat · Données illimitées · Activation immédiate" : "No contract · Unlimited data · Instant activation"}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-stretch">
              {displayPlans.map((plan, i) => {
                const badgeHex = BADGE_COLORS[plan.badgeColor || ""] || "#7C3AED";
                return (
                  <motion.div key={plan.id} custom={i} initial="hidden" whileInView="visible" viewport={{ once:true }} variants={fadeUp} className="flex">
                    <div
                      className="relative flex flex-col w-full rounded-2xl overflow-hidden plan-card-shine"
                      style={{
                        background: plan.featured
                          ? "linear-gradient(160deg, rgba(124,58,237,0.18) 0%, rgba(255,255,255,0.04) 60%)"
                          : "rgba(255,255,255,0.04)",
                        border: plan.featured ? "1.5px solid rgba(124,58,237,0.55)" : "1px solid rgba(255,255,255,0.09)",
                        boxShadow: plan.featured ? "0 0 60px rgba(124,58,237,0.2), 0 20px 50px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.4)",
                        transition: "box-shadow .25s, border-color .25s",
                      }}
                      onMouseEnter={(e) => {
                        if (!plan.featured) {
                          (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,0.35)";
                          (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(124,58,237,0.15)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!plan.featured) {
                          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)";
                          (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.4)";
                        }
                      }}
                    >
                      {plan.featured && (
                        <>
                          <div aria-hidden style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 80% 35% at 50% -5%, rgba(124,58,237,0.12) 0%, transparent 60%)", pointerEvents:"none" }} />
                          <div aria-hidden style={{ position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg, transparent, rgba(124,58,237,0.8), transparent)", pointerEvents:"none" }} />
                        </>
                      )}

                      {/* Badge */}
                      <div className="flex items-center justify-between px-5 pt-4 pb-0">
                        <span style={{ background:badgeHex, color:"#fff", fontSize:9, fontWeight:800, letterSpacing:"0.15em", textTransform:"uppercase", fontFamily:"'JetBrains Mono', monospace", padding:"4px 10px", borderRadius:6 }}>
                          {plan.badge}
                        </span>
                        {plan.featured && (
                          <span style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(124,58,237,0.2)", border:"1px solid rgba(124,58,237,0.4)", borderRadius:999, padding:"3px 10px", color:"#C4B5FD", fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'JetBrains Mono', monospace" }}>
                            <Star className="w-3 h-3 fill-current" />{isFr ? "POPULAIRE" : "POPULAR"}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col flex-1 px-5 pt-4 pb-5 relative">
                        <div className="font-bold text-white mb-1" style={{ fontSize:18, fontFamily:"'Space Grotesk', sans-serif" }}>{plan.name}</div>

                        <div className="flex items-baseline gap-1 mb-1">
                          <span style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(32px, 5vw, 44px)", letterSpacing:"-2px", lineHeight:1, color:plan.featured ? "#A78BFA" : "#fff" }}>
                            {plan.speed.replace(" Mbps","").replace(" Gbps","")}
                          </span>
                          <span style={{ color:plan.featured ? "#C4B5FD" : "rgba(255,255,255,0.5)", fontSize:14, fontWeight:700, fontFamily:"'JetBrains Mono', monospace", marginBottom:2 }}>
                            {plan.speed.includes("Gbps") ? "Gbps" : "Mbps"}
                          </span>
                        </div>

                        {plan.description && (
                          <p style={{ color:"rgba(255,255,255,0.45)", fontSize:13, lineHeight:1.5, marginBottom:16 }}>{plan.description}</p>
                        )}

                        {/* Speed comparison bar */}
                        <div style={{ marginBottom:16 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                            <span style={{ color:"rgba(255,255,255,0.35)", fontSize:10, fontFamily:"'JetBrains Mono', monospace" }}>Débit descendant</span>
                            <span style={{ color:plan.featured ? "#A78BFA" : "rgba(255,255,255,0.5)", fontSize:10, fontWeight:700, fontFamily:"'JetBrains Mono', monospace" }}>{plan.speed}</span>
                          </div>
                          <div style={{ height:3, background:"rgba(255,255,255,0.08)", borderRadius:999, overflow:"hidden" }}>
                            <motion.div
                              initial={{ width:0 }}
                              whileInView={{ width: plan.speed.includes("940") ? "100%" : plan.speed.includes("500") || plan.speed.includes("600") ? "63%" : "40%" }}
                              viewport={{ once:true }}
                              transition={{ duration:1, delay:0.3+i*0.1, ease:[0.22,1,0.36,1] }}
                              style={{ height:"100%", background:plan.featured ? "linear-gradient(90deg,#7C3AED,#A78BFA)" : "rgba(124,58,237,0.5)", borderRadius:999 }}
                            />
                          </div>
                        </div>

                        <div className="flex items-baseline gap-0.5 mb-4">
                          <span style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:46, letterSpacing:"-2px", lineHeight:1, color:"#fff" }}>{plan.price.toFixed(0)}</span>
                          <span style={{ color:"#fff", fontSize:20, fontWeight:700 }}>$</span>
                          <span style={{ color:"rgba(255,255,255,0.35)", fontSize:13, marginLeft:2 }}>/mois</span>
                        </div>

                        <div className="h-px mb-4" style={{ background:"linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)" }} />

                        <ul className="space-y-2 mb-5 flex-1">
                          {plan.features.slice(0, 5).map((f) => (
                            <li key={f} className="flex items-start gap-2.5" style={{ fontSize:13.5, color:"rgba(255,255,255,0.72)" }}>
                              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color:plan.featured ? "#A78BFA" : "#6D28D9" }} />
                              {f}
                            </li>
                          ))}
                        </ul>

                        <Link
                          to={`/commander?plan=${plan.id}`}
                          className="flex items-center justify-center gap-2 font-bold text-white"
                          style={{
                            height:48, borderRadius:10, fontSize:14, textDecoration:"none",
                            fontFamily:"'Space Grotesk', sans-serif",
                            background: plan.featured ? "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)" : "rgba(124,58,237,0.14)",
                            border: plan.featured ? "none" : "1px solid rgba(124,58,237,0.4)",
                            boxShadow: plan.featured ? "0 0 0 1px rgba(124,58,237,0.5), 0 6px 20px rgba(124,58,237,0.35)" : "none",
                            transition:"box-shadow .18s, transform .15s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform="translateY(-1px)";
                            if (plan.featured) e.currentTarget.style.boxShadow="0 0 0 1px rgba(124,58,237,0.7), 0 10px 28px rgba(124,58,237,0.5)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform="none";
                            if (plan.featured) e.currentTarget.style.boxShadow="0 0 0 1px rgba(124,58,237,0.5), 0 6px 20px rgba(124,58,237,0.35)";
                          }}
                        >
                          {isFr ? "Commander" : "Order now"} <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <motion.div initial={{ opacity:0 }} whileInView={{ opacity:1 }} viewport={{ once:true }} transition={{ duration:0.5, delay:0.35 }} className="text-center mt-7">
              <Link to="/internet" style={{ color:"#A78BFA", fontSize:14, fontWeight:600, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:5, fontFamily:"'Space Grotesk', sans-serif", transition:"color .18s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color="#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color="#A78BFA")}
              >
                {isFr ? "Voir tous les forfaits" : "View all plans"} <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ══ TECHNOLOGIE ══ */}
        <section style={{ background:"#020209", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(6,182,212,0.1)", position:"relative", overflow:"hidden" }}>
          <PhotoBg url="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1600&q=80" opacity={0.09} filter="saturate(0.4) brightness(0.6) hue-rotate(200deg)" />
          <div className="container mx-auto px-4 sm:px-10 max-w-[1200px]" style={{ position:"relative", zIndex:1 }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

              {/* Left: text */}
              <motion.div initial={{ opacity:0, x:-30 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ duration:0.65, ease:[0.22,1,0.36,1] }}>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6" style={{ background:"rgba(6,182,212,0.1)", border:"1px solid rgba(6,182,212,0.3)", borderRadius:100 }}>
                  <Server className="w-3.5 h-3.5" style={{ color:"#67E8F9" }} />
                  <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#67E8F9", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>
                    {isFr ? "Infrastructure" : "Technology"}
                  </span>
                </div>
                <h2 className="font-extrabold text-white mb-4" style={{ fontFamily:"'Space Grotesk', sans-serif", fontSize:"clamp(26px, 4vw, 44px)", letterSpacing:"-1.5px", lineHeight:1.1 }}>
                  {isFr
                    ? <><span className="n-shimmer-text">Fibre XGS-PON</span><br />de 4e génération</>
                    : <><span className="n-shimmer-text">XGS-PON Fibre</span><br />4th generation</>
                  }
                </h2>
                <p style={{ color:"rgba(255,255,255,0.5)", fontSize:16, lineHeight:1.75, marginBottom:28, maxWidth:460 }}>
                  {isFr
                    ? "Le réseau Nivra repose sur une infrastructure fibre optique XGS-PON entièrement redondante, conçue pour offrir des vitesses symétriques et une latence ultra-faible sur l'ensemble du territoire québécois."
                    : "The Nivra network is built on a fully redundant XGS-PON fiber optic infrastructure, engineered to deliver symmetrical speeds and ultra-low latency across Quebec."
                  }
                </p>

                <div className="space-y-3 mb-8">
                  {TECH_FEATURES.map((f, i) => (
                    <motion.div key={i} initial={{ opacity:0, x:-16 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ duration:0.4, delay:i*0.07 }}
                      className="flex items-center gap-3 rounded-xl p-3.5"
                      style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}
                    >
                      <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:`${f.accent}18`, border:`1px solid ${f.accent}40` }}>
                        <f.icon className="w-4 h-4" style={{ color:f.accent }} />
                      </div>
                      <span style={{ color:"rgba(255,255,255,0.75)", fontSize:13.5 }}>{f.text}</span>
                    </motion.div>
                  ))}
                </div>

                <Link to="/internet" className="inline-flex items-center gap-2 font-semibold" style={{ color:"#67E8F9", fontSize:14, textDecoration:"none", transition:"gap .18s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.gap="10px"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.gap="8px"; }}
                >
                  {isFr ? "En savoir plus" : "Learn more"} <ArrowRight className="w-4 h-4" />
                </Link>
              </motion.div>

              {/* Right: fiber SVG visualization */}
              <motion.div initial={{ opacity:0, x:30 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ duration:0.65, ease:[0.22,1,0.36,1] }}
                className="flex items-center justify-center"
              >
                <div className="relative" style={{ width:380, height:300 }}>
                  {/* Glow */}
                  <div aria-hidden style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 70% 60% at 50% 50%, rgba(6,182,212,0.12) 0%, transparent 70%)", pointerEvents:"none" }} />

                  <svg viewBox="0 0 380 300" width="380" height="300" style={{ overflow:"visible" }}>
                    <defs>
                      <linearGradient id="fiberGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#7C3AED" />
                        <stop offset="50%" stopColor="#06B6D4" />
                        <stop offset="100%" stopColor="#10B981" />
                      </linearGradient>
                      <filter id="fiberGlow">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>

                    {/* Main horizontal fiber cable */}
                    <line x1="20" y1="150" x2="360" y2="150" stroke="rgba(255,255,255,0.1)" strokeWidth="6" strokeLinecap="round" />
                    <line x1="20" y1="150" x2="360" y2="150" stroke="url(#fiberGrad)" strokeWidth="3" strokeLinecap="round" />
                    {/* Animated light pulse */}
                    {[0, 0.5, 1].map((d, i) => (
                      <line key={i} x1="20" y1="150" x2="360" y2="150"
                        stroke="white" strokeWidth="1.5" strokeLinecap="round"
                        strokeDasharray="40 300"
                        strokeOpacity="0.8"
                        style={{ animation:`fiber-pulse 2.5s ${d}s linear infinite` }}
                      />
                    ))}

                    {/* Branch lines */}
                    {[
                      { x:80,  y1:150, y2:60,  label:"Internet", speed:"940 Mbps", color:"#A78BFA", icon:"↑" },
                      { x:190, y1:150, y2:60,  label:"TV",       speed:"4K HDR",   color:"#06B6D4", icon:"↑" },
                      { x:300, y1:150, y2:60,  label:"Mobile",   speed:"5G LTE",   color:"#10B981", icon:"↑" },
                      { x:80,  y1:150, y2:240, label:"IPv6",     speed:"Natif",    color:"#FBBF24", icon:"↓" },
                      { x:190, y1:150, y2:240, label:"VoIP",     speed:"HD",       color:"#F472B6", icon:"↓" },
                      { x:300, y1:150, y2:240, label:"IoT",      speed:"Bas DL",   color:"#34D399", icon:"↓" },
                    ].map((b) => (
                      <g key={b.label}>
                        <line x1={b.x} y1={b.y1} x2={b.x} y2={b.y2}
                          stroke={b.color} strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="4 3" />
                        {/* Node at branch end */}
                        <circle cx={b.x} cy={b.y2 < 150 ? b.y2+8 : b.y2-8} r="6"
                          fill={b.color} fillOpacity="0.15" stroke={b.color} strokeWidth="1.5" strokeOpacity="0.7" />
                        <circle cx={b.x} cy={b.y2 < 150 ? b.y2+8 : b.y2-8} r="3"
                          fill={b.color} fillOpacity="0.9" />
                        {/* Label */}
                        <text x={b.x} y={b.y2 < 150 ? b.y2-8 : b.y2+22}
                          textAnchor="middle" fill={b.color} fontSize="9" fontWeight="700" fontFamily="'JetBrains Mono', monospace"
                          fillOpacity="0.9"
                        >
                          {b.label}
                        </text>
                        <text x={b.x} y={b.y2 < 150 ? b.y2-20 : b.y2+33}
                          textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="'JetBrains Mono', monospace"
                        >
                          {b.speed}
                        </text>
                      </g>
                    ))}

                    {/* Main nodes on cable */}
                    {[80, 190, 300].map((x) => (
                      <g key={x}>
                        <circle cx={x} cy={150} r="10" fill="rgba(0,0,5,0.8)" stroke="rgba(124,58,237,0.6)" strokeWidth="1.5" />
                        <circle cx={x} cy={150} r="5" fill="rgba(124,58,237,0.8)" />
                      </g>
                    ))}

                    {/* Left endpoint */}
                    <rect x="5" y="136" width="28" height="28" rx="6" fill="rgba(124,58,237,0.2)" stroke="rgba(124,58,237,0.5)" strokeWidth="1.5" />
                    <text x="19" y="155" textAnchor="middle" fill="#A78BFA" fontSize="9" fontWeight="800" fontFamily="'JetBrains Mono', monospace">CO</text>
                    {/* Right endpoint */}
                    <rect x="347" y="136" width="28" height="28" rx="6" fill="rgba(16,185,129,0.2)" stroke="rgba(16,185,129,0.5)" strokeWidth="1.5" />
                    <text x="361" y="155" textAnchor="middle" fill="#34D399" fontSize="9" fontWeight="800" fontFamily="'JetBrains Mono', monospace">ONT</text>
                  </svg>

                  {/* Metric badges */}
                  <div style={{ position:"absolute", top:0, right:0, background:"rgba(6,6,20,0.9)", border:"1px solid rgba(124,58,237,0.4)", borderRadius:10, padding:"10px 14px", backdropFilter:"blur(16px)" }}>
                    <p style={{ color:"rgba(255,255,255,0.4)", fontSize:9, fontFamily:"'JetBrains Mono', monospace", letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>LATENCE</p>
                    <span style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:22, color:"#10B981", letterSpacing:"-1px" }}>4 ms</span>
                  </div>
                  <div style={{ position:"absolute", bottom:0, left:0, background:"rgba(6,6,20,0.9)", border:"1px solid rgba(6,182,212,0.4)", borderRadius:10, padding:"10px 14px", backdropFilter:"blur(16px)" }}>
                    <p style={{ color:"rgba(255,255,255,0.4)", fontSize:9, fontFamily:"'JetBrains Mono', monospace", letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>SYMÉTRIQUE</p>
                    <span style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:22, color:"#67E8F9", letterSpacing:"-1px" }}>↑↓ 940</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ══ POURQUOI NIVRA ══ */}
        <section style={{ background:"#06040F", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)", position:"relative", overflow:"hidden" }}>
          <PhotoBg url="https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1600&q=80" opacity={0.08} filter="saturate(0.3) brightness(0.5)" />
          <div className="container mx-auto px-4 sm:px-10 max-w-[1200px]" style={{ position:"relative", zIndex:1 }}>
            <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.55 }} className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background:"rgba(6,182,212,0.1)", border:"1px solid rgba(6,182,212,0.3)", borderRadius:100 }}>
                <Award className="w-3.5 h-3.5" style={{ color:"#67E8F9" }} />
                <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#67E8F9", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>
                  {isFr ? "Pourquoi Nivra" : "Why Nivra"}
                </span>
              </div>
              <h2 className="font-extrabold text-white" style={{ fontFamily:"'Space Grotesk', sans-serif", fontSize:"clamp(26px, 4vw, 48px)", letterSpacing:"-1.5px", lineHeight:1.08, marginTop:14 }}>
                {isFr ? <>Un ISP qui <span className="n-shimmer-text">vous respecte</span></> : <>An ISP that <span className="n-shimmer-text">respects you</span></>}
              </h2>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {WHY.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity:0, y:20 }}
                  whileInView={{ opacity:1, y:0 }}
                  viewport={{ once:true }}
                  transition={{ duration:0.45, delay:i*0.08 }}
                  className="relative flex gap-4 rounded-2xl p-6 overflow-hidden"
                  style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", cursor:"default", transition:"border-color .22s, box-shadow .22s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor=item.border; (e.currentTarget as HTMLElement).style.boxShadow=`0 6px 28px ${item.bg}`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.boxShadow="none"; }}
                >
                  <div aria-hidden style={{ position:"absolute", top:-20, right:-20, width:100, height:100, borderRadius:"50%", background:`radial-gradient(circle, ${item.bg} 0%, transparent 70%)`, pointerEvents:"none" }} />
                  <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background:item.bg, border:`1px solid ${item.border}` }}>
                    <item.icon className="w-5 h-5" style={{ color:item.accent }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="font-bold text-white" style={{ fontSize:16, fontFamily:"'Space Grotesk', sans-serif" }}>{item.title}</h3>
                      <span style={{ fontFamily:"'JetBrains Mono', monospace", fontWeight:800, fontSize:18, color:item.accent, letterSpacing:"-0.5px" }}>{item.stat}</span>
                    </div>
                    <p style={{ color:"rgba(255,255,255,0.5)", fontSize:14, lineHeight:1.6 }}>{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ COUVERTURE ══ */}
        <section style={{ background:"#020209", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)", position:"relative", overflow:"hidden" }}>
          <PhotoBg url="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&q=80" opacity={0.13} filter="saturate(0.5) brightness(0.6)" />
          <div className="container mx-auto px-4 sm:px-10 max-w-[1200px]" style={{ position:"relative", zIndex:1 }}>
            <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.55 }} className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.3)", borderRadius:100 }}>
                <Signal className="w-3.5 h-3.5" style={{ color:"#34D399" }} />
                <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#34D399", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>
                  {isFr ? "Couverture réseau" : "Network coverage"}
                </span>
              </div>
              <h2 className="font-extrabold text-white" style={{ fontFamily:"'Space Grotesk', sans-serif", fontSize:"clamp(26px, 4vw, 48px)", letterSpacing:"-1.5px", lineHeight:1.08, marginTop:14 }}>
                {isFr ? <>Disponible dans <span className="n-shimmer-text">tout le Québec</span></> : <>Available across <span className="n-shimmer-text">Quebec</span></>}
              </h2>
              <p style={{ color:"rgba(255,255,255,0.45)", fontSize:16, marginTop:10 }}>
                {isFr ? "Couverture en expansion · Nouveaux marchés chaque trimestre" : "Expanding coverage · New markets every quarter"}
              </p>
            </motion.div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
              {COVERAGE_CITIES.map((city, i) => (
                <motion.div key={city.name} initial={{ opacity:0, scale:0.92 }} whileInView={{ opacity:1, scale:1 }} viewport={{ once:true }} transition={{ duration:0.35, delay:i*0.04 }}>
                  <div className="rounded-xl p-4" style={{ background:"rgba(255,255,255,0.03)", border:`1px solid ${city.status==="full" ? "rgba(16,185,129,0.25)" : "rgba(251,191,36,0.2)"}`, transition:"border-color .22s, box-shadow .22s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow=`0 4px 20px ${city.status==="full" ? "rgba(16,185,129,0.1)" : "rgba(251,191,36,0.08)"}`; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow="none"; }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span style={{
                          width:7, height:7, borderRadius:"50%",
                          background: city.status==="full" ? "#10B981" : "#FBBF24",
                          display:"block",
                          boxShadow: `0 0 0 2px ${city.status==="full" ? "rgba(16,185,129,0.25)" : "rgba(251,191,36,0.25)"}`,
                          animation: city.status==="full" ? "city-pulse 2s ease-in-out infinite" : "none",
                        }} />
                        <span style={{ color:"rgba(255,255,255,0.35)", fontSize:9, fontFamily:"'JetBrains Mono', monospace", textTransform:"uppercase", letterSpacing:1 }}>
                          {city.status === "full" ? "ACTIF" : "PARTIEL"}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:700, fontSize:14, color:"#FFFFFF", marginBottom:3 }}>{city.name}</div>
                    <div style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:11, color:city.status==="full" ? "#34D399" : "#FCD34D", fontWeight:700 }}>
                      {city.speed} Mbps
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity:0 }} whileInView={{ opacity:1 }} viewport={{ once:true }} transition={{ duration:0.5 }} className="text-center">
              <Link to="/couverture" style={{ color:"#34D399", fontSize:14, fontWeight:600, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:5, fontFamily:"'Space Grotesk', sans-serif", transition:"color .18s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color="#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color="#34D399")}
              >
                {isFr ? "Vérifier ma disponibilité" : "Check my availability"} <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ══ TÉMOIGNAGES ══ */}
        <section style={{ background:"#06040F", paddingTop:80, paddingBottom:80, borderTop:"1px solid rgba(124,58,237,0.08)" }}>
          <div className="container mx-auto px-4 sm:px-10 max-w-[1200px]">
            <motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.55 }} className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.3)", borderRadius:100 }}>
                <Star className="w-3.5 h-3.5" style={{ color:"#FCD34D" }} />
                <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#FCD34D", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>
                  {isFr ? "Avis clients" : "Customer reviews"}
                </span>
              </div>
              <h2 className="font-extrabold text-white" style={{ fontFamily:"'Space Grotesk', sans-serif", fontSize:"clamp(26px, 4vw, 48px)", letterSpacing:"-1.5px", lineHeight:1.08, marginTop:14 }}>
                {isFr ? <>Ils ont <span className="n-shimmer-text">choisi Nivra</span></> : <>They <span className="n-shimmer-text">chose Nivra</span></>}
              </h2>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {TESTIMONIALS.map((item, i) => (
                <motion.div key={item.name} initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.45, delay:i*0.1 }}
                  className="flex flex-col gap-4 rounded-2xl p-6"
                  style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", transition:"border-color .22s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor="rgba(251,191,36,0.2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,0.07)"; }}
                >
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: item.rating }).map((_, s) => <Star key={s} className="w-3.5 h-3.5 fill-current" style={{ color:"#F59E0B" }} />)}
                    <span style={{ marginLeft:"auto", background:"rgba(16,185,129,0.15)", border:"1px solid rgba(16,185,129,0.3)", borderRadius:999, padding:"2px 8px", fontSize:9, fontWeight:700, color:"#34D399", fontFamily:"'JetBrains Mono', monospace", letterSpacing:1 }}>
                      VÉRIFIÉ
                    </span>
                  </div>
                  <p style={{ color:"rgba(255,255,255,0.7)", fontSize:14.5, lineHeight:1.65, flex:1 }}>"{item.quote}"</p>
                  <div className="flex items-center gap-3 pt-2" style={{ borderTop:"1px solid rgba(255,255,255,0.07)" }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold" style={{ background:"linear-gradient(135deg, rgba(124,58,237,0.4), rgba(6,182,212,0.3))", border:"1px solid rgba(124,58,237,0.4)", color:"#C4B5FD", fontSize:13, fontFamily:"'Space Grotesk', sans-serif" }}>
                      {item.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-white" style={{ fontSize:13.5, fontFamily:"'Space Grotesk', sans-serif" }}>{item.name}</div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", display:"flex", alignItems:"center", gap:3, marginTop:2, fontFamily:"'JetBrains Mono', monospace" }}>
                        <MapPin className="w-3 h-3" />{item.city}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ TRUST BAR ══ */}
        <section style={{ background:"#020209", borderTop:"1px solid rgba(124,58,237,0.08)", borderBottom:"1px solid rgba(124,58,237,0.08)", overflow:"hidden", position:"relative" }}>
          <div aria-hidden style={{ position:"absolute", left:0, top:0, bottom:0, width:80, zIndex:2, background:"linear-gradient(90deg, rgba(2,2,9,1) 0%, transparent 100%)", pointerEvents:"none" }} />
          <div aria-hidden style={{ position:"absolute", right:0, top:0, bottom:0, width:80, zIndex:2, background:"linear-gradient(90deg, transparent 0%, rgba(2,2,9,1) 100%)", pointerEvents:"none" }} />
          <div style={{ display:"flex", animation:"trust-scroll 20s linear infinite", width:"max-content" }}>
            {[...Array(3)].map((_, rep) => (
              <div key={rep} className="flex items-center" style={{ padding:"20px 0" }}>
                {TRUST_ITEMS.map((label, i) => (
                  <div key={i} className="flex items-center gap-2" style={{ padding:"0 28px" }}>
                    <CheckCheck className="w-3.5 h-3.5 shrink-0" style={{ color:"#7C3AED" }} />
                    <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.45)", letterSpacing:"0.1em", textTransform:"uppercase", whiteSpace:"nowrap" }}>
                      {label}
                    </span>
                    {i < TRUST_ITEMS.length - 1 && <span style={{ marginLeft:28, color:"rgba(124,58,237,0.3)", fontSize:16 }}>·</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ══ CTA FINAL ══ */}
        <section style={{ background:"#06040F", paddingTop:64, paddingBottom:64 }}>
          <motion.div initial={{ opacity:0, y:24 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ duration:0.55 }}
            className="container mx-auto px-4 sm:px-10 max-w-[860px]"
          >
            <div className="rounded-2xl relative overflow-hidden text-center"
              style={{ background:"linear-gradient(135deg, rgba(124,58,237,0.16) 0%, rgba(255,255,255,0.03) 50%, rgba(6,182,212,0.08) 100%)", border:"1px solid rgba(124,58,237,0.3)", boxShadow:"0 0 80px rgba(124,58,237,0.14), 0 24px 60px rgba(0,0,0,0.5)", padding:"clamp(36px, 5vw, 64px) clamp(20px, 4vw, 64px)" }}
            >
              <div aria-hidden style={{ position:"absolute", top:"-40%", left:"50%", transform:"translateX(-50%)", width:500, height:250, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(124,58,237,0.2), transparent 70%)", pointerEvents:"none", filter:"blur(20px)" }} />
              <div aria-hidden style={{ position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg, transparent, rgba(124,58,237,0.7), rgba(6,182,212,0.5), transparent)", pointerEvents:"none" }} />
              <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage:"linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)", backgroundSize:"48px 48px" }} />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background:"rgba(6,182,212,0.1)", border:"1px solid rgba(6,182,212,0.3)", borderRadius:100 }}>
                  <Clock className="w-3.5 h-3.5" style={{ color:"#67E8F9" }} />
                  <span style={{ fontFamily:"'JetBrains Mono', monospace", color:"#67E8F9", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>
                    {isFr ? "Activation en 10 minutes" : "10-minute activation"}
                  </span>
                </div>
                <h2 className="font-extrabold text-white mt-2 mb-3" style={{ fontFamily:"'Space Grotesk', sans-serif", fontSize:"clamp(24px, 4.5vw, 48px)", letterSpacing:"-1.5px", lineHeight:1.1 }}>
                  {isFr ? <>Prêt à <span className="n-shimmer-text">passer à Nivra</span> ?</> : <>Ready to <span className="n-shimmer-text">switch to Nivra</span>?</>}
                </h2>
                <p style={{ color:"rgba(255,255,255,0.5)", fontSize:16, lineHeight:1.6, maxWidth:440, margin:"0 auto 32px" }}>
                  {isFr ? "Sans contrat, sans technicien, sans surprise. Commandez aujourd'hui." : "No contract, no technician, no surprise. Order today."}
                </p>

                {/* Mini trust row */}
                <div className="flex flex-wrap justify-center gap-4 mb-8">
                  {[
                    { icon:Shield, text:isFr?"Remboursé 30j":"30-day refund",    color:"#A78BFA" },
                    { icon:Activity, text:isFr?"99.9% uptime":"99.9% uptime",   color:"#10B981" },
                    { icon:Zap, text:isFr?"1er mois gratuit":"1st month free",  color:"#FBBF24" },
                  ].map(({ icon: Icon, text, color }) => (
                    <div key={text} className="flex items-center gap-1.5" style={{ color:"rgba(255,255,255,0.6)", fontSize:13 }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />{text}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link to="/commander"
                    className="flex items-center gap-2 font-bold text-white w-full sm:w-auto justify-center"
                    style={{ height:52, paddingLeft:32, paddingRight:32, borderRadius:10, fontSize:15, textDecoration:"none", fontFamily:"'Space Grotesk', sans-serif", background:"linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)", boxShadow:"0 0 0 1px rgba(124,58,237,0.5), 0 8px 28px rgba(124,58,237,0.45)", transition:"box-shadow .18s, transform .15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow="0 0 0 1px rgba(124,58,237,0.7), 0 10px 36px rgba(124,58,237,0.6)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow="0 0 0 1px rgba(124,58,237,0.5), 0 8px 28px rgba(124,58,237,0.45)"; e.currentTarget.style.transform="none"; }}
                  >
                    {isFr ? "Commander maintenant" : "Order now"} <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/internet"
                    className="flex items-center gap-2 w-full sm:w-auto justify-center"
                    style={{ height:52, paddingLeft:24, paddingRight:24, border:"1px solid rgba(6,182,212,0.35)", borderRadius:10, fontSize:15, fontWeight:600, color:"#67E8F9", textDecoration:"none", fontFamily:"'Space Grotesk', sans-serif", background:"rgba(6,182,212,0.06)", backdropFilter:"blur(8px)", transition:"border-color .18s, background .18s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor="rgba(6,182,212,0.6)"; e.currentTarget.style.background="rgba(6,182,212,0.12)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor="rgba(6,182,212,0.35)"; e.currentTarget.style.background="rgba(6,182,212,0.06)"; }}
                  >
                    {isFr ? "Voir les forfaits" : "See plans"}
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

      </main>

      <Footer />
      <LaunchOfferPopup />
    </div>
  );
};

export default Index;
