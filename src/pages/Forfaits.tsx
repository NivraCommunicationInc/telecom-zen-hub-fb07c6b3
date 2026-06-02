import { useState, useMemo } from "react";
import { Check, Wifi, Tv, Package, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import SEOHead from "@/components/SEOHead";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import { useInternetPlans, useTVPlans } from "@/hooks/usePublicServices";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EquipmentRequiredBox } from "@/components/shared/EquipmentRequiredBox";

type TabKey = "internet" | "tv" | "combo";

const GOLD = "#d4a843";

const Forfaits = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabKey>("internet");
  const [postalCode, setPostalCode] = useState("");
  const [availabilityResult, setAvailabilityResult] = useState<"ok" | "no" | null>(null);

  const { plans: internetPlans, isLoading: loadingInternet } = useInternetPlans(isFr);
  const { standardPlans: tvStandard, gigaPlans: tvGiga, isLoading: loadingTV } = useTVPlans(isFr);

  const isLoading = loadingInternet || loadingTV;

  const tabs: { key: TabKey; label: string; icon: typeof Wifi }[] = [
    { key: "internet", label: "Internet", icon: Wifi },
    { key: "tv", label: isFr ? "Télévision" : "Television", icon: Tv },
    { key: "combo", label: "Internet + TV", icon: Package },
  ];

  const cards = useMemo(() => {
    if (activeTab === "internet") {
      return internetPlans.map((p, i) => ({
        id: p.id,
        title: p.speed,
        price: p.price,
        features: p.features.slice(0, 5),
        popular: p.featured || i === 1,
        link: `/commander?plan=${p.id}`,
      }));
    }
    if (activeTab === "tv") {
      const all = [...tvStandard, ...tvGiga];
      return all.map((p, i) => ({
        id: p.id,
        title: p.name,
        price: p.price,
        features: p.features.slice(0, 5),
        popular: p.featured || i === 1,
        link: `/commander?plan=${p.id}`,
      }));
    }
    const combos = [...tvStandard, ...tvGiga].filter(
      (p) => p.internetSpeed && p.internetSpeed !== "0"
    );
    return combos.map((p, i) => ({
      id: p.id,
      title: `${p.name}`,
      price: p.price,
      features: [
        isFr ? `Internet ${p.internetSpeed} inclus` : `${p.internetSpeed} Internet included`,
        ...p.features.slice(0, 4),
      ],
      popular: p.featured || i === 1,
      link: `/commander?plan=${p.id}`,
    }));
  }, [activeTab, internetPlans, tvStandard, tvGiga, isFr]);

  const handleCheckAvailability = () => {
    const cleaned = postalCode.replace(/\s/g, "").toUpperCase();
    if (/^[GHJ]/i.test(cleaned) && cleaned.length >= 3) {
      setAvailabilityResult("ok");
    } else if (cleaned.length >= 3) {
      setAvailabilityResult("no");
    }
  };

  const BG = '#020209';
  const CARD_BG = 'rgba(255,255,255,0.04)';
  const BORDER = 'rgba(255,255,255,0.08)';
  const PURPLE = '#7C3AED';

  return (
    <div style={{ background: BG, minHeight: '100vh' }}>
      <SEOHead
        title="Forfaits Internet et TV sans contrat au Québec | Nivra Telecom"
        description="Comparez nos forfaits Internet haute vitesse et TV sans contrat au Québec. Prix fixes garantis, sans engagement. Activation rapide."
      />
      <Header />

      {/* ── Hero ── */}
      <section style={{ paddingTop: 100, paddingBottom: 72, position: 'relative', overflow: 'hidden', background: '#020209' }}>
        {/* Aurora */}
        <div aria-hidden style={{ position: 'absolute', top: '-20%', right: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.3) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.15) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
        {/* Grid */}
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
        {/* Scan line */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), rgba(6,182,212,0.5), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />

        <div className="max-w-[1100px] mx-auto px-5 sm:px-10 text-center relative">
          <div className="n-animate-in inline-flex items-center gap-2.5 mb-8" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 999, padding: '7px 18px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#06B6D4', display: 'inline-block', boxShadow: '0 0 8px #06B6D4' }} />
            <span style={{ color: '#67E8F9', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
              {isFr ? 'Sans contrat · Prix fixe garanti' : 'No contract · Fixed price guaranteed'}
            </span>
          </div>

          <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(42px, 6vw, 72px)', letterSpacing: '-2.5px', lineHeight: 1.0, marginBottom: 16, color: '#fff' }}>
            {isFr ? (
              <><span style={{ color: '#fff' }}>Nos </span><span className="n-shimmer-text">forfaits</span></>
            ) : (
              <><span style={{ color: '#fff' }}>Our </span><span className="n-shimmer-text">plans</span></>
            )}
          </h1>
          <p className="n-animate-in-delay-2" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, lineHeight: 1.7, maxWidth: 520, margin: '0 auto 48px' }}>
            {isFr
              ? 'Internet et TV sans contrat au Québec — prix fixe garanti, aucune surprise.'
              : 'No-contract Internet and TV in Quebec — guaranteed fixed price, no surprises.'}
          </p>

          <div className="n-animate-in-delay-3 flex flex-wrap justify-center gap-4">
            {[
              { val: isFr ? 'Dès 45$/mois' : 'From $45/mo', sub: isFr ? 'taxes incluses' : 'taxes included', color: '#A78BFA' },
              { val: isFr ? 'Sans contrat' : 'No contract', sub: isFr ? 'résiliez à tout moment' : 'cancel anytime', color: '#06B6D4' },
              { val: '10 min', sub: isFr ? 'activation en ligne' : 'online activation', color: '#10B981' },
            ].map((s) => (
              <div key={s.val} className="text-center px-6 py-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, backdropFilter: 'blur(12px)' }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px', color: s.color }}>{s.val}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 3, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Main Content ── */}
      <main style={{ background: BG, paddingBottom: 80 }}>
        <div className="max-w-[1100px] mx-auto px-5 sm:px-10">

          {/* Tabs */}
          <div className="flex justify-center" style={{ padding: '44px 0 36px' }}>
            <div className="flex w-full sm:w-auto" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 5, border: `1px solid ${BORDER}` }}>
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 transition-all duration-200"
                  style={{
                    padding: '10px 22px', borderRadius: 10,
                    fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: activeTab === tab.key ? PURPLE : 'transparent',
                    color: activeTab === tab.key ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                    boxShadow: activeTab === tab.key ? '0 4px 16px rgba(124,58,237,0.45)' : 'none',
                  }}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Availability checker */}
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '24px 32px', marginBottom: 52, maxWidth: 580, marginLeft: 'auto', marginRight: 'auto' }}>
            <h3 className="font-bold text-white text-center" style={{ fontSize: 15, marginBottom: 14 }}>
              {isFr ? 'Vérifiez la disponibilité à votre adresse' : 'Check availability at your address'}
            </h3>
            <div className="flex gap-3 max-w-md mx-auto">
              <Input
                type="text"
                placeholder={isFr ? 'Code postal (ex: H2X 1Y4)' : 'Postal code (e.g. H2X 1Y4)'}
                value={postalCode}
                onChange={(e) => { setPostalCode(e.target.value); setAvailabilityResult(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleCheckAvailability()}
                className="flex-1"
                style={{ height: 50 }}
              />
              <Button onClick={handleCheckAvailability} className="shrink-0 font-bold" style={{ height: 50, background: PURPLE }}>
                {isFr ? 'Vérifier' : 'Check'}
              </Button>
            </div>
            {availabilityResult === 'ok' && (
              <p className="text-center font-medium" style={{ color: '#34D399', fontSize: 13, marginTop: 12 }}>
                ✓ {isFr ? 'Excellente nouvelle ! Le service est disponible dans votre région.' : 'Great news! Service is available in your area.'}
              </p>
            )}
            {availabilityResult === 'no' && (
              <p className="text-center" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 12 }}>
                {isFr ? 'Service actuellement limité au Québec. Contactez-nous pour plus d\'informations.' : 'Service currently limited to Quebec. Contact us for more information.'}
              </p>
            )}
            <p className="text-center" style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
              {isFr ? 'Service disponible dans la majorité des régions du Québec' : 'Available in most Quebec regions'}
            </p>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: PURPLE }} />
            </div>
          )}

          {/* Plan cards */}
          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="relative overflow-hidden"
                  style={{
                    background: card.popular
                      ? 'linear-gradient(160deg, rgba(124,58,237,0.2) 0%, rgba(124,58,237,0.06) 100%)'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                    border: card.popular ? '1px solid rgba(124,58,237,0.55)' : '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 24,
                    backdropFilter: 'blur(24px)',
                    boxShadow: card.popular
                      ? '0 0 0 1px rgba(124,58,237,0.3), 0 20px 60px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.08)'
                      : '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
                    transition: 'transform .25s, box-shadow .25s, border-color .25s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                    if (!card.popular) {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.4)';
                      (e.currentTarget as HTMLElement).style.boxShadow = '0 30px 80px rgba(124,58,237,0.2), inset 0 1px 0 rgba(255,255,255,0.08)';
                    }
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLElement).style.borderColor = card.popular ? 'rgba(124,58,237,0.55)' : 'rgba(255,255,255,0.09)';
                    (e.currentTarget as HTMLElement).style.boxShadow = card.popular
                      ? '0 0 0 1px rgba(124,58,237,0.3), 0 20px 60px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.08)'
                      : '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)';
                  }}
                >
                  {/* Popular badge */}
                  {card.popular && (
                    <div style={{ position: 'relative', overflow: 'hidden' }}>
                      <div className="flex items-center justify-center gap-2 font-bold uppercase" style={{ background: 'linear-gradient(90deg, #7C3AED, #6D28D9)', color: '#FFFFFF', padding: '10px 0', fontSize: 10, letterSpacing: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
                        {isFr ? 'PLUS POPULAIRE' : 'MOST POPULAR'}
                      </div>
                      {/* Beam */}
                      <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '30%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', animation: 'n-beam-h 3s ease-in-out infinite' }} />
                    </div>
                  )}

                  <div style={{ padding: '28px 28px 32px' }}>
                    <p className="n-label" style={{ marginBottom: 8 }}>
                      {isFr ? 'Forfait Nivra' : 'Nivra Plan'}
                    </p>
                    <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px', marginBottom: 24, color: '#fff' }}>
                      {card.title}
                    </h3>

                    <div className="flex items-baseline gap-1" style={{ marginBottom: 4 }}>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 56, letterSpacing: '-2.5px', lineHeight: 1, color: '#FFFFFF' }}>
                        ${card.price}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>
                        /{isFr ? 'mois' : 'mo'}
                      </span>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginBottom: 24, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>
                      {isFr ? 'TAXES INCLUSES · PRIX FIXE' : 'TAX INCLUDED · FIXED PRICE'}
                    </p>

                    <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(124,58,237,0.3), rgba(6,182,212,0.2), transparent)', marginBottom: 22 }} />

                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                      {card.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2.5" style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.78)' }}>
                          <div className="shrink-0 flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: 999, background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.45)', marginTop: 1 }}>
                            <Check className="w-2.5 h-2.5" strokeWidth={3} style={{ color: '#A78BFA' }} />
                          </div>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <EquipmentRequiredBox type={activeTab === 'tv' ? 'tv' : activeTab === 'combo' ? 'combo' : 'internet'} />

                    <button
                      onClick={() => navigate(card.link)}
                      className="w-full flex items-center justify-center gap-2 font-bold"
                      style={{
                        height: 52, borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14,
                        fontFamily: "'Space Grotesk', sans-serif",
                        background: card.popular
                          ? 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)'
                          : 'rgba(255,255,255,0.08)',
                        color: '#FFFFFF',
                        boxShadow: card.popular ? '0 8px 32px rgba(124,58,237,0.5)' : 'none',
                        transition: 'box-shadow .2s, background .2s, transform .15s',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = card.popular ? 'linear-gradient(135deg, #6D28D9 0%, #5B21B6 100%)' : 'rgba(255,255,255,0.14)';
                        el.style.boxShadow = card.popular ? '0 12px 40px rgba(124,58,237,0.65)' : 'none';
                        el.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = card.popular ? 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)' : 'rgba(255,255,255,0.08)';
                        el.style.boxShadow = card.popular ? '0 8px 32px rgba(124,58,237,0.5)' : 'none';
                        el.style.transform = 'translateY(0)';
                      }}
                    >
                      {isFr ? 'Choisir ce forfait' : 'Choose this plan'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {cards.length === 0 && (
                <div className="col-span-full text-center py-12" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {isFr ? 'Aucun forfait disponible pour cette catégorie.' : 'No plans available for this category.'}
                </div>
              )}
            </div>
          )}

          {/* Trust strip */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 48, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32, marginBottom: 48 }}>
            {[
              { title: isFr ? 'Premier mois GRATUIT' : 'First month FREE', sub: isFr ? 'Offre de bienvenue' : 'Welcome offer' },
              { title: isFr ? 'Satisfait ou remboursé' : 'Money-back guarantee', sub: isFr ? '30 jours' : '30 days' },
              { title: isFr ? 'Aucuns frais cachés' : 'No hidden fees', sub: isFr ? 'Prix affiché = prix réel' : 'Listed price = real price' },
              { title: isFr ? 'Support 7j/7' : '7-day support', sub: isFr ? '8h–20h en français' : '8am–8pm in French' },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <div className="font-bold text-white" style={{ fontSize: 15, marginBottom: 4 }}>{item.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{item.sub}</div>
              </div>
            ))}
          </div>

          <LegalDisclaimer />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Forfaits;
