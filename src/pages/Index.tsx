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
import { usePublicServices, type PublicService } from "@/hooks/usePublicServices";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const FALLBACK_PLANS: PublicService[] = [
  { id:"f1", sku:"", name:"Essentiel", price:39.99, is_recommended:false, category:"Internet", billing_type:"monthly", display_order:1, tags:[], badges:[], is_featured:false, promo_eligible:false, visible_website:true, visible_simulator:false, visible_checkout:true, visible_portal:true, status:"active", activation_fee_rule:null, installation_fee_rule:null, shipping_fee_rule:null, short_description:"Idéal pour surfer et streamer", description:null, features_json:["100 Mbps symétrique","Données illimitées","Sans contrat","Activation en 10 min"] },
  { id:"f2", sku:"", name:"Performance", price:59.99, is_recommended:true, category:"Internet", billing_type:"monthly", display_order:2, tags:[], badges:[], is_featured:true, promo_eligible:false, visible_website:true, visible_simulator:false, visible_checkout:true, visible_portal:true, status:"active", activation_fee_rule:null, installation_fee_rule:null, shipping_fee_rule:null, short_description:"Parfait pour toute la famille", description:null, features_json:["500 Mbps symétrique","Données illimitées","Sans contrat","Support 24/7","WiFi 6 inclus"] },
  { id:"f3", sku:"", name:"Ultime 1 Gig", price:79.99, is_recommended:false, category:"Internet", billing_type:"monthly", display_order:3, tags:[], badges:[], is_featured:false, promo_eligible:false, visible_website:true, visible_simulator:false, visible_checkout:true, visible_portal:true, status:"active", activation_fee_rule:null, installation_fee_rule:null, shipping_fee_rule:null, short_description:"Pour les power users", description:null, features_json:["1 Gbps symétrique","Données illimitées","Sans contrat","IP fixe incluse","Support prioritaire"] },
];

const WHY = [
  { icon: Zap,       title: "Activation 10 min",        desc: "Votre service actif en moins de 10 minutes. Sans technicien, sans attente.",                  accent: "#A78BFA", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.35)" },
  { icon: Shield,    title: "Zéro contrat",              desc: "Résiliez ou changez à tout moment, sans frais cachés ni pénalité.",                           accent: "#06B6D4", bg: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.35)"   },
  { icon: Wifi,      title: "Réseau 99,9% uptime",       desc: "Infrastructure haute disponibilité dédiée aux clients Nivra.",                                accent: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)"  },
  { icon: Headphones,title: "Support québécois 24/7",    desc: "Équipe locale disponible à toute heure par téléphone, chat et courriel.",                     accent: "#FBBF24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.35)"  },
];

const TESTIMONIALS = [
  { name:"Marie-Claude B.", city:"Montréal", rating:5, quote:"Jamais aussi peu de problèmes avec Internet. Et le service client est vraiment humain — ils répondent vraiment." },
  { name:"Jean-François L.", city:"Laval",   rating:5, quote:"Activation en 8 minutes chrono. Je n'en revenais pas. Le 500 Mbps tourne parfaitement pour 4 personnes en télétravail." },
  { name:"Sophie T.",        city:"Longueuil",rating:5, quote:"Prix honnêtes, pas de surprise à la facture, et ils répondent vraiment au téléphone. Rare de nos jours." },
];

const SERVICES = [
  { icon: Wifi,       label:"Internet",   sub:"Jusqu'à 1 Gbps", to:"/internet", accent:"#A78BFA", bg:"rgba(124,58,237,0.12)", border:"rgba(124,58,237,0.35)" },
  { icon: Tv,         label:"Télévision", sub:"26+ chaînes HD",  to:"/tv",       accent:"#06B6D4", bg:"rgba(6,182,212,0.12)",  border:"rgba(6,182,212,0.35)"  },
  { icon: Smartphone, label:"Mobile",     sub:"Sans contrat",    to:"/mobile",   accent:"#10B981", bg:"rgba(16,185,129,0.12)", border:"rgba(16,185,129,0.35)" },
];

const getFeatures = (plan: PublicService): string[] => {
  if (plan.features_json && plan.features_json.length > 0) return plan.features_json;
  if (plan.description) {
    return plan.description
      .split(/•|\||\n|;/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);
  }
  return [];
};

const Index = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const { data: servicesData } = usePublicServices({ surface:"website", categories:["Internet"] });
  const plans = servicesData && servicesData.length > 0 ? servicesData.slice(0, 3) : FALLBACK_PLANS;

  return (
    <div className="min-h-screen" style={{ background: "#020209", position: "relative" }}>
      {/* Global grid overlay across all sections */}
      <div aria-hidden style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none", zIndex: 0 }} />
      {/* Slow-moving global aurora */}
      <div aria-hidden style={{ position: "fixed", top: "30%", right: "-20%", width: 800, height: 800, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0, animation: "n-aurora-1 20s ease-in-out infinite" }} />
      <div aria-hidden style={{ position: "fixed", bottom: "10%", left: "-15%", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0, animation: "n-aurora-2 26s ease-in-out infinite" }} />
      <SEOHead {...SEO_DATA.home} />
      <LocalBusinessSchema />
      <SchemaMarkup includeBrand={false} includeHomeFaq includeProducts />
      <Header />
      <HomeStatusBanner />

      <main id="main-content" tabIndex={-1} style={{ position: "relative", zIndex: 1 }}>

        {/* ════════════════════════════════════════════════════
            HERO — premium dark aurora
        ════════════════════════════════════════════════════ */}
        <Hero />

        {/* ════════════════════════════════════════════════════
            SERVICES — glass cards with per-service accent
        ════════════════════════════════════════════════════ */}
        <section style={{ background: "#06040F", paddingTop: 40, paddingBottom: 40, borderTop: "1px solid rgba(124,58,237,0.12)" }}>
          <div className="container mx-auto px-5 sm:px-10 max-w-[1200px]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {SERVICES.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Link
                    to={s.to}
                    className="group flex items-center gap-5 rounded-2xl p-6"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      textDecoration: "none",
                      transition: "all 0.25s ease",
                      display: "flex",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = s.border;
                      e.currentTarget.style.boxShadow = `0 8px 32px ${s.bg}`;
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    <div className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                      <s.icon className="w-7 h-7" style={{ color: s.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em" }}>{s.sub}</div>
                    </div>
                    <ChevronRight className="w-5 h-5 shrink-0" style={{ color: s.accent, transition: "transform .2s" }} />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            FORFAITS — live data plan cards
        ════════════════════════════════════════════════════ */}
        <section style={{ background: "#020209", paddingTop: 96, paddingBottom: 96, borderTop: "1px solid rgba(124,58,237,0.08)" }}>
          <div className="container mx-auto px-5 sm:px-10 max-w-[1200px]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-14"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 100 }}>
                <Wifi className="w-4 h-4" style={{ color: "#A78BFA" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {isFr ? "Nos forfaits Internet" : "Internet Plans"}
                </span>
              </div>
              <h2 className="font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4.5vw, 52px)", letterSpacing: "-1.5px", lineHeight: 1.08, marginTop: 16 }}>
                {isFr
                  ? <>Internet <span className="n-shimmer-text">sans compromis</span></>
                  : <>Internet <span className="n-shimmer-text">without compromise</span></>}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 17, marginTop: 12 }}>
                {isFr ? "Sans contrat · Données illimitées · Activation immédiate" : "No contract · Unlimited data · Instant activation"}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-stretch">
              {plans.map((plan, i) => (
                <motion.div
                  key={plan.id}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  className="flex"
                >
                  <div
                    className="relative flex flex-col w-full rounded-3xl overflow-hidden"
                    style={{
                      background: plan.is_recommended
                        ? "linear-gradient(145deg, rgba(124,58,237,0.18) 0%, rgba(255,255,255,0.04) 60%)"
                        : "rgba(255,255,255,0.04)",
                      border: plan.is_recommended
                        ? "1.5px solid rgba(124,58,237,0.55)"
                        : "1px solid rgba(255,255,255,0.08)",
                      boxShadow: plan.is_recommended
                        ? "0 0 60px rgba(124,58,237,0.18), 0 24px 60px rgba(0,0,0,0.5)"
                        : "0 4px 24px rgba(0,0,0,0.4)",
                    }}
                  >
                    {plan.is_recommended && (
                      <>
                        <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 40% at 50% -10%, rgba(124,58,237,0.14) 0%, transparent 60%)", pointerEvents: "none" }} />
                        <div className="text-center py-2" style={{ background: "linear-gradient(90deg, #7C3AED, #8B5CF6)", color: "#fff", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "'JetBrains Mono', monospace" }}>
                          {isFr ? "Plus populaire" : "Most popular"}
                        </div>
                      </>
                    )}
                    <div className="flex flex-col flex-1 p-7 relative">
                      <div className="font-bold text-white mb-1" style={{ fontSize: 20, fontFamily: "'Space Grotesk', sans-serif" }}>{plan.name}</div>
                      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>
                        {plan.short_description || (isFr ? "Internet haute vitesse · Sans contrat" : "High-speed internet · No contract")}
                      </p>
                      <div className="flex items-baseline gap-1 mb-5">
                        <span className="font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 54, letterSpacing: "-2px", lineHeight: 1 }}>{plan.price.toFixed(0)}</span>
                        <span className="font-bold text-white" style={{ fontSize: 22 }}>$</span>
                        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>/mois</span>
                      </div>
                      <div className="h-px mb-5" style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)" }} />
                      <ul className="space-y-2.5 mb-7 flex-1">
                        {getFeatures(plan).map((f) => (
                          <li key={f} className="flex items-start gap-2.5" style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: plan.is_recommended ? "#A78BFA" : "rgba(124,58,237,0.7)" }} />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Link
                        to="/commander"
                        className="flex items-center justify-center gap-2 font-bold text-white"
                        style={{
                          height: 52,
                          borderRadius: 10,
                          fontSize: 15,
                          textDecoration: "none",
                          fontFamily: "'Space Grotesk', sans-serif",
                          background: plan.is_recommended
                            ? "linear-gradient(135deg, #7C3AED 0%, #6D28D9 50%, #5B21B6 100%)"
                            : "rgba(124,58,237,0.12)",
                          border: plan.is_recommended ? "none" : "1px solid rgba(124,58,237,0.35)",
                          boxShadow: plan.is_recommended
                            ? "0 0 0 1px rgba(124,58,237,0.5), 0 8px 24px rgba(124,58,237,0.4)"
                            : "none",
                          transition: "box-shadow .2s, transform .15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-1px)";
                          if (plan.is_recommended) e.currentTarget.style.boxShadow = "0 0 0 1px rgba(124,58,237,0.7), 0 12px 32px rgba(124,58,237,0.55)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "none";
                          if (plan.is_recommended) e.currentTarget.style.boxShadow = "0 0 0 1px rgba(124,58,237,0.5), 0 8px 24px rgba(124,58,237,0.4)";
                        }}
                      >
                        {isFr ? "Commander" : "Order"} <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.4 }} className="text-center mt-8">
              <Link
                to="/internet"
                style={{ color: "#A78BFA", fontSize: 15, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'Space Grotesk', sans-serif", transition: "color .2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#A78BFA")}
              >
                {isFr ? "Voir tous les forfaits" : "View all plans"} <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            POURQUOI NIVRA — feature cards with accent colors
        ════════════════════════════════════════════════════ */}
        <section style={{ background: "#06040F", paddingTop: 96, paddingBottom: 96, borderTop: "1px solid rgba(124,58,237,0.08)" }}>
          <div className="container mx-auto px-5 sm:px-10 max-w-[1200px]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-14"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 100 }}>
                <Award className="w-4 h-4" style={{ color: "#67E8F9" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#67E8F9", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {isFr ? "Pourquoi Nivra" : "Why Nivra"}
                </span>
              </div>
              <h2 className="font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4.5vw, 52px)", letterSpacing: "-1.5px", lineHeight: 1.08, marginTop: 16 }}>
                {isFr
                  ? <>Un ISP qui <span className="n-shimmer-text">vous respecte</span></>
                  : <>An ISP that <span className="n-shimmer-text">respects you</span></>}
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {WHY.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex gap-5 rounded-2xl p-7"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    cursor: "default",
                    transition: "border-color .25s, box-shadow .25s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = item.border;
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${item.bg}`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: item.bg, border: `1px solid ${item.border}` }}>
                    <item.icon className="w-6 h-6" style={{ color: item.accent }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-2" style={{ fontSize: 17, fontFamily: "'Space Grotesk', sans-serif" }}>{item.title}</h3>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14.5, lineHeight: 1.65 }}>{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            TESTIMONIALS
        ════════════════════════════════════════════════════ */}
        <section style={{ background: "#020209", paddingTop: 96, paddingBottom: 96, borderTop: "1px solid rgba(124,58,237,0.08)" }}>
          <div className="container mx-auto px-5 sm:px-10 max-w-[1200px]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-14"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 100 }}>
                <Star className="w-3.5 h-3.5" style={{ color: "#FCD34D" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FCD34D", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {isFr ? "Avis clients" : "Customer reviews"}
                </span>
              </div>
              <h2 className="font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4.5vw, 52px)", letterSpacing: "-1.5px", lineHeight: 1.08, marginTop: 16 }}>
                {isFr
                  ? <>Ils ont <span className="n-shimmer-text">choisi Nivra</span></>
                  : <>They <span className="n-shimmer-text">chose Nivra</span></>}
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {TESTIMONIALS.map((t, i) => (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.12 }}
                  className="flex flex-col gap-5 rounded-2xl p-7"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, s) => (
                      <Star key={s} className="w-4 h-4 fill-current" style={{ color: "#F59E0B" }} />
                    ))}
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, lineHeight: 1.7, flex: 1 }}>"{t.quote}"</p>
                  <div>
                    <div className="font-semibold text-white" style={{ fontSize: 14, fontFamily: "'Space Grotesk', sans-serif" }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: 4, marginTop: 3, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
                      <MapPin className="w-3 h-3" />{t.city}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            CTA FINAL
        ════════════════════════════════════════════════════ */}
        <section style={{ background: "#06040F", paddingTop: 64, paddingBottom: 64, borderTop: "1px solid rgba(124,58,237,0.08)" }}>
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="container mx-auto px-5 sm:px-10 max-w-[900px]"
          >
            <div
              className="rounded-3xl relative overflow-hidden text-center"
              style={{
                background: "linear-gradient(135deg, rgba(124,58,237,0.14) 0%, rgba(255,255,255,0.03) 50%, rgba(6,182,212,0.07) 100%)",
                border: "1px solid rgba(124,58,237,0.3)",
                boxShadow: "0 0 120px rgba(124,58,237,0.15), 0 32px 80px rgba(0,0,0,0.6)",
                padding: "clamp(36px, 5vw, 64px) clamp(24px, 5vw, 72px)",
              }}
            >
              {/* Radial glow */}
              <div aria-hidden style={{ position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)", width: 600, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.2), transparent 70%)", pointerEvents: "none", filter: "blur(20px)" }} />
              {/* Grid overlay */}
              <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 100 }}>
                  <Clock className="w-3.5 h-3.5" style={{ color: "#67E8F9" }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#67E8F9", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {isFr ? "Activation en 10 minutes" : "10-minute activation"}
                  </span>
                </div>
                <h2 className="font-extrabold text-white mt-2 mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 5vw, 56px)", letterSpacing: "-1.5px", lineHeight: 1.06 }}>
                  {isFr
                    ? <>Prêt à <span className="n-shimmer-text">passer à Nivra</span> ?</>
                    : <>Ready to <span className="n-shimmer-text">switch to Nivra</span>?</>}
                </h2>
                <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 18, lineHeight: 1.65, maxWidth: 480, margin: "0 auto 40px" }}>
                  {isFr ? "Sans contrat, sans technicien, sans surprise. Commandez aujourd'hui." : "No contract, no technician, no surprise. Order today."}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    to="/commander"
                    className="flex items-center gap-2.5 font-bold text-white"
                    style={{
                      height: 58, paddingLeft: 36, paddingRight: 36,
                      borderRadius: 10, fontSize: 17, textDecoration: "none",
                      fontFamily: "'Space Grotesk', sans-serif",
                      background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 50%, #5B21B6 100%)",
                      boxShadow: "0 0 0 1px rgba(124,58,237,0.5), 0 10px 32px rgba(124,58,237,0.5)",
                      transition: "box-shadow .2s, transform .15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 0 0 1px rgba(124,58,237,0.7), 0 12px 40px rgba(124,58,237,0.65)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "0 0 0 1px rgba(124,58,237,0.5), 0 10px 32px rgba(124,58,237,0.5)";
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    {isFr ? "Commander maintenant" : "Order now"} <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    to="/internet"
                    className="flex items-center gap-2"
                    style={{
                      height: 58, paddingLeft: 28, paddingRight: 28,
                      border: "1px solid rgba(6,182,212,0.35)",
                      borderRadius: 10, fontSize: 16, fontWeight: 600,
                      color: "#67E8F9", textDecoration: "none",
                      fontFamily: "'Space Grotesk', sans-serif",
                      background: "rgba(6,182,212,0.06)",
                      backdropFilter: "blur(8px)",
                      transition: "border-color .2s, background .2s, box-shadow .2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "rgba(6,182,212,0.6)";
                      e.currentTarget.style.background = "rgba(6,182,212,0.12)";
                      e.currentTarget.style.boxShadow = "0 0 20px rgba(6,182,212,0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "rgba(6,182,212,0.35)";
                      e.currentTarget.style.background = "rgba(6,182,212,0.06)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
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
