import { useState, useEffect, useRef } from "react";
import { trackLiveActivity } from "@/hooks/useLiveActivityTracker";
import { PhotoBg } from "@/components/PhotoBg";
import { Tv, Check, MapPin, Shield, ArrowRight, AlertTriangle, Router, Monitor, Wifi, Package, Zap, Loader2 } from "lucide-react";
import { EquipmentRequiredBox } from "@/components/shared/EquipmentRequiredBox";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { TVInfoBox } from "@/components/ServiceInfoBox";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";
import { useTVPlans, useEquipmentPrices } from "@/hooks/usePublicServices";
import { useAutoTranslatePlans } from "@/hooks/useAutoTranslatePlans";
import CriticalInfoSummary from "@/components/CriticalInfoSummary";

const BG = '#020209';
const PURPLE = '#7C3AED';

const TVPlans = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isFrench = language === 'fr';

  const [addressText, setAddressText] = useState("");
  const [addressDetails, setAddressDetails] = useState<AddressValue | null>(null);
  const [addressValidated, setAddressValidated] = useState(false);
  const [addressError, setAddressError] = useState("");

  const planViewTracked = useRef(false);
  useEffect(() => {
    if (planViewTracked.current) return;
    planViewTracked.current = true;
    trackLiveActivity("plan_view", "Consultation: Forfaits TV", { metadata: { category: "tv" } });
  }, []);

  const { standardPlans: rawStandard, gigaPlans: rawGiga, isLoading: isLoadingPlans } = useTVPlans(isFrench);
  const { plans: standardPlans } = useAutoTranslatePlans(rawStandard);
  const { plans: gigaPlans } = useAutoTranslatePlans(rawGiga);
  const { terminalPrice, isLoading: isLoadingEquipment } = useEquipmentPrices();
  const isLoading = isLoadingPlans || isLoadingEquipment;

  const handleAddressSelect = (details: AddressValue) => {
    setAddressDetails(details);
    const postalCode = details.postalCode || "";
    const region = details.region || "";
    const isQuebec = /^[GHJ]/i.test(postalCode) || region.toUpperCase() === "QC";
    if (isQuebec) {
      setAddressValidated(true);
      setAddressError("");
    } else {
      setAddressValidated(false);
      setAddressError(
        isFrench
          ? "Service disponible uniquement au Québec. Veuillez entrer une adresse québécoise valide."
          : "Service available only in Quebec. Please enter a valid Quebec address."
      );
    }
  };

  const handleGetStarted = (planId: string) => {
    trackLiveActivity("add_to_cart", `Ajout: ${planId}`, { metadata: { planId, category: "tv" } });
    navigate(`/commander?plan=${planId}`);
  };

  const PlanCard = ({ plan, isGiga = false }: { plan: typeof standardPlans[0]; isGiga?: boolean }) => {
    const choicesMatch = plan.name.match(/(\d+)\s*choix/i);
    const choices = choicesMatch ? parseInt(choicesMatch[1]) : 0;
    const isBase = plan.name.toLowerCase().includes("la base");
    const baseExamples = isFrench
      ? ['TVA', 'ICI Radio-Canada', 'Noovo', 'Télé-Québec', 'CTV Montréal']
      : ['TVA', 'ICI Radio-Canada', 'Noovo', 'Télé-Québec', 'CTV Montreal'];

    return (
      <div
        className="relative overflow-hidden flex flex-col"
        style={{
          background: plan.featured
            ? 'linear-gradient(160deg, rgba(124,58,237,0.22) 0%, rgba(124,58,237,0.07) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
          border: plan.featured ? '1px solid rgba(124,58,237,0.55)' : '1px solid rgba(255,255,255,0.09)',
          borderRadius: 24,
          backdropFilter: 'blur(24px)',
          boxShadow: plan.featured
            ? '0 0 0 1px rgba(124,58,237,0.3), 0 20px 60px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.08)'
            : '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
          transition: 'transform .25s, box-shadow .25s, border-color .25s',
          cursor: addressValidated ? 'pointer' : 'default',
          opacity: addressValidated ? 1 : 0.6,
        }}
        onMouseEnter={e => {
          if (!addressValidated) return;
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
          if (!plan.featured) {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.4)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 30px 80px rgba(124,58,237,0.2), inset 0 1px 0 rgba(255,255,255,0.08)';
          }
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLElement).style.borderColor = plan.featured ? 'rgba(124,58,237,0.55)' : 'rgba(255,255,255,0.09)';
          (e.currentTarget as HTMLElement).style.boxShadow = plan.featured
            ? '0 0 0 1px rgba(124,58,237,0.3), 0 20px 60px rgba(124,58,237,0.3), inset 0 1px 0 rgba(255,255,255,0.08)'
            : '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)';
        }}
        onClick={() => addressValidated && handleGetStarted(plan.id)}
      >
        {/* PRIX À VIE banner — all cards */}
        <div style={{ position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <div className="flex items-center justify-center gap-2 font-bold uppercase" style={{
            background: plan.featured
              ? 'linear-gradient(90deg, #7C3AED, #6D28D9)'
              : 'linear-gradient(90deg, rgba(124,58,237,0.55), rgba(109,40,217,0.55))',
            color: '#FFFFFF', padding: '9px 0', fontSize: 10, letterSpacing: 2,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
            {isFrench ? 'PRIX À VIE GARANTI' : 'PRICE LOCKED FOR LIFE'}
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
          </div>
          <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '30%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)', animation: 'n-beam-h 4s ease-in-out infinite' }} />
        </div>

        <div style={{ padding: '22px 24px 26px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Label + Name */}
          <p className="n-label" style={{ marginBottom: 6, fontSize: 10 }}>
            {isGiga ? (isFrench ? 'FORFAIT GIGA · TV + INTERNET' : 'GIGA PLAN · TV + INTERNET') : (isFrench ? 'FORFAIT TV + INTERNET' : 'TV + INTERNET PLAN')}
          </p>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '-0.4px', marginBottom: 18, color: '#fff', lineHeight: 1.25 }}>
            {plan.name}
          </h3>

          {/* ── TÉLÉ section ── */}
          <div style={{ background: 'rgba(124,58,237,0.09)', border: '1px solid rgba(124,58,237,0.22)', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
              <Tv className="w-3 h-3 flex-shrink-0" style={{ color: '#A78BFA' }} />
              <span style={{ color: '#A78BFA', fontSize: 9.5, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
                {isFrench ? 'TÉLÉ' : 'TV'}
              </span>
            </div>

            {/* Big channel count */}
            <div className="flex items-baseline gap-1.5" style={{ marginBottom: 8 }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 44, letterSpacing: '-2px', lineHeight: 1, color: '#fff' }}>{plan.channels}</span>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: 500 }}>{isFrench ? 'chaînes' : 'channels'}</span>
            </div>

            {/* Breakdown pills */}
            {isBase ? (
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12.5, marginBottom: 10 }}>
                {isFrench ? '24 chaînes La Base' : '24 Base channels'}
              </p>
            ) : (
              <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 10 }}>
                <span style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 999, padding: '2px 10px', fontSize: 11.5, color: '#C4B5FD', fontWeight: 600 }}>
                  24 {isFrench ? 'La Base' : 'Base'}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, fontWeight: 700 }}>+</span>
                <span style={{ background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 999, padding: '2px 10px', fontSize: 11.5, color: '#6EE7B7', fontWeight: 600 }}>
                  {choices} {isFrench ? 'au choix' : 'of your choice'}
                </span>
              </div>
            )}

            {/* Example base channels */}
            <div className="flex flex-wrap gap-1.5">
              {baseExamples.map(ch => (
                <span key={ch} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 6, padding: '2px 7px', fontSize: 10.5, color: 'rgba(255,255,255,0.5)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {ch}
                </span>
              ))}
              {choices > 0 && (
                <span style={{ borderRadius: 6, padding: '2px 7px', fontSize: 10.5, color: 'rgba(110,231,183,0.6)', fontFamily: "'JetBrains Mono', monospace" }}>
                  +{choices} {isFrench ? 'de votre choix' : 'of your choice'}
                </span>
              )}
            </div>
          </div>

          {/* ── INTERNET section ── */}
          <div style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 18 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
              <Wifi className="w-3 h-3 flex-shrink-0" style={{ color: '#67E8F9' }} />
              <span style={{ color: '#67E8F9', fontSize: 9.5, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>INTERNET</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: '#fff', letterSpacing: '-0.4px' }}>{plan.internetSpeed}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 }}>{isFrench ? 'Données illimitées incluses' : 'Unlimited data included'}</p>
              </div>
              {isGiga && <Zap className="w-5 h-5 flex-shrink-0" style={{ color: '#F59E0B' }} />}
            </div>
          </div>

          {/* Price */}
          <div style={{ marginBottom: 4 }}>
            <div className="flex items-baseline gap-1">
              {plan.previousPrice && (
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 20, textDecoration: 'line-through', marginRight: 4 }}>${plan.previousPrice}</span>
              )}
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 50, letterSpacing: '-2.5px', lineHeight: 1, color: '#FFFFFF' }}>${plan.price}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>/{isFrench ? 'mois' : 'mo'}</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, marginTop: 3 }}>
              {isFrench ? 'TAXES INCLUSES · PRIX À VIE' : 'TAX INCLUDED · PRICE FOR LIFE'}
            </p>
          </div>

          <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(124,58,237,0.3), rgba(6,182,212,0.2), transparent)', margin: '16px 0' }} />

          {/* Key points */}
          <div className="flex flex-col gap-2" style={{ marginBottom: 16 }}>
            {[
              isFrench ? 'Aucun contrat — annulation libre' : 'No contract — cancel anytime',
              isFrench ? 'Prix à vie garanti — peut seulement diminuer' : 'Price locked for life — can only go down',
              isFrench ? 'Aucune vérification de crédit' : 'No credit check',
            ].map((pt, i) => (
              <div key={i} className="flex items-start gap-2" style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>
                <div className="shrink-0 flex items-center justify-center" style={{ width: 16, height: 16, borderRadius: 999, background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', marginTop: 1 }}>
                  <Check className="w-2 h-2" strokeWidth={3.5} style={{ color: '#A78BFA' }} />
                </div>
                {pt}
              </div>
            ))}
          </div>

          <EquipmentRequiredBox type={isGiga ? 'combo' : 'tv'} />

          <button
            onClick={(e) => { e.stopPropagation(); addressValidated && handleGetStarted(plan.id); }}
            disabled={!addressValidated}
            className="w-full flex items-center justify-center gap-2 font-bold"
            style={{
              height: 52, borderRadius: 12, border: 'none', cursor: addressValidated ? 'pointer' : 'not-allowed',
              fontSize: 14, fontFamily: "'Space Grotesk', sans-serif",
              background: plan.featured ? 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)' : 'rgba(255,255,255,0.08)',
              color: '#FFFFFF',
              boxShadow: plan.featured ? '0 8px 32px rgba(124,58,237,0.5)' : 'none',
              transition: 'box-shadow .2s, background .2s, transform .15s',
              marginTop: 4,
            }}
            onMouseEnter={e => {
              if (!addressValidated) return;
              const el = e.currentTarget as HTMLElement;
              el.style.background = plan.featured ? 'linear-gradient(135deg, #6D28D9 0%, #5B21B6 100%)' : 'rgba(255,255,255,0.14)';
              el.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = plan.featured ? 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)' : 'rgba(255,255,255,0.08)';
              el.style.transform = 'translateY(0)';
            }}
          >
            {isFrench ? 'Choisir ce forfait' : 'Choose this plan'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: BG, minHeight: '100vh' }} data-testid="tv-plans-page">
      <SEOHead {...SEO_DATA.tv} />
      <Header />

      {/* ── Hero ── */}
      <section style={{ paddingTop: 110, paddingBottom: 72, position: 'relative', overflow: 'hidden' }}>
        {/* Server room premium LED glow — content delivery infrastructure */}
        <PhotoBg url="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=80" opacity={0.15} filter="saturate(0.6) brightness(0.6)" />
        <div aria-hidden style={{ position: 'absolute', top: '-20%', right: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.28) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.14) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), rgba(6,182,212,0.5), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />

        <div className="max-w-[1100px] mx-auto px-5 sm:px-10 text-center relative">
          <div className="n-animate-in inline-flex items-center gap-2.5 mb-8" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 999, padding: '7px 18px' }}>
            <Tv className="w-3.5 h-3.5" style={{ color: '#A78BFA' }} />
            <span style={{ color: '#A78BFA', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
              {isFrench ? 'TV + Internet · Tout inclus' : 'TV + Internet · All inclusive'}
            </span>
          </div>

          <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(42px, 6vw, 72px)', letterSpacing: '-2.5px', lineHeight: 1.0, marginBottom: 16, color: '#fff' }}>
            {isFrench ? (
              <><span>Forfaits </span><span className="n-shimmer-text">TV</span><span> Nivra</span></>
            ) : (
              <><span>Nivra </span><span className="n-shimmer-text">TV</span><span> Plans</span></>
            )}
          </h1>

          <p className="n-animate-in-delay-2" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, lineHeight: 1.7, maxWidth: 580, margin: '0 auto 32px' }}>
            {isFrench
              ? 'Profitez de la télévision 4K avec le Nivra Smart Terminal. Tableau de bord streaming accessible par navigateur — aucune application requise.'
              : 'Enjoy 4K television with the Nivra Smart Terminal. Browser-based streaming dashboard — no app required.'}
          </p>

          {/* Internet included notice */}
          <div className="n-animate-in-delay-2 inline-flex items-center gap-2.5 mb-10" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '10px 20px' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#F59E0B' }} />
            <span style={{ color: '#FCD34D', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
              {isFrench ? 'Les forfaits TV incluent l\'Internet — aucun forfait séparé requis.' : 'TV plans include Internet — no separate plan required.'}
            </span>
          </div>

          <div className="n-animate-in-delay-3 flex flex-wrap justify-center gap-4">
            {[
              { val: '4K HDR', sub: isFrench ? 'Smart Terminal' : 'Smart Terminal', color: '#A78BFA' },
              { val: isFrench ? 'Sans contrat' : 'No contract', sub: isFrench ? 'annulation libre' : 'cancel anytime', color: '#06B6D4' },
              { val: isFrench ? 'Internet inclus' : 'Internet included', sub: isFrench ? 'dans chaque forfait' : 'in every plan', color: '#10B981' },
              { val: isFrench ? 'Québec' : 'Quebec', sub: isFrench ? 'disponible partout' : 'available province-wide', color: '#F59E0B' },
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

          {/* ── Address validation ── */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '32px 36px', marginBottom: 52, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto', backdropFilter: 'blur(16px)' }}>
            <div className="flex flex-col items-center mb-5">
              <div className="flex items-center justify-center mb-4" style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
                <MapPin className="w-7 h-7" style={{ color: '#A78BFA' }} />
              </div>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: '#fff', marginBottom: 6, textAlign: 'center' }}>
                {isFrench ? 'Vérifiez la disponibilité' : 'Check Availability'}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, textAlign: 'center', maxWidth: 380 }}>
                {isFrench ? 'Entrez votre adresse pour confirmer la disponibilité du service TV' : 'Enter your address to confirm TV service availability'}
              </p>
            </div>

            <AddressAutocomplete
              value={addressText}
              onValueChange={(value) => {
                setAddressText(value);
                if (!value) { setAddressValidated(false); setAddressDetails(null); setAddressError(""); }
              }}
              onSelect={handleAddressSelect}
              placeholder={isFrench ? '123 rue Exemple, Montréal, QC H1A 1A1' : '123 Example St, Montreal, QC H1A 1A1'}
              restrictToQuebec={true}
            />

            {addressError && (
              <Alert variant="destructive" className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{addressError}</AlertDescription>
              </Alert>
            )}

            {addressValidated && addressDetails && (
              <div className="mt-3 flex items-center gap-2 justify-center" style={{ color: '#34D399', fontSize: 13 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check className="w-3 h-3" strokeWidth={3} />
                </div>
                {isFrench ? 'Service TV + Internet disponible à cette adresse' : 'TV + Internet service available at this address'}
              </div>
            )}
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

          {/* ── Standard TV Plans ── */}
          {!isLoading && (
            <>
              <div className="text-center mb-10">
                <p className="n-label" style={{ marginBottom: 12 }}>{isFrench ? 'Nos forfaits' : 'Our plans'}</p>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-1.5px', color: '#fff', marginBottom: 8 }}>
                  {isFrench ? 'Forfaits TV + Internet' : 'TV + Internet Plans'}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16 }}>
                  {isFrench ? 'Internet inclus dans chaque forfait. Choisissez votre chaîne.' : 'Internet included in every plan. Choose your channels.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {standardPlans.map((plan, i) => <PlanCard key={i} plan={plan} />)}
              </div>

              {!addressValidated && (
                <p className="text-center" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 56, fontFamily: "'JetBrains Mono', monospace" }}>
                  {isFrench ? '↑ Vérifiez d\'abord la disponibilité à votre adresse' : '↑ First verify availability at your address'}
                </p>
              )}

              {/* ── GIGA Plans ── */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 60, marginBottom: 10 }}>
                <div className="text-center mb-10">
                  <div className="inline-flex items-center gap-2 mb-6" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.15))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 999, padding: '6px 16px' }}>
                    <Zap className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />
                    <span style={{ color: '#FCD34D', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
                      {isFrench ? 'GIGA Vitesse' : 'GIGA Speed'}
                    </span>
                  </div>
                  <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-1.5px', color: '#fff', marginBottom: 8 }}>
                    {isFrench ? 'Forfaits GIGA Internet + TV' : 'GIGA Internet + TV Bundles'}
                  </h2>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16 }}>
                    {isFrench ? 'Internet ultra-rapide 1 Gbps combiné avec nos forfaits TV premium.' : 'Ultra-fast 1 Gbps Internet combined with our premium TV plans.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                  {gigaPlans.map((plan, i) => <PlanCard key={i} plan={plan} isGiga />)}
                </div>
              </div>

              {/* ── Critical Information Summaries (CRTC) ── */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 40, marginTop: 20, marginBottom: 48 }}>
                <p style={{ color: "#475569", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20, fontFamily: "'JetBrains Mono', monospace" }}>
                  {isFrench ? "Résumés d'information essentielle — CRTC" : "Critical Information Summaries — CRTC"}
                </p>
                <div style={{ marginBottom: 24 }}>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.72rem", marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                    {isFrench ? "Forfaits TV + Internet" : "TV + Internet Plans"}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {standardPlans.map((plan, i) => (
                      <CriticalInfoSummary
                        key={i}
                        serviceType="tv"
                        planName={plan.name}
                        monthlyPrice={plan.price}
                        downloadSpeed={plan.internetSpeed}
                        contractMonths={0}
                        activationFee={0}
                        equipmentFee={terminalPrice}
                        language={isFrench ? "fr" : "en"}
                      />
                    ))}
                  </div>
                </div>
                {gigaPlans.length > 0 && (
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.72rem", marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                      {isFrench ? "Forfaits GIGA" : "GIGA Plans"}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {gigaPlans.map((plan, i) => (
                        <CriticalInfoSummary
                          key={i}
                          serviceType="tv"
                          planName={plan.name}
                          monthlyPrice={plan.price}
                          downloadSpeed={plan.internetSpeed}
                          contractMonths={0}
                          activationFee={0}
                          equipmentFee={terminalPrice}
                          language={isFrench ? "fr" : "en"}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Equipment ── */}
          <div className="mb-12" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800, marginLeft: 'auto', marginRight: 'auto' }}>
            {[
              {
                icon: <Monitor className="w-10 h-10" style={{ color: '#A78BFA' }} />,
                iconBg: 'rgba(124,58,237,0.15)',
                iconBorder: 'rgba(124,58,237,0.3)',
                title: 'Nivra 4K Smart Terminal',
                desc: isFrench
                  ? `Terminal 4K haute performance avec télécommande vocale. Maximum 4 terminaux par adresse. Frais uniques de ${terminalPrice}$ par terminal.`
                  : `High-performance 4K terminal with voice remote. Max 4 terminals per address. One-time $${terminalPrice} per terminal.`,
                tags: [
                  { label: isFrench ? 'Garantie 1 an' : '1-Year Warranty', color: '#10B981' },
                  { label: isFrench ? 'Max 4 terminaux' : 'Max 4 terminals', color: '#A78BFA' },
                ],
                price: `$${terminalPrice}`,
                priceLabel: isFrench ? 'par terminal' : 'per terminal',
              },
              {
                icon: <Router className="w-10 h-10" style={{ color: '#67E8F9' }} />,
                iconBg: 'rgba(6,182,212,0.12)',
                iconBorder: 'rgba(6,182,212,0.3)',
                title: isFrench ? 'Borne Nivra WiFi' : 'Nivra WiFi Modem',
                desc: isFrench
                  ? 'Routeur haute performance requis pour tous les forfaits Internet et TV. Frais uniques de 60$ payables avant l\'installation.'
                  : 'High-performance router required for all Internet and TV plans. One-time $60 fee payable before installation.',
                tags: [
                  { label: isFrench ? 'Garantie 1 an' : '1-Year Warranty', color: '#10B981' },
                  { label: isFrench ? 'Défauts couverts' : 'Defects covered', color: '#67E8F9' },
                ],
                price: '$60',
                priceLabel: isFrench ? 'Frais uniques' : 'One-time fee',
              },
            ].map((eq) => (
              <div key={eq.title} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '28px 32px', backdropFilter: 'blur(16px)' }}>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="flex items-center justify-center flex-shrink-0" style={{ width: 72, height: 72, borderRadius: 18, background: eq.iconBg, border: `1px solid ${eq.iconBorder}` }}>
                    {eq.icon}
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 19, color: '#fff', marginBottom: 6 }}>{eq.title}</h3>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{eq.desc}</p>
                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                      {eq.tags.map(tag => (
                        <span key={tag.label} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${tag.color}30`, borderRadius: 999, padding: '3px 10px', fontSize: 11, color: tag.color, fontFamily: "'JetBrains Mono', monospace" }}>
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-center flex-shrink-0">
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 38, letterSpacing: '-1.5px', color: '#fff' }}>{eq.price}</div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>{eq.priceLabel.toUpperCase()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── What sets us apart ── */}
          <div className="mb-16">
            <div className="text-center mb-10">
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(24px, 3vw, 36px)', letterSpacing: '-1px', color: '#fff' }}>
                {isFrench ? 'Ce qui nous différencie' : 'What Sets Us Apart'}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto">
              {[
                { icon: <Check className="w-6 h-6" strokeWidth={2.5} style={{ color: '#10B981' }} />, bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', title: isFrench ? 'Aucune vérification de crédit' : 'No Credit Check', desc: isFrench ? 'Accès universel sans impact sur votre crédit.' : 'Universal access, no credit impact.' },
                { icon: <Shield className="w-6 h-6" strokeWidth={2} style={{ color: '#A78BFA' }} />, bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.3)', title: isFrench ? '100% Indépendant' : '100% Independent', desc: isFrench ? 'Aucune affiliation avec les grands fournisseurs.' : 'No major carrier affiliations.' },
                { icon: <MapPin className="w-6 h-6" strokeWidth={2} style={{ color: '#F59E0B' }} />, bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', title: isFrench ? 'ID Gouvernemental' : 'Government ID', desc: isFrench ? 'Vérification d\'identité obligatoire pour sécuriser votre compte.' : 'Government ID mandatory to secure your account.' },
              ].map((item) => (
                <div key={item.title} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 24px', backdropFilter: 'blur(12px)', textAlign: 'center' }}>
                  <div className="flex items-center justify-center mx-auto mb-4" style={{ width: 52, height: 52, borderRadius: 14, background: item.bg, border: `1px solid ${item.border}` }}>
                    {item.icon}
                  </div>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 8 }}>{item.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className="mb-12">
            <TVInfoBox isFrench={isFrench} />
          </div>

          {/* Terms */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '28px 32px', marginBottom: 24 }}>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 14 }}>
              {isFrench ? 'Termes et conditions — Nivra Communications' : 'Terms and conditions — Nivra Communications'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(isFrench ? [
                'Les contrats doivent être affichés en français en premier pour la conformité au Québec.',
                'Aucun check de crédit requis.',
                'Identité gouvernementale obligatoire pour valider toute commande.',
                '100% indépendant — Aucune affiliation, partenariat ou commission carrier.',
                'Paiement facturé directement au client par Nivra Communications.',
              ] : [
                'Contracts must be shown in French first for Quebec compliance.',
                'No credit check required.',
                'Government ID mandatory to validate any order.',
                '100% independent — No carrier affiliation, partnership or commission.',
                'Client pays directly to Nivra Communications.',
              ]).map((t, i) => (
                <div key={i} className="flex items-start gap-2" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  <span style={{ color: '#7C3AED', marginTop: 1 }}>•</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', fontFamily: "'JetBrains Mono', monospace" }}>
            {isFrench
              ? "Livraison : L'équipement Nivra est livré dans 48h ouvrables en zone urbaine et 72h en zone rurale."
              : "Delivery: Nivra equipment is delivered within 48 working hours in urban areas and 72 hours in rural areas."}
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TVPlans;
