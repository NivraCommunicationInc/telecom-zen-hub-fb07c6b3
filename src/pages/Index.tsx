import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight, Wifi, Zap, Shield, Headphones,
  Star, CheckCircle2, Tv, Smartphone, ChevronRight,
  Award, Clock, MapPin
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";
import SchemaMarkup from "@/components/seo/SchemaMarkup";
import LocalBusinessSchema from "@/components/LocalBusinessSchema";
import HomeStatusBanner from "@/components/HomeStatusBanner";
import LaunchOfferPopup from "@/components/marketing/LaunchOfferPopup";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePublicServices, type PublicService } from "@/hooks/usePublicServices";

/* ─── animation helpers ─────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.7 } },
};

/* ─── constants ─────────────────────────────────────────── */
const P = "#7C3AED";
const PL = "#8B5CF6";
const PE = "#A78BFA";
const BG = "#0A0A0F";
const BG2 = "#0F0F1A";
const CARD = "#1A1A2E";

const FALLBACK_PLANS: PublicService[] = [
  { id:"f1", sku:"", name:"Essentiel", price:39.99, is_recommended:false, category:"Internet", billing_type:"monthly", display_order:1, tags:[], badges:[], is_featured:false, promo_eligible:false, visible_website:true, visible_simulator:false, visible_checkout:true, visible_portal:true, status:"active", activation_fee_rule:null, installation_fee_rule:null, shipping_fee_rule:null, short_description:"Idéal pour surfer et streamer", description:null, features_json:["100 Mbps symétrique","Données illimitées","Sans contrat","Activation en 10 min"] },
  { id:"f2", sku:"", name:"Performance", price:59.99, is_recommended:true, category:"Internet", billing_type:"monthly", display_order:2, tags:[], badges:[], is_featured:true, promo_eligible:false, visible_website:true, visible_simulator:false, visible_checkout:true, visible_portal:true, status:"active", activation_fee_rule:null, installation_fee_rule:null, shipping_fee_rule:null, short_description:"Parfait pour toute la famille", description:null, features_json:["500 Mbps symétrique","Données illimitées","Sans contrat","Support 24/7","WiFi 6 inclus"] },
  { id:"f3", sku:"", name:"Ultime 1 Gig", price:79.99, is_recommended:false, category:"Internet", billing_type:"monthly", display_order:3, tags:[], badges:[], is_featured:false, promo_eligible:false, visible_website:true, visible_simulator:false, visible_checkout:true, visible_portal:true, status:"active", activation_fee_rule:null, installation_fee_rule:null, shipping_fee_rule:null, short_description:"Pour les power users", description:null, features_json:["1 Gbps symétrique","Données illimitées","Sans contrat","IP fixe incluse","Support prioritaire"] },
];

const WHY = [
  { icon: Zap, title:"Activation 10 min", desc:"Votre service actif en moins de 10 minutes. Sans technicien, sans attente." },
  { icon: Shield, title:"Zéro contrat", desc:"Résiliez ou changez à tout moment, sans frais cachés ni pénalité." },
  { icon: Wifi, title:"Réseau 99,9% uptime", desc:"Infrastructure haute disponibilité dédiée aux clients Nivra." },
  { icon: Headphones, title:"Support québécois 24/7", desc:"Équipe locale disponible à toute heure par téléphone, chat et courriel." },
];

const TESTIMONIALS = [
  { name:"Marie-Claude B.", city:"Montréal", rating:5, quote:"Jamais aussi peu de problèmes avec Internet. Et le service client est vraiment humain — ils répondent vraiment." },
  { name:"Jean-François L.", city:"Laval", rating:5, quote:"Activation en 8 minutes chrono. Je n'en revenais pas. Le 500 Mbps tourne parfaitement pour 4 personnes en télétravail." },
  { name:"Sophie T.", city:"Longueuil", rating:5, quote:"Prix honnêtes, pas de surprise à la facture, et ils répondent vraiment au téléphone. Rare de nos jours." },
];

const SERVICES = [
  { icon: Wifi, label:"Internet", sub:"Jusqu'à 1 Gbps", to:"/internet", color:"rgba(124,58,237,0.2)" },
  { icon: Tv, label:"Télévision", sub:"26+ chaînes HD", to:"/tv", color:"rgba(99,102,241,0.2)" },
  { icon: Smartphone, label:"Mobile", sub:"Sans contrat", to:"/mobile", color:"rgba(139,92,246,0.2)" },
];

/* ─── component ─────────────────────────────────────────── */
const Index = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const { data: servicesData } = usePublicServices({ surface:"website", categories:["Internet"] });
  const plans = servicesData && servicesData.length > 0 ? servicesData.slice(0, 3) : FALLBACK_PLANS;

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <SEOHead {...SEO_DATA.home} />
      <LocalBusinessSchema />
      <SchemaMarkup includeBrand={false} includeHomeFaq includeProducts />
      <Header />
      <HomeStatusBanner />

      <main id="main-content" tabIndex={-1}>

        {/* ════════════════════════════════════════════════════
            HERO — full-screen gradient + animated orbs
        ════════════════════════════════════════════════════ */}
        <section
          className="relative overflow-hidden"
          style={{
            background: "linear-gradient(160deg, #0A0A0F 0%, #14082E 45%, #0A0A0F 100%)",
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* Animated gradient orbs */}
          <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="nv-orb-1 absolute" style={{ width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)", top: "-15%", left: "-10%", filter: "blur(40px)" }} />
            <div className="nv-orb-2 absolute" style={{ width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)", bottom: "-10%", right: "-5%", filter: "blur(40px)" }} />
            <div className="nv-orb-3 absolute" style={{ width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", top: "40%", left: "50%", filter: "blur(60px)" }} />
          </div>

          {/* Grid overlay */}
          <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

          <div className="container mx-auto px-5 sm:px-10 max-w-[1200px] relative z-10 py-24 sm:py-32">
            <div className="max-w-[780px]">
              {/* Badge */}
              <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp} className="mb-8">
                <span className="nv-badge">
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: PE, display: "inline-block", flexShrink: 0 }} />
                  {isFr ? "Internet · TV · Mobile — Québec" : "Internet · TV · Mobile — Quebec"}
                </span>
              </motion.div>

              {/* H1 */}
              <motion.h1
                custom={1}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className="font-extrabold text-white"
                style={{ fontSize: "clamp(40px, 7vw, 80px)", lineHeight: 1.03, letterSpacing: "-2px", marginBottom: 28 }}
              >
                {isFr ? (
                  <>L'Internet<br /><span style={{ backgroundImage: `linear-gradient(135deg, ${PL}, ${PE})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>sans compromis</span><br />au Québec</>
                ) : (
                  <>Internet<br /><span style={{ backgroundImage: `linear-gradient(135deg, ${PL}, ${PE})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>without compromise</span><br />in Quebec</>
                )}
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                custom={2}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                style={{ fontSize: "clamp(17px, 2.2vw, 21px)", color: "rgba(255,255,255,0.62)", lineHeight: 1.65, maxWidth: 580, marginBottom: 40 }}
              >
                {isFr
                  ? "Forfaits Internet, TV et mobile sans contrat. Activation en 10 minutes. Prix garantis sans surprises."
                  : "No-contract Internet, TV and mobile plans. Activated in 10 minutes. Guaranteed prices, no surprises."}
              </motion.p>

              {/* CTAs */}
              <motion.div custom={3} initial="hidden" animate="visible" variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/internet"
                  style={{ height: 56, paddingLeft: 32, paddingRight: 32, background: P, borderRadius: 999, fontSize: 16, fontWeight: 700, color: "#fff", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 8px 28px rgba(124,58,237,0.5)", transition: "opacity 0.2s, transform 0.2s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.92"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}
                >
                  {isFr ? "Voir les forfaits" : "See plans"} <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  to="/couverture"
                  style={{ height: 56, paddingLeft: 28, paddingRight: 28, border: "1px solid rgba(124,58,237,0.4)", borderRadius: 999, fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.8)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, transition: "all 0.2s", backdropFilter: "blur(8px)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(124,58,237,0.7)"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(124,58,237,0.4)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
                >
                  <MapPin className="w-4 h-4" />
                  {isFr ? "Vérifier ma couverture" : "Check coverage"}
                </Link>
              </motion.div>

              {/* Trust stats */}
              <motion.div custom={4} initial="hidden" animate="visible" variants={fadeUp} className="flex flex-wrap gap-6 sm:gap-10 mt-14">
                {[
                  { value: "1 Gbps", label: isFr ? "Vitesse max" : "Top speed" },
                  { value: "19+", label: isFr ? "Villes couvertes" : "Cities covered" },
                  { value: "10 min", label: isFr ? "Activation" : "Activation" },
                  { value: "24/7", label: isFr ? "Support local" : "Local support" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="font-extrabold text-white" style={{ fontSize: 32, letterSpacing: "-1px", lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontWeight: 500, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>

          {/* Bottom fade */}
          <div aria-hidden className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none" style={{ background: `linear-gradient(to bottom, transparent, ${BG2})` }} />
        </section>

        {/* ════════════════════════════════════════════════════
            SERVICES — quick nav cards
        ════════════════════════════════════════════════════ */}
        <section style={{ background: BG2, paddingTop: 72, paddingBottom: 72, borderTop: "1px solid rgba(124,58,237,0.1)" }}>
          <div className="container mx-auto px-5 sm:px-10 max-w-[1200px]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {SERVICES.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Link
                    to={s.to}
                    className="group flex items-center gap-5 rounded-2xl p-6"
                    style={{ background: CARD, border: "1px solid rgba(124,58,237,0.15)", textDecoration: "none", transition: "all 0.25s ease", display: "flex" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(124,58,237,0.45)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(124,58,237,0.2)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(124,58,237,0.15)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
                  >
                    <div className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: s.color, border: "1px solid rgba(124,58,237,0.25)" }}>
                      <s.icon className="w-7 h-7" style={{ color: PE }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-lg">{s.label}</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{s.sub}</div>
                    </div>
                    <ChevronRight className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-1" style={{ color: PE }} />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            FORFAITS — live data plan cards
        ════════════════════════════════════════════════════ */}
        <section style={{ background: BG, paddingTop: 96, paddingBottom: 96, borderTop: "1px solid rgba(124,58,237,0.08)" }}>
          <div className="container mx-auto px-5 sm:px-10 max-w-[1200px]">
            <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-14">
              <span className="nv-badge mb-6 inline-flex">{isFr ? "Nos forfaits Internet" : "Internet Plans"}</span>
              <h2 className="font-extrabold text-white mt-5" style={{ fontSize: "clamp(28px, 4.5vw, 52px)", letterSpacing: "-1.5px", lineHeight: 1.08 }}>
                {isFr ? "Internet sans compromis" : "Internet without compromise"}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 18, marginTop: 14, maxWidth: 520, margin: "14px auto 0" }}>
                {isFr ? "Sans contrat · Données illimitées · Activation immédiate" : "No contract · Unlimited data · Instant activation"}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-stretch">
              {plans.map((plan, i) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.55, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                  className="flex"
                >
                  <div
                    className="relative flex flex-col w-full rounded-3xl overflow-hidden"
                    style={{
                      background: plan.is_recommended ? "linear-gradient(145deg, #1E1040 0%, #1A1A2E 60%)" : CARD,
                      border: plan.is_recommended ? `1.5px solid ${P}` : "1px solid rgba(124,58,237,0.18)",
                      boxShadow: plan.is_recommended ? "0 0 0 1px rgba(124,58,237,0.15), 0 24px 60px -16px rgba(124,58,237,0.45)" : "0 4px 24px rgba(0,0,0,0.4)",
                    }}
                  >
                    {plan.is_recommended && (
                      <>
                        <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 40% at 50% -10%, rgba(124,58,237,0.18) 0%, transparent 60%)", pointerEvents: "none" }} />
                        <div className="text-center py-2 text-[10px] font-extrabold uppercase tracking-widest" style={{ background: `linear-gradient(90deg, ${P}, ${PL})`, color: "#fff" }}>
                          {isFr ? "Plus populaire" : "Most popular"}
                        </div>
                      </>
                    )}
                    <div className="flex flex-col flex-1 p-7 relative">
                      <div className="font-bold text-white mb-1" style={{ fontSize: 20 }}>{plan.name}</div>
                      {plan.short_description && <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 20 }}>{plan.short_description}</p>}
                      <div className="flex items-baseline gap-1 mb-5">
                        <span className="font-extrabold text-white" style={{ fontSize: 54, letterSpacing: "-2px", lineHeight: 1 }}>{plan.price.toFixed(0)}</span>
                        <span className="font-bold text-white" style={{ fontSize: 22 }}>$</span>
                        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 500 }}>/mois</span>
                      </div>
                      <div className="h-px mb-5" style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.3), transparent)" }} />
                      <ul className="space-y-2.5 mb-7 flex-1">
                        {plan.features_json.map((f) => (
                          <li key={f} className="flex items-start gap-2.5" style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: plan.is_recommended ? PE : "rgba(124,58,237,0.7)" }} />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Link
                        to="/commander"
                        className="flex items-center justify-center gap-2 font-bold text-white transition-all hover:opacity-90"
                        style={{ height: 52, borderRadius: 999, fontSize: 15, textDecoration: "none", background: plan.is_recommended ? `linear-gradient(135deg, ${P}, ${PL})` : "rgba(124,58,237,0.12)", border: plan.is_recommended ? "none" : "1px solid rgba(124,58,237,0.35)", boxShadow: plan.is_recommended ? "0 8px 24px rgba(124,58,237,0.4)" : "none" }}
                      >
                        {isFr ? "Commander" : "Order"} <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.4 }} className="text-center mt-8">
              <Link to="/internet" style={{ color: PE, fontSize: 15, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = PE)}
              >
                {isFr ? "Voir tous les forfaits" : "View all plans"} <ChevronRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            POURQUOI NIVRA — 4 features
        ════════════════════════════════════════════════════ */}
        <section style={{ background: BG2, paddingTop: 96, paddingBottom: 96, borderTop: "1px solid rgba(124,58,237,0.08)" }}>
          <div className="container mx-auto px-5 sm:px-10 max-w-[1200px]">
            <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-14">
              <span className="nv-badge mb-6 inline-flex">{isFr ? "Pourquoi Nivra" : "Why Nivra"}</span>
              <h2 className="font-extrabold text-white mt-5" style={{ fontSize: "clamp(28px, 4.5vw, 52px)", letterSpacing: "-1.5px" }}>
                {isFr ? "Un ISP qui vous respecte" : "An ISP that respects you"}
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
                  className="group flex gap-5 rounded-2xl p-7 cursor-default"
                  style={{ background: CARD, border: "1px solid rgba(124,58,237,0.15)", transition: "all 0.25s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(124,58,237,0.4)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(124,58,237,0.15)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(124,58,237,0.15)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}>
                    <item.icon className="w-6 h-6" style={{ color: PE }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-2" style={{ fontSize: 17 }}>{item.title}</h3>
                    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14.5, lineHeight: 1.65 }}>{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            TESTIMONIALS
        ════════════════════════════════════════════════════ */}
        <section style={{ background: BG, paddingTop: 96, paddingBottom: 96, borderTop: "1px solid rgba(124,58,237,0.08)" }}>
          <div className="container mx-auto px-5 sm:px-10 max-w-[1200px]">
            <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-14">
              <span className="nv-badge mb-6 inline-flex">
                <Award className="w-3.5 h-3.5" />
                {isFr ? "Avis clients" : "Customer reviews"}
              </span>
              <h2 className="font-extrabold text-white mt-5" style={{ fontSize: "clamp(28px, 4.5vw, 52px)", letterSpacing: "-1.5px" }}>
                {isFr ? "Ils ont choisi Nivra" : "They chose Nivra"}
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
                  style={{ background: CARD, border: "1px solid rgba(124,58,237,0.15)" }}
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.rating }).map((_, s) => (
                      <Star key={s} className="w-4 h-4 fill-current" style={{ color: "#F59E0B" }} />
                    ))}
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 15, lineHeight: 1.7, flex: 1 }}>"{t.quote}"</p>
                  <div>
                    <div className="font-semibold text-white" style={{ fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
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
        <section style={{ background: BG2, paddingTop: 96, paddingBottom: 96, borderTop: "1px solid rgba(124,58,237,0.08)" }}>
          <motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="container mx-auto px-5 sm:px-10 max-w-[900px]">
            <div
              className="rounded-3xl relative overflow-hidden text-center"
              style={{ background: "linear-gradient(135deg, #14082E 0%, #1A0F3A 50%, #0F0920 100%)", border: "1px solid rgba(124,58,237,0.3)", boxShadow: "0 0 120px rgba(124,58,237,0.2), 0 32px 80px rgba(0,0,0,0.6)", padding: "clamp(48px, 8vw, 96px) clamp(24px, 5vw, 72px)" }}
            >
              {/* Orb inside CTA */}
              <div aria-hidden style={{ position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)", width: 600, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse at center, rgba(124,58,237,0.25), transparent 70%)", pointerEvents: "none", filter: "blur(20px)" }} />
              <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
              <div className="relative z-10">
                <span className="nv-badge mb-6 inline-flex">
                  <Clock className="w-3.5 h-3.5" />
                  {isFr ? "Activation en 10 minutes" : "10-minute activation"}
                </span>
                <h2 className="font-extrabold text-white mt-5 mb-4" style={{ fontSize: "clamp(28px, 5vw, 56px)", letterSpacing: "-1.5px", lineHeight: 1.06 }}>
                  {isFr ? "Prêt à passer à Nivra ?" : "Ready to switch to Nivra?"}
                </h2>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 18, lineHeight: 1.65, maxWidth: 480, margin: "0 auto 40px" }}>
                  {isFr ? "Sans contrat, sans technicien, sans surprise. Commandez aujourd'hui." : "No contract, no technician, no surprise. Order today."}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    to="/commander"
                    style={{ height: 58, paddingLeft: 36, paddingRight: 36, background: P, borderRadius: 999, fontSize: 17, fontWeight: 700, color: "#fff", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10, boxShadow: "0 10px 32px rgba(124,58,237,0.55)", transition: "opacity 0.2s, transform 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.92"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "none"; }}
                  >
                    {isFr ? "Commander maintenant" : "Order now"} <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link to="/internet" style={{ height: 58, paddingLeft: 28, paddingRight: 28, border: "1px solid rgba(124,58,237,0.4)", borderRadius: 999, fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.75)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(124,58,237,0.7)"; e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(124,58,237,0.4)"; e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
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
