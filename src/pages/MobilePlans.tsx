import { useMemo, useEffect, useRef } from "react";
import { trackLiveActivity } from "@/hooks/useLiveActivityTracker";
import { Smartphone, Check, Shield, Zap, ArrowRight, Phone, MessageSquare, Globe, Wifi, CreditCard, Loader2 } from "lucide-react";
import { EquipmentRequiredBox } from "@/components/shared/EquipmentRequiredBox";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MobileInfoBox } from "@/components/ServiceInfoBox";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";
import { useMobilePlans, useEquipmentPrices } from "@/hooks/usePublicServices";
import { useAutoTranslatePlans } from "@/hooks/useAutoTranslatePlans";
import { ProductSchema, BreadcrumbSchema, type ProductSchemaItem } from "@/components/seo";

const BG = '#020209';
const PURPLE = '#7C3AED';
const CYAN = '#06B6D4';

const MobilePlans = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isFrench = language === 'fr';

  const planViewTracked = useRef(false);
  useEffect(() => {
    if (planViewTracked.current) return;
    planViewTracked.current = true;
    trackLiveActivity("plan_view", "Consultation: Forfaits Mobile", { metadata: { category: "mobile" } });
  }, []);

  const { plans: rawPlans, isLoading: isLoadingPlans } = useMobilePlans(isFrench);
  const { plans } = useAutoTranslatePlans(rawPlans);
  const { simPrice, esimPrice, isLoading: isLoadingEquipment } = useEquipmentPrices();
  const isLoading = isLoadingPlans || isLoadingEquipment;

  const productSchemaItems: ProductSchemaItem[] = useMemo(() =>
    plans.map((plan) => ({
      name: plan.name,
      description: `${plan.description} - ${plan.dataAutoTopUp} avec Auto Top-Up, ${plan.dataNoAutoTopUp} sans Auto Top-Up. Inclut: ${plan.features.join(", ")}`,
      price: plan.price,
      priceCurrency: "CAD",
      sku: `mobile-${plan.price}`,
      category: "Mobile Prepaid Plans",
      features: plan.features,
      url: "https://nivra-telecom.ca/mobile",
      availability: "InStock",
    })),
    [plans]
  );

  const handleGetStarted = (planId: string) => {
    trackLiveActivity("add_to_cart", `Ajout: ${planId}`, { metadata: { planId, category: "mobile" } });
    navigate(`/commander?plan=${planId}`);
  };

  return (
    <div style={{ background: BG, minHeight: '100vh' }} data-testid="mobile-plans-page">
      <SEOHead {...SEO_DATA.mobile} />
      <ProductSchema products={productSchemaItems} isService={true} />
      <BreadcrumbSchema items={[
        { name: "Accueil", url: "https://nivra-telecom.ca/" },
        { name: "Services", url: "https://nivra-telecom.ca/services" },
        { name: "Forfaits Mobile" }
      ]} />
      <Header />

      {/* ── Hero ── */}
      <section style={{ paddingTop: 110, paddingBottom: 72, position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', top: '-20%', right: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.22) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.18) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.5), rgba(124,58,237,0.5), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />

        <div className="max-w-[1100px] mx-auto px-5 sm:px-10 text-center relative">
          <div className="n-animate-in inline-flex items-center gap-2.5 mb-8" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 999, padding: '7px 18px' }}>
            <Smartphone className="w-3.5 h-3.5" style={{ color: '#67E8F9' }} />
            <span style={{ color: '#67E8F9', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
              Nivra Communications · {isFrench ? 'Mobile prépayé' : 'Prepaid Mobile'}
            </span>
          </div>

          <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(42px, 6vw, 72px)', letterSpacing: '-2.5px', lineHeight: 1.0, marginBottom: 16, color: '#fff' }}>
            {isFrench ? (
              <><span>Forfaits </span><span className="n-shimmer-text">Mobile</span><span> 4G</span></>
            ) : (
              <><span>4G </span><span className="n-shimmer-text">Mobile</span><span> Plans</span></>
            )}
          </h1>

          <p className="n-animate-in-delay-2" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, lineHeight: 1.7, maxWidth: 560, margin: '0 auto 48px' }}>
            {isFrench
              ? "Forfaits mobiles prépayés avec données 4G généreuses. Aucune vérification de crédit — seulement une pièce d'identité gouvernementale."
              : "Prepaid mobile plans with generous 4G data. No credit check required — only government ID needed."}
          </p>

          <div className="n-animate-in-delay-3 flex flex-wrap justify-center gap-4">
            {[
              { val: isFrench ? 'Sans crédit' : 'No credit check', sub: isFrench ? 'accès universel' : 'universal access', color: '#10B981' },
              { val: `${simPrice}$`, sub: isFrench ? 'frais SIM unique' : 'one-time SIM fee', color: '#F59E0B' },
              { val: isFrench ? 'Canada 4G' : '4G Canada', sub: isFrench ? 'couverture nationale' : 'national coverage', color: CYAN },
              { val: isFrench ? 'Textos mondiaux' : 'Global SMS', sub: isFrench ? 'inclus sans frais' : 'included free', color: '#A78BFA' },
            ].map((s) => (
              <div key={s.val} className="text-center px-5 py-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, backdropFilter: 'blur(12px)' }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px', color: s.color }}>{s.val}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 3, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main style={{ paddingBottom: 80 }}>
        <div className="max-w-[1100px] mx-auto px-5 sm:px-10">

          {/* ── Plans heading ── */}
          <div className="text-center mb-10">
            <p className="n-label" style={{ marginBottom: 12 }}>{isFrench ? 'Nos forfaits' : 'Our plans'}</p>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-1.5px', color: '#fff', marginBottom: 8 }}>
              {isFrench ? 'Forfaits Mobile Prépayé' : 'Prepaid Mobile Plans'}
            </h2>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex justify-center items-center py-16 gap-3">
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: PURPLE }} />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                {isFrench ? 'Chargement des forfaits...' : 'Loading plans...'}
              </span>
            </div>
          )}

          {/* ── Plan cards ── */}
          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-16">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="relative overflow-hidden"
                  style={{
                    background: plan.featured
                      ? 'linear-gradient(160deg, rgba(6,182,212,0.18) 0%, rgba(124,58,237,0.08) 100%)'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                    border: plan.featured ? '1px solid rgba(6,182,212,0.5)' : '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 24,
                    backdropFilter: 'blur(24px)',
                    boxShadow: plan.featured
                      ? '0 0 0 1px rgba(6,182,212,0.2), 0 20px 60px rgba(6,182,212,0.2), inset 0 1px 0 rgba(255,255,255,0.08)'
                      : '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
                    transition: 'transform .25s, box-shadow .25s, border-color .25s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                    if (!plan.featured) {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(6,182,212,0.35)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 30px 80px rgba(6,182,212,0.15), inset 0 1px 0 rgba(255,255,255,0.08)';
                    }
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLElement).style.borderColor = plan.featured ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.09)';
                    (e.currentTarget as HTMLElement).style.boxShadow = plan.featured
                      ? '0 0 0 1px rgba(6,182,212,0.2), 0 20px 60px rgba(6,182,212,0.2), inset 0 1px 0 rgba(255,255,255,0.08)'
                      : '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)';
                  }}
                  onClick={() => handleGetStarted(plan.id)}
                >
                  {plan.featured && plan.badge && (
                    <div style={{ position: 'relative', overflow: 'hidden' }}>
                      <div className="flex items-center justify-center gap-2 font-bold uppercase" style={{ background: 'linear-gradient(90deg, #0891B2, #06B6D4)', color: '#FFFFFF', padding: '10px 0', fontSize: 10, letterSpacing: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
                        {plan.badge}
                      </div>
                      <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '30%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', animation: 'n-beam-h 3s ease-in-out infinite' }} />
                    </div>
                  )}

                  <div style={{ padding: '28px 28px 32px' }}>
                    <p className="n-label" style={{ marginBottom: 8 }}>
                      {isFrench ? 'Forfait Mobile · 30 jours' : 'Mobile Plan · 30 days'}
                    </p>
                    <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px', marginBottom: 24, color: '#fff' }}>
                      {plan.name}
                    </h3>

                    <div className="flex items-baseline gap-1" style={{ marginBottom: 4 }}>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 56, letterSpacing: '-2.5px', lineHeight: 1, color: '#FFFFFF' }}>
                        ${plan.price}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>
                        /{isFrench ? '30 jours' : '30 days'}
                      </span>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginBottom: 24, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>
                      {isFrench ? 'TAXES INCLUSES · PRÉPAYÉ' : 'TAX INCLUDED · PREPAID'}
                    </p>

                    {/* Data summary */}
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4" style={{ color: '#10B981' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                            {isFrench ? 'Avec Auto Top-Up' : 'With Auto Top-Up'}
                          </span>
                        </div>
                        <span style={{ background: 'rgba(16,185,129,0.15)', color: '#6EE7B7', borderRadius: 50, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                          {plan.dataAutoTopUp}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wifi className="w-4 h-4" style={{ color: '#60A5FA' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                            {isFrench ? 'Sans Auto Top-Up' : 'No Auto Top-Up'}
                          </span>
                        </div>
                        <span style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD', borderRadius: 50, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                          {plan.dataNoAutoTopUp}
                        </span>
                      </div>
                    </div>

                    <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(6,182,212,0.3), rgba(124,58,237,0.2), transparent)', marginBottom: 22 }} />

                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                      {plan.features.slice(0, 5).map((f, i) => (
                        <li key={i} className="flex items-start gap-2.5" style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.78)' }}>
                          <div className="shrink-0 flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: 999, background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.4)', marginTop: 1 }}>
                            <Check className="w-2.5 h-2.5" strokeWidth={3} style={{ color: '#67E8F9' }} />
                          </div>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <EquipmentRequiredBox type="mobile" />

                    <button
                      onClick={(e) => { e.stopPropagation(); handleGetStarted(plan.id); }}
                      className="w-full flex items-center justify-center gap-2 font-bold"
                      style={{
                        height: 52, borderRadius: 12, border: 'none', cursor: 'pointer',
                        fontSize: 14, fontFamily: "'Space Grotesk', sans-serif",
                        background: plan.featured ? 'linear-gradient(135deg, #0891B2 0%, #06B6D4 100%)' : 'rgba(255,255,255,0.08)',
                        color: '#FFFFFF',
                        boxShadow: plan.featured ? '0 8px 32px rgba(6,182,212,0.4)' : 'none',
                        transition: 'box-shadow .2s, background .2s, transform .15s',
                        marginTop: 4,
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = plan.featured ? 'linear-gradient(135deg, #0E7490 0%, #0891B2 100%)' : 'rgba(255,255,255,0.14)';
                        el.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = plan.featured ? 'linear-gradient(135deg, #0891B2 0%, #06B6D4 100%)' : 'rgba(255,255,255,0.08)';
                        el.style.transform = 'translateY(0)';
                      }}
                    >
                      {isFrench ? 'Commander ce forfait' : 'Order this plan'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SIM Fee notice ── */}
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 16, padding: '24px 28px', marginBottom: 48, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <CreditCard className="w-6 h-6" style={{ color: '#F59E0B' }} />
              </div>
              <div>
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 6 }}>
                  {isFrench ? `Frais de carte SIM — ${simPrice}$` : `SIM Card Fee — $${simPrice}`}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.6 }}>
                  {isFrench
                    ? `Un frais unique de ${simPrice}$ est appliqué pour chaque nouveau numéro ou transfert. Ce frais inclut votre carte SIM ou eSIM (${esimPrice}$) et l'activation.`
                    : `A one-time fee of $${simPrice} is applied for each new number or transfer. This fee includes your SIM or eSIM ($${esimPrice}) card and activation.`}
                </p>
              </div>
            </div>
          </div>

          {/* ── Why Nivra Mobile ── */}
          <div className="mb-16">
            <div className="text-center mb-10">
              <p className="n-label" style={{ marginBottom: 12 }}>{isFrench ? 'Nos avantages' : 'Our advantages'}</p>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(24px, 3vw, 36px)', letterSpacing: '-1px', color: '#fff' }}>
                {isFrench ? 'Pourquoi choisir Nivra Mobile?' : 'Why Choose Nivra Mobile?'}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  icon: <Shield className="w-6 h-6" strokeWidth={2} style={{ color: '#10B981' }} />,
                  iconBg: 'rgba(16,185,129,0.12)', iconBorder: 'rgba(16,185,129,0.3)',
                  title: isFrench ? 'Aucune vérification de crédit' : 'No Credit Check',
                  desc: isFrench ? 'Obtenez votre forfait mobile sans impact sur votre dossier de crédit.' : 'Get your mobile plan without impacting your credit score.',
                },
                {
                  icon: <Globe className="w-6 h-6" strokeWidth={2} style={{ color: CYAN }} />,
                  iconBg: 'rgba(6,182,212,0.12)', iconBorder: 'rgba(6,182,212,0.3)',
                  title: isFrench ? 'Couverture nationale 4G' : 'Nationwide 4G Coverage',
                  desc: isFrench ? 'Profitez d\'une couverture 4G partout au Canada.' : 'Enjoy 4G coverage across Canada.',
                },
                {
                  icon: <MessageSquare className="w-6 h-6" strokeWidth={2} style={{ color: '#A78BFA' }} />,
                  iconBg: 'rgba(124,58,237,0.12)', iconBorder: 'rgba(124,58,237,0.3)',
                  title: isFrench ? 'Textos internationaux' : 'International Texts',
                  desc: isFrench ? 'Envoyez des textos et MMS partout dans le monde sans frais.' : 'Send texts and MMS worldwide at no extra cost.',
                },
              ].map((item) => (
                <div key={item.title} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 24px', backdropFilter: 'blur(12px)', textAlign: 'center' }}>
                  <div className="flex items-center justify-center mx-auto mb-4" style={{ width: 52, height: 52, borderRadius: 14, background: item.iconBg, border: `1px solid ${item.iconBorder}` }}>
                    {item.icon}
                  </div>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 8 }}>{item.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Info Box ── */}
          <div className="mb-12 max-w-3xl mx-auto">
            <MobileInfoBox isFrench={isFrench} />
          </div>

          {/* ── CTA ── */}
          <div style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(124,58,237,0.08) 100%)', border: '1px solid rgba(6,182,212,0.25)', borderRadius: 24, padding: '56px 40px', textAlign: 'center', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 300, background: 'radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(24px, 3vw, 36px)', letterSpacing: '-1.5px', color: '#fff', marginBottom: 12 }}>
                {isFrench ? 'Prêt à vous connecter?' : 'Ready to Get Connected?'}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, marginBottom: 32, maxWidth: 440, margin: '0 auto 32px' }}>
                {isFrench ? 'Commandez votre forfait mobile maintenant et soyez connecté en quelques minutes.' : 'Order your mobile plan now and be connected in minutes.'}
              </p>
              <button
                onClick={() => navigate('/commander')}
                className="inline-flex items-center gap-2 font-bold"
                style={{ height: 52, paddingLeft: 32, paddingRight: 32, borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", background: 'linear-gradient(135deg, #0891B2 0%, #06B6D4 100%)', color: '#fff', boxShadow: '0 8px 32px rgba(6,182,212,0.4)', transition: 'transform .15s, box-shadow .15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 14px 40px rgba(6,182,212,0.5)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(6,182,212,0.4)'; }}
              >
                {isFrench ? 'Commander maintenant' : 'Order Now'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MobilePlans;
