import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Wifi, Zap, Shield, Headphones, Star, CheckCircle2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";
import SchemaMarkup from "@/components/seo/SchemaMarkup";
import LocalBusinessSchema from "@/components/LocalBusinessSchema";
import HomeStatusBanner from "@/components/HomeStatusBanner";
import LaunchOfferPopup from "@/components/marketing/LaunchOfferPopup";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePublicServices, type PublicService } from "@/hooks/usePublicServices";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.4, 0, 0.2, 1] },
  }),
};

const FALLBACK_PLANS: PublicService[] = [
  {
    id: 'f1', sku: '', name: 'Essentiel', price: 39.99, is_recommended: false,
    category: 'Internet', billing_type: 'monthly', display_order: 1,
    tags: [], badges: [], is_featured: false, promo_eligible: false,
    visible_website: true, visible_simulator: false, visible_checkout: true, visible_portal: true,
    status: 'active', activation_fee_rule: null, installation_fee_rule: null, shipping_fee_rule: null,
    short_description: 'Parfait pour naviguer et streamer',
    description: null,
    features_json: ['100 Mbps symétrique', 'Données illimitées', 'Sans contrat', 'Activation en 10 min'],
  },
  {
    id: 'f2', sku: '', name: 'Performance', price: 59.99, is_recommended: true,
    category: 'Internet', billing_type: 'monthly', display_order: 2,
    tags: [], badges: [], is_featured: true, promo_eligible: false,
    visible_website: true, visible_simulator: false, visible_checkout: true, visible_portal: true,
    status: 'active', activation_fee_rule: null, installation_fee_rule: null, shipping_fee_rule: null,
    short_description: 'Idéal pour toute la famille',
    description: null,
    features_json: ['500 Mbps symétrique', 'Données illimitées', 'Sans contrat', 'Support 24/7'],
  },
  {
    id: 'f3', sku: '', name: 'Ultime', price: 79.99, is_recommended: false,
    category: 'Internet', billing_type: 'monthly', display_order: 3,
    tags: [], badges: [], is_featured: false, promo_eligible: false,
    visible_website: true, visible_simulator: false, visible_checkout: true, visible_portal: true,
    status: 'active', activation_fee_rule: null, installation_fee_rule: null, shipping_fee_rule: null,
    short_description: 'Pour les power users et télétravail',
    description: null,
    features_json: ['1 Gbps symétrique', 'Données illimitées', 'Sans contrat', 'IP fixe incluse'],
  },
];

const WHY_FEATURES = [
  { icon: Zap, title: 'Activation rapide', desc: 'Votre service actif en moins de 10 minutes. Sans technicien, sans rendez-vous.' },
  { icon: Shield, title: 'Sans contrat', desc: 'Résiliez à tout moment, sans frais cachés. Notre qualité parle d\'elle-même.' },
  { icon: Wifi, title: 'Réseau fiable', desc: 'Infrastructure haute disponibilité avec 99,9 % de uptime garanti.' },
  { icon: Headphones, title: 'Support local 24/7', desc: 'Une équipe québécoise disponible à toute heure, toujours prête à aider.' },
];

const TESTIMONIALS = [
  {
    name: 'Marie-Claude B.', city: 'Montréal', rating: 5,
    quote: 'J\'ai changé pour Nivra il y a 6 mois — jamais aussi peu de problèmes avec Internet. Et le service client est vraiment humain.',
  },
  {
    name: 'Jean-François L.', city: 'Laval', rating: 5,
    quote: 'Activation en 8 minutes chrono. Je n\'en revenais pas. Le 500 Mbps tourne parfaitement pour 4 personnes en télétravail.',
  },
  {
    name: 'Sophie T.', city: 'Longueuil', rating: 5,
    quote: 'Prix honnêtes, pas de surprise à la facture, et ils répondent vraiment au téléphone. Rare de nos jours.',
  },
];

const Index = () => {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const { data: servicesData } = usePublicServices({ surface: 'website', categories: ['Internet'] });
  const plans = (servicesData && servicesData.length > 0 ? servicesData.slice(0, 3) : FALLBACK_PLANS);

  return (
    <div className="min-h-screen" style={{ background: '#0a0e1a' }}>
      <SEOHead {...SEO_DATA.home} />
      <LocalBusinessSchema />
      <SchemaMarkup includeBrand={false} includeHomeFaq includeProducts />
      <Header />
      <HomeStatusBanner />

      <main id="main-content" tabIndex={-1}>

        {/* ── 1. HERO ─────────────────────────────────────────── */}
        <section
          aria-label={isFr ? "Accueil" : "Home"}
          className="relative overflow-hidden"
          style={{ background: '#0a0e1a', paddingTop: 'clamp(80px, 10vw, 140px)', paddingBottom: 'clamp(80px, 10vw, 140px)' }}
        >
          <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,102,204,0.22) 0%, transparent 70%)' }} />

          <div className="container mx-auto px-5 sm:px-10 max-w-[1100px] relative text-center">
            <motion.div custom={0} initial="hidden" animate="visible" variants={fadeUp} className="flex justify-center mb-6">
              <span className="nv-badge-blue">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00aaff', flexShrink: 0, display: 'inline-block' }} />
                {isFr ? "Internet · TV · Mobile au Québec" : "Internet · TV · Mobile in Quebec"}
              </span>
            </motion.div>

            <motion.h1
              custom={1}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="font-extrabold text-white"
              style={{ fontSize: 'clamp(36px, 6vw, 72px)', letterSpacing: '-1.5px', lineHeight: 1.08, marginBottom: 24 }}
            >
              {isFr ? (
                <>Internet haute vitesse<br /><span style={{ color: '#00aaff' }}>sans contrat</span> au Québec</>
              ) : (
                <>High-speed Internet<br /><span style={{ color: '#00aaff' }}>no contract</span> in Quebec</>
              )}
            </motion.h1>

            <motion.p
              custom={2}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: '#a8b5cc', lineHeight: 1.65, maxWidth: 560, margin: '0 auto 40px' }}
            >
              {isFr
                ? "Forfaits Internet, TV et mobile flexibles. Activation en 10 minutes. Aucun engagement, aucune surprise."
                : "Flexible Internet, TV and mobile plans. Activated in 10 minutes. No commitment, no surprises."}
            </motion.p>

            <motion.div
              custom={3}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Link
                to="/internet"
                className="inline-flex items-center gap-2 font-bold text-white transition-all hover:opacity-90"
                style={{ height: 54, paddingLeft: 32, paddingRight: 32, background: '#0066CC', borderRadius: 50, fontSize: 15, textDecoration: 'none', boxShadow: '0 8px 24px rgba(0,102,204,0.4)' }}
              >
                {isFr ? "Voir les forfaits" : "See plans"}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/couverture"
                className="inline-flex items-center gap-2 font-semibold transition-all hover:bg-white/10"
                style={{ height: 54, paddingLeft: 28, paddingRight: 28, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 50, fontSize: 15, color: '#a8b5cc', textDecoration: 'none' }}
              >
                {isFr ? "Vérifier ma couverture" : "Check coverage"}
              </Link>
            </motion.div>

            <motion.div
              custom={4}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="flex flex-wrap items-center justify-center gap-8 mt-16"
            >
              {[
                { value: '1 Gbps', label: isFr ? 'Vitesse max' : 'Top speed' },
                { value: '19+', label: isFr ? 'Villes' : 'Cities' },
                { value: '10 min', label: isFr ? 'Activation' : 'Activation' },
                { value: '24/7', label: isFr ? 'Support local' : 'Local support' },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="font-extrabold text-white" style={{ fontSize: 28, letterSpacing: '-0.5px' }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#5a6a85', fontWeight: 500, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── 2. FORFAITS ─────────────────────────────────────── */}
        <section
          aria-label={isFr ? "Forfaits Internet" : "Internet Plans"}
          style={{ background: '#0f1628', paddingTop: 80, paddingBottom: 80, borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="container mx-auto px-5 sm:px-10 max-w-[1100px]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <span className="nv-badge-blue">{isFr ? "Nos forfaits" : "Our plans"}</span>
              <h2 className="font-extrabold text-white mt-5" style={{ fontSize: 'clamp(24px, 4vw, 44px)', letterSpacing: '-1px' }}>
                {isFr ? "Internet sans compromis" : "Internet without compromise"}
              </h2>
              <p style={{ color: '#a8b5cc', fontSize: 17, marginTop: 12 }}>
                {isFr ? "Sans contrat · Données illimitées · Activation immédiate" : "No contract · Unlimited data · Instant activation"}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {plans.map((plan, i) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.1 }}
                  className="relative flex flex-col rounded-2xl overflow-hidden"
                  style={{
                    background: plan.is_recommended ? 'linear-gradient(135deg, #0a1f3d 0%, #0d2a52 100%)' : '#151d35',
                    border: plan.is_recommended ? '1.5px solid rgba(0,102,204,0.5)' : '1px solid rgba(255,255,255,0.07)',
                    boxShadow: plan.is_recommended ? '0 0 40px rgba(0,102,204,0.18)' : 'none',
                  }}
                >
                  {plan.is_recommended && (
                    <div className="text-center py-2 text-xs font-bold uppercase tracking-widest" style={{ background: '#0066CC', color: '#ffffff' }}>
                      {isFr ? "Populaire" : "Popular"}
                    </div>
                  )}
                  <div className="flex flex-col flex-1 p-7">
                    <div className="font-bold text-white mb-1" style={{ fontSize: 18 }}>{plan.name}</div>
                    {plan.short_description && (
                      <p style={{ color: '#5a6a85', fontSize: 13, marginBottom: 20 }}>{plan.short_description}</p>
                    )}
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="font-extrabold text-white" style={{ fontSize: 42, letterSpacing: '-1px' }}>{plan.price.toFixed(0)}$</span>
                      <span style={{ color: '#5a6a85', fontSize: 14 }}>/mo</span>
                    </div>
                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.features_json.map((f) => (
                        <li key={f} className="flex items-center gap-2.5" style={{ fontSize: 14, color: '#a8b5cc' }}>
                          <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: '#00aaff' }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/commander"
                      className="flex items-center justify-center gap-2 font-bold transition-all hover:opacity-90"
                      style={{
                        height: 48, borderRadius: 50, fontSize: 14, textDecoration: 'none',
                        background: plan.is_recommended ? '#0066CC' : 'rgba(0,102,204,0.12)',
                        border: plan.is_recommended ? 'none' : '1px solid rgba(0,102,204,0.35)',
                        color: plan.is_recommended ? '#fff' : '#00aaff',
                      }}
                    >
                      {isFr ? "Choisir ce forfait" : "Choose this plan"}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 3. POURQUOI NIVRA ────────────────────────────────── */}
        <section
          aria-label={isFr ? "Pourquoi Nivra" : "Why Nivra"}
          style={{ background: '#0a0e1a', paddingTop: 80, paddingBottom: 80, borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="container mx-auto px-5 sm:px-10 max-w-[1100px]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <span className="nv-badge-blue">{isFr ? "Pourquoi Nivra" : "Why Nivra"}</span>
              <h2 className="font-extrabold text-white mt-5" style={{ fontSize: 'clamp(24px, 4vw, 44px)', letterSpacing: '-1px' }}>
                {isFr ? "Un ISP qui vous respecte" : "An ISP that respects you"}
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {WHY_FEATURES.map((feat, i) => (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                  className="flex gap-5 rounded-2xl p-7"
                  style={{ background: '#151d35', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,102,204,0.15)', border: '1px solid rgba(0,102,204,0.25)' }}>
                    <feat.icon className="w-6 h-6" style={{ color: '#00aaff' }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-2" style={{ fontSize: 16 }}>{feat.title}</h3>
                    <p style={{ color: '#a8b5cc', fontSize: 14, lineHeight: 1.65 }}>{feat.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 4. TÉMOIGNAGES ──────────────────────────────────── */}
        <section
          aria-label={isFr ? "Témoignages" : "Testimonials"}
          style={{ background: '#0f1628', paddingTop: 80, paddingBottom: 80, borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="container mx-auto px-5 sm:px-10 max-w-[1100px]">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <span className="nv-badge-blue">{isFr ? "Témoignages" : "Testimonials"}</span>
              <h2 className="font-extrabold text-white mt-5" style={{ fontSize: 'clamp(24px, 4vw, 44px)', letterSpacing: '-1px' }}>
                {isFr ? "Ce que disent nos clients" : "What our clients say"}
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {TESTIMONIALS.map((testimonial, i) => (
                <motion.div
                  key={testimonial.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.1 }}
                  className="rounded-2xl p-7 flex flex-col gap-4"
                  style={{ background: '#151d35', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: testimonial.rating }).map((_, s) => (
                      <Star key={s} className="w-4 h-4 fill-current" style={{ color: '#ffb700' }} />
                    ))}
                  </div>
                  <p style={{ color: '#a8b5cc', fontSize: 14, lineHeight: 1.7, flex: 1 }}>"{testimonial.quote}"</p>
                  <div>
                    <div className="font-semibold text-white" style={{ fontSize: 14 }}>{testimonial.name}</div>
                    <div style={{ fontSize: 12, color: '#5a6a85' }}>{testimonial.city}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. CTA FINAL ────────────────────────────────────── */}
        <section
          aria-label="CTA"
          style={{ background: '#0a0e1a', paddingTop: 80, paddingBottom: 80, borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="container mx-auto px-5 sm:px-10 max-w-[860px]"
          >
            <div
              className="rounded-3xl px-8 py-16 relative overflow-hidden text-center"
              style={{ background: 'linear-gradient(135deg, #061233 0%, #0a1d4a 50%, #061233 100%)', border: '1px solid rgba(0,102,204,0.25)', boxShadow: '0 0 80px rgba(0,102,204,0.12)' }}
            >
              <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,102,204,0.2) 0%, transparent 70%)' }} />
              <div className="relative">
                <h2 className="font-extrabold text-white mb-4" style={{ fontSize: 'clamp(26px, 4vw, 48px)', letterSpacing: '-1px' }}>
                  {isFr ? "Prêt à passer à Nivra ?" : "Ready to switch to Nivra?"}
                </h2>
                <p style={{ color: '#a8b5cc', fontSize: 17, marginBottom: 36, lineHeight: 1.65 }}>
                  {isFr
                    ? "Commandez aujourd'hui — activé en 10 minutes, sans contrat, sans technicien."
                    : "Order today — activated in 10 minutes, no contract, no technician."}
                </p>
                <Link
                  to="/commander"
                  className="inline-flex items-center gap-2 font-bold text-white transition-all hover:opacity-90"
                  style={{ height: 56, paddingLeft: 36, paddingRight: 36, background: '#0066CC', borderRadius: 50, fontSize: 16, textDecoration: 'none', boxShadow: '0 8px 28px rgba(0,102,204,0.45)' }}
                >
                  {isFr ? "Commander maintenant" : "Order now"}
                  <ArrowRight className="w-5 h-5" />
                </Link>
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
