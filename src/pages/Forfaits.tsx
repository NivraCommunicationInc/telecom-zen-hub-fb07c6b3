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

  const BG = '#080612';
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
      <section style={{ background: 'linear-gradient(160deg, #080612 0%, #11082A 55%, #0C0C18 100%)', paddingTop: 96, paddingBottom: 72, position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div aria-hidden className="absolute pointer-events-none" style={{ top: -160, right: -100, width: 600, height: 600, background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.2) 0%, transparent 65%)' }} />

        <div className="max-w-[1100px] mx-auto px-5 sm:px-10 text-center relative">
          <div className="inline-flex items-center gap-2 mb-6" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 999, padding: '6px 16px' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#A78BFA' }} />
            <span style={{ color: '#C4B5FD', fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
              {isFr ? 'Sans contrat · Prix fixe garanti' : 'No contract · Fixed price guaranteed'}
            </span>
          </div>

          <h1 className="font-black text-white" style={{ fontSize: 'clamp(36px, 5vw, 60px)', letterSpacing: '-2px', lineHeight: 1.05, marginBottom: 16 }}>
            {isFr ? 'Nos forfaits' : 'Our Plans'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, lineHeight: 1.65, maxWidth: 520, margin: '0 auto 40px' }}>
            {isFr
              ? 'Internet et TV sans contrat au Québec — prix fixe garanti, aucune surprise.'
              : 'No-contract Internet and TV in Quebec — guaranteed fixed price, no surprises.'}
          </p>

          <div className="flex flex-wrap justify-center gap-8 sm:gap-16">
            {[
              { val: isFr ? 'Dès 45$/mois' : 'From $45/mo', sub: isFr ? 'taxes incluses' : 'taxes included' },
              { val: isFr ? 'Sans contrat' : 'No contract', sub: isFr ? 'résiliez à tout moment' : 'cancel anytime' },
              { val: '10 min', sub: isFr ? 'activation en ligne' : 'online activation' },
            ].map((s) => (
              <div key={s.val} className="text-center">
                <div className="font-black text-white" style={{ fontSize: 22, letterSpacing: '-0.5px' }}>{s.val}</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 2 }}>{s.sub}</div>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="relative overflow-hidden transition-all duration-200"
                  style={{
                    background: card.popular
                      ? 'linear-gradient(160deg, rgba(124,58,237,0.18) 0%, rgba(124,58,237,0.06) 100%)'
                      : CARD_BG,
                    border: card.popular ? '1.5px solid rgba(124,58,237,0.55)' : `1px solid ${BORDER}`,
                    borderRadius: 20,
                    boxShadow: card.popular ? '0 8px 40px rgba(124,58,237,0.25)' : 'none',
                  }}
                  onMouseEnter={e => { if (!card.popular) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.3)'; }}
                  onMouseLeave={e => { if (!card.popular) (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
                >
                  {card.popular && (
                    <div className="flex items-center justify-center gap-2 font-bold uppercase" style={{ background: PURPLE, color: '#FFFFFF', padding: '9px 0', fontSize: 11, letterSpacing: 1.5 }}>
                      <span>★</span> {isFr ? 'Le plus populaire' : 'Most Popular'}
                    </div>
                  )}

                  <div style={{ padding: '28px 28px 32px' }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
                      {isFr ? 'Forfait' : 'Plan'}
                    </p>
                    <h3 className="font-extrabold text-white" style={{ fontSize: 22, letterSpacing: '-0.5px', marginBottom: 20 }}>
                      {card.title}
                    </h3>

                    <div className="flex items-baseline gap-1" style={{ marginBottom: 4 }}>
                      <span className="font-black text-white" style={{ fontSize: 54, letterSpacing: '-2px', lineHeight: 1 }}>
                        ${card.price}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16 }}>
                        /{isFr ? 'mois' : 'mo'}
                      </span>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 24 }}>
                      {isFr ? 'taxes incluses · prix fixe garanti' : 'taxes included · guaranteed fixed price'}
                    </p>

                    <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 22 }} />

                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {card.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2.5" style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>
                          <div className="shrink-0 flex items-center justify-center" style={{ width: 18, height: 18, borderRadius: 999, background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.4)', marginTop: 1 }}>
                            <Check className="w-2.5 h-2.5" strokeWidth={3} style={{ color: '#A78BFA' }} />
                          </div>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <EquipmentRequiredBox type={activeTab === 'tv' ? 'tv' : activeTab === 'combo' ? 'combo' : 'internet'} />

                    <button
                      onClick={() => navigate(card.link)}
                      className="w-full flex items-center justify-center gap-2 font-bold transition-all duration-200"
                      style={{
                        height: 50, borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14,
                        background: card.popular ? PURPLE : 'rgba(255,255,255,0.08)',
                        color: '#FFFFFF',
                        boxShadow: card.popular ? '0 4px 20px rgba(124,58,237,0.5)' : 'none',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = card.popular ? '#6D28D9' : 'rgba(255,255,255,0.14)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = card.popular ? PURPLE : 'rgba(255,255,255,0.08)'; }}
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
