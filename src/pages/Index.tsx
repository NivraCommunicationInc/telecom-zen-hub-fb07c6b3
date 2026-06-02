import { motion, type Variants } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight, Wifi, Zap, Shield, Headphones,
  Star, CheckCircle2, Tv, Smartphone, ChevronRight,
  Award, Clock, MapPin,
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
  { icon: Zap,        title: "Activation 10 min",     desc: "Votre service actif en moins de 10 minutes. Sans technicien, sans attente.",        accent: "#A78BFA", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.35)" },
  { icon: Shield,     title: "Zéro contrat",           desc: "Résiliez ou changez à tout moment, sans frais cachés ni pénalité.",                 accent: "#06B6D4", bg: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.35)"   },
  { icon: Wifi,       title: "Réseau 99,9% uptime",    desc: "Infrastructure haute disponibilité dédiée aux clients Nivra.",                      accent: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)"  },
  { icon: Headphones, title: "Support québécois 24/7", desc: "Équipe locale disponible à toute heure par téléphone, chat et courriel.",           accent: "#FBBF24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.35)"  },
];

const TESTIMONIALS = [
  { name: "Marie-Claude B.", city: "Montréal",  rating: 5, quote: "Jamais aussi peu de problèmes avec Internet. Le service client est vraiment humain — ils répondent vraiment." },
  { name: "Jean-François L.", city: "Laval",    rating: 5, quote: "Activation en 8 minutes chrono. Le 500 Mbps tourne parfaitement pour 4 personnes en télétravail." },
  { name: "Sophie T.",        city: "Longueuil", rating: 5, quote: "Prix honnêtes, pas de surprise à la facture, et ils répondent vraiment au téléphone. Rare de nos jours." },
];

const SERVICES = [
  { icon: Wifi,       label: "Internet",   sub: "Jusqu'à 1 Gbps", to: "/internet", accent: "#A78BFA", bg: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.35)" },
  { icon: Tv,         label: "Télévision", sub: "26+ chaînes HD",  to: "/tv",       accent: "#06B6D4", bg: "rgba(6,182,212,0.12)",  border: "rgba(6,182,212,0.35)"  },
  { icon: Smartphone, label: "Mobile",     sub: "Sans contrat",    to: "/mobile",   accent: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)" },
];

const BADGE_COLORS: Record<string, string> = {
  "bg-purple-500":  "#8B5CF6",
  "bg-accent":      "#7C3AED",
  "bg-blue-500":    "#3B82F6",
  "bg-cyan-500":    "#06B6D4",
  "bg-gradient-to-r from-orange-500 to-red-500": "#F97316",
};

const Index = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const { plans } = useInternetPlans(isFr);
  const displayPlans = plans.slice(0, 3);

  return (
    <div className="min-h-screen" style={{ background: "#020209", position: "relative" }}>
      {/* Global subtle grid across all sections */}
      <div aria-hidden style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden style={{ position: "fixed", top: "30%", right: "-20%", width: 800, height: 800, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0, animation: "n-aurora-1 20s ease-in-out infinite" }} />
      <div aria-hidden style={{ position: "fixed", bottom: "10%", left: "-15%", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.04) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0, animation: "n-aurora-2 26s ease-in-out infinite" }} />

      <SEOHead {...SEO_DATA.home} />
      <LocalBusinessSchema />
      <SchemaMarkup includeBrand={false} includeHomeFaq includeProducts />
      <Header />
      <HomeStatusBanner />

      <main id="main-content" tabIndex={-1} style={{ position: "relative", zIndex: 1 }}>

        {/* ══ HERO ══ */}
        <Hero />

        {/* ══ SERVICES NAV ══ */}
        <section style={{ background: "#06040F", paddingTop: 32, paddingBottom: 32, borderTop: "1px solid rgba(124,58,237,0.12)" }}>
          <div className="container mx-auto px-4 sm:px-10 max-w-[1200px]">
            <div className="grid grid-cols-3 gap-3">
              {SERVICES.map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }}>
                  <Link
                    to={s.to}
                    className="flex items-center gap-3 sm:gap-5 rounded-xl sm:rounded-2xl p-3 sm:p-5"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", textDecoration: "none", transition: "all 0.22s", display: "flex" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = s.border; e.currentTarget.style.boxShadow = `0 6px 24px ${s.bg}`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
                  >
                    <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                      <s.icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: s.accent }} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-sm sm:text-base truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{s.label}</div>
                      <div className="hidden sm:block" style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>{s.sub}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 ml-auto shrink-0" style={{ color: s.accent }} />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ FORFAITS ══ */}
        <section style={{ background: "#020209", paddingTop: 80, paddingBottom: 80, borderTop: "1px solid rgba(124,58,237,0.08)" }}>
          <div className="container mx-auto px-4 sm:px-10 max-w-[1200px]">

            {/* Section header */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55 }} className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 100 }}>
                <Wifi className="w-3.5 h-3.5" style={{ color: "#A78BFA" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {isFr ? "Forfaits Internet" : "Internet Plans"}
                </span>
              </div>
              <h2 className="font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(26px, 4vw, 48px)", letterSpacing: "-1.5px", lineHeight: 1.08, marginTop: 14 }}>
                {isFr ? <>Internet <span className="n-shimmer-text">sans compromis</span></> : <>Internet <span className="n-shimmer-text">without compromise</span></>}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 16, marginTop: 10 }}>
                {isFr ? "Sans contrat · Données illimitées · Activation immédiate" : "No contract · Unlimited data · Instant activation"}
              </p>
            </motion.div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-stretch">
              {displayPlans.map((plan, i) => {
                const badgeHex = BADGE_COLORS[plan.badgeColor || ""] || "#7C3AED";
                return (
                  <motion.div key={plan.id} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="flex">
                    <div
                      className="relative flex flex-col w-full rounded-2xl overflow-hidden"
                      style={{
                        background: plan.featured
                          ? "linear-gradient(160deg, rgba(124,58,237,0.16) 0%, rgba(255,255,255,0.04) 60%)"
                          : "rgba(255,255,255,0.04)",
                        border: plan.featured ? "1.5px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.09)",
                        boxShadow: plan.featured ? "0 0 50px rgba(124,58,237,0.15), 0 20px 50px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.4)",
                      }}
                    >
                      {/* Glow on featured */}
                      {plan.featured && <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 35% at 50% -5%, rgba(124,58,237,0.12) 0%, transparent 60%)", pointerEvents: "none" }} />}

                      {/* Badge bar */}
                      <div className="flex items-center justify-between px-5 pt-4 pb-0">
                        <span style={{ background: badgeHex, color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", padding: "4px 10px", borderRadius: 6 }}>
                          {plan.badge}
                        </span>
                        {plan.featured && (
                          <span style={{ color: "#A78BFA", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
                            {isFr ? "POPULAIRE" : "POPULAR"}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col flex-1 px-5 pt-4 pb-5 relative">
                        {/* Plan name */}
                        <div className="font-bold text-white mb-1" style={{ fontSize: 18, fontFamily: "'Space Grotesk', sans-serif" }}>{plan.name}</div>

                        {/* Speed — prominent */}
                        <div className="flex items-baseline gap-1 mb-1">
                          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "clamp(32px, 5vw, 44px)", letterSpacing: "-2px", lineHeight: 1, color: plan.featured ? "#A78BFA" : "#fff" }}>
                            {plan.speed.replace(" Mbps", "").replace(" Gbps", "")}
                          </span>
                          <span style={{ color: plan.featured ? "#C4B5FD" : "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>
                            {plan.speed.includes("Gbps") ? "Gbps" : "Mbps"}
                          </span>
                        </div>

                        {/* Description */}
                        {plan.description && (
                          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>{plan.description}</p>
                        )}

                        {/* Price */}
                        <div className="flex items-baseline gap-0.5 mb-4">
                          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 46, letterSpacing: "-2px", lineHeight: 1, color: "#fff" }}>{plan.price.toFixed(0)}</span>
                          <span style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>$</span>
                          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginLeft: 2 }}>/mois</span>
                        </div>

                        <div className="h-px mb-4" style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)" }} />

                        {/* Features */}
                        <ul className="space-y-2 mb-5 flex-1">
                          {plan.features.slice(0, 5).map((f) => (
                            <li key={f} className="flex items-start gap-2.5" style={{ fontSize: 13.5, color: "rgba(255,255,255,0.72)" }}>
                              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: plan.featured ? "#A78BFA" : "#6D28D9" }} />
                              {f}
                            </li>
                          ))}
                        </ul>

                        {/* CTA */}
                        <Link
                          to={`/commander?plan=${plan.id}`}
                          className="flex items-center justify-center gap-2 font-bold text-white"
                          style={{
                            height: 48, borderRadius: 10, fontSize: 14, textDecoration: "none",
                            fontFamily: "'Space Grotesk', sans-serif",
                            background: plan.featured ? "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)" : "rgba(124,58,237,0.14)",
                            border: plan.featured ? "none" : "1px solid rgba(124,58,237,0.4)",
                            boxShadow: plan.featured ? "0 0 0 1px rgba(124,58,237,0.5), 0 6px 20px rgba(124,58,237,0.35)" : "none",
                            transition: "box-shadow .18s, transform .15s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-1px)";
                            if (plan.featured) e.currentTarget.style.boxShadow = "0 0 0 1px rgba(124,58,237,0.7), 0 10px 28px rgba(124,58,237,0.5)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "none";
                            if (plan.featured) e.currentTarget.style.boxShadow = "0 0 0 1px rgba(124,58,237,0.5), 0 6px 20px rgba(124,58,237,0.35)";
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

            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.35 }} className="text-center mt-7">
              <Link to="/internet" style={{ color: "#A78BFA", fontSize: 14, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "'Space Grotesk', sans-serif", transition: "color .18s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#A78BFA")}
              >
                {isFr ? "Voir tous les forfaits" : "View all plans"} <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ══ POURQUOI NIVRA ══ */}
        <section style={{ background: "#06040F", paddingTop: 80, paddingBottom: 80, borderTop: "1px solid rgba(124,58,237,0.08)" }}>
          <div className="container mx-auto px-4 sm:px-10 max-w-[1200px]">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55 }} className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 100 }}>
                <Award className="w-3.5 h-3.5" style={{ color: "#67E8F9" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#67E8F9", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {isFr ? "Pourquoi Nivra" : "Why Nivra"}
                </span>
              </div>
              <h2 className="font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(26px, 4vw, 48px)", letterSpacing: "-1.5px", lineHeight: 1.08, marginTop: 14 }}>
                {isFr ? <>Un ISP qui <span className="n-shimmer-text">vous respecte</span></> : <>An ISP that <span className="n-shimmer-text">respects you</span></>}
              </h2>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {WHY.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                  className="flex gap-4 rounded-2xl p-6"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", cursor: "default", transition: "border-color .22s, box-shadow .22s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = item.border; (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 28px ${item.bg}`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                >
                  <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                    <item.icon className="w-5 h-5" style={{ color: item.accent }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-1.5" style={{ fontSize: 16, fontFamily: "'Space Grotesk', sans-serif" }}>{item.title}</h3>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.6 }}>{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ TÉMOIGNAGES ══ */}
        <section style={{ background: "#020209", paddingTop: 80, paddingBottom: 80, borderTop: "1px solid rgba(124,58,237,0.08)" }}>
          <div className="container mx-auto px-4 sm:px-10 max-w-[1200px]">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55 }} className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 100 }}>
                <Star className="w-3.5 h-3.5" style={{ color: "#FCD34D" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FCD34D", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {isFr ? "Avis clients" : "Customer reviews"}
                </span>
              </div>
              <h2 className="font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(26px, 4vw, 48px)", letterSpacing: "-1.5px", lineHeight: 1.08, marginTop: 14 }}>
                {isFr ? <>Ils ont <span className="n-shimmer-text">choisi Nivra</span></> : <>They <span className="n-shimmer-text">chose Nivra</span></>}
              </h2>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {TESTIMONIALS.map((t, i) => (
                <motion.div key={t.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: i * 0.1 }}
                  className="flex flex-col gap-4 rounded-2xl p-6"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, s) => <Star key={s} className="w-3.5 h-3.5 fill-current" style={{ color: "#F59E0B" }} />)}
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14.5, lineHeight: 1.65, flex: 1 }}>"{t.quote}"</p>
                  <div>
                    <div className="font-semibold text-white" style={{ fontSize: 13.5, fontFamily: "'Space Grotesk', sans-serif" }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: 3, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                      <MapPin className="w-3 h-3" />{t.city}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CTA FINAL ══ */}
        <section style={{ background: "#06040F", paddingTop: 64, paddingBottom: 64, borderTop: "1px solid rgba(124,58,237,0.08)" }}>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.55 }}
            className="container mx-auto px-4 sm:px-10 max-w-[860px]"
          >
            <div className="rounded-2xl relative overflow-hidden text-center"
              style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.14) 0%, rgba(255,255,255,0.03) 50%, rgba(6,182,212,0.07) 100%)", border: "1px solid rgba(124,58,237,0.28)", boxShadow: "0 0 80px rgba(124,58,237,0.12), 0 24px 60px rgba(0,0,0,0.5)", padding: "clamp(36px, 5vw, 60px) clamp(20px, 4vw, 64px)" }}
            >
              <div aria-hidden style={{ position: "absolute", top: "-40%", left: "50%", transform: "translateX(-50%)", width: 500, height: 250, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.18), transparent 70%)", pointerEvents: "none", filter: "blur(20px)" }} />
              <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 100 }}>
                  <Clock className="w-3.5 h-3.5" style={{ color: "#67E8F9" }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#67E8F9", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {isFr ? "Activation en 10 minutes" : "10-minute activation"}
                  </span>
                </div>
                <h2 className="font-extrabold text-white mt-2 mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(24px, 4.5vw, 48px)", letterSpacing: "-1.5px", lineHeight: 1.1 }}>
                  {isFr ? <>Prêt à <span className="n-shimmer-text">passer à Nivra</span> ?</> : <>Ready to <span className="n-shimmer-text">switch to Nivra</span>?</>}
                </h2>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, lineHeight: 1.6, maxWidth: 440, margin: "0 auto 32px" }}>
                  {isFr ? "Sans contrat, sans technicien, sans surprise. Commandez aujourd'hui." : "No contract, no technician, no surprise. Order today."}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link to="/commander"
                    className="flex items-center gap-2 font-bold text-white w-full sm:w-auto justify-center"
                    style={{ height: 52, paddingLeft: 32, paddingRight: 32, borderRadius: 10, fontSize: 15, textDecoration: "none", fontFamily: "'Space Grotesk', sans-serif", background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)", boxShadow: "0 0 0 1px rgba(124,58,237,0.5), 0 8px 28px rgba(124,58,237,0.45)", transition: "box-shadow .18s, transform .15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(124,58,237,0.7), 0 10px 36px rgba(124,58,237,0.6)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(124,58,237,0.5), 0 8px 28px rgba(124,58,237,0.45)"; e.currentTarget.style.transform = "none"; }}
                  >
                    {isFr ? "Commander maintenant" : "Order now"} <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/internet"
                    className="flex items-center gap-2 w-full sm:w-auto justify-center"
                    style={{ height: 52, paddingLeft: 24, paddingRight: 24, border: "1px solid rgba(6,182,212,0.35)", borderRadius: 10, fontSize: 15, fontWeight: 600, color: "#67E8F9", textDecoration: "none", fontFamily: "'Space Grotesk', sans-serif", background: "rgba(6,182,212,0.06)", backdropFilter: "blur(8px)", transition: "border-color .18s, background .18s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(6,182,212,0.6)"; e.currentTarget.style.background = "rgba(6,182,212,0.12)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(6,182,212,0.35)"; e.currentTarget.style.background = "rgba(6,182,212,0.06)"; }}
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
