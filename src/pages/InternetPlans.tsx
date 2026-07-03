import { useState, useEffect, useRef } from "react";
import { trackLiveActivity } from "@/hooks/useLiveActivityTracker";
import { PhotoBg } from "@/components/PhotoBg";
import { Wifi, Check, MapPin, Shield, ArrowRight, AlertTriangle, Router, Loader2 } from "lucide-react";
import { EquipmentRequiredBox } from "@/components/shared/EquipmentRequiredBox";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { InternetInfoBox } from "@/components/ServiceInfoBox";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";
import { ItemListSchema } from "@/components/seo";
import { useInternetPlans, useEquipmentPrices } from "@/hooks/usePublicServices";
import { useAutoTranslatePlans } from "@/hooks/useAutoTranslatePlans";
import CriticalInfoSummary from "@/components/CriticalInfoSummary";

const BG = '#020209';
const PURPLE = '#7C3AED';
const CYAN = '#06B6D4';

const InternetPlans = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isFrench = language === 'fr';

  const [address, setAddress] = useState("");
  const [addressDetails, setAddressDetails] = useState<AddressValue | null>(null);
  const [addressValidated, setAddressValidated] = useState(false);
  const [addressError, setAddressError] = useState("");

  const planViewTracked = useRef(false);
  useEffect(() => {
    if (planViewTracked.current) return;
    planViewTracked.current = true;
    trackLiveActivity("plan_view", "Consultation: Forfaits Internet", { metadata: { category: "internet" } });
  }, []);

  const { plans: rawPlans, isLoading: isLoadingPlans } = useInternetPlans(isFrench);
  const { plans } = useAutoTranslatePlans(rawPlans);
  const { routerPrice, isLoading: isLoadingEquipment } = useEquipmentPrices();
  const isLoading = isLoadingPlans || isLoadingEquipment;

  const handleAddressSelect = (details: AddressValue) => {
    setAddressDetails(details);
    setAddress(details.line1);
    const postalCode = details.postalCode || "";
    const region = details.region || "";
    const isQuebec = /^[GHJ]/i.test(postalCode) || region.toUpperCase().includes("QC") || region.toUpperCase().includes("QUEBEC");
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
    trackLiveActivity("add_to_cart", `Ajout: ${planId}`, { metadata: { planId, category: "internet" } });
    // Hand off the validated service address to the checkout so the
    // customer doesn't have to re-type it.
    if (addressDetails) {
      writePrecheckedAddress({
        line1: addressDetails.line1,
        city: addressDetails.city,
        region: addressDetails.region || "QC",
        postalCode: addressDetails.postalCode,
      });
    }
    navigate(`/commander?plan=${planId}`);
  };

  return (
    <div style={{ background: BG, minHeight: '100vh' }} className="relative overflow-hidden" data-testid="internet-plans-page">
      <PhotoBg url="https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=80" opacity={0.08} filter="saturate(0.5) brightness(0.6)" />
      <div aria-hidden style={{ position: 'absolute', top: '-10%', right: '-8%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-10%', left: '-6%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.05) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <SEOHead {...SEO_DATA.internet} />
      <ItemListSchema
        listName="Forfaits Internet Nivra Telecom"
        listDescription="Forfaits Internet et TV sans contrat au Québec"
        listUrl="https://nivra-telecom.ca/internet"
        items={[
          { position: 1, name: "Internet 400 Mbps", description: "Forfait Internet 400 Mbps sans contrat au Québec" },
          { position: 2, name: "Internet 600 Mbps", description: "Forfait Internet 600 Mbps sans contrat au Québec" },
          { position: 3, name: "Internet 1 Gbps", description: "Forfait Internet 1 Gbps sans contrat au Québec" },
        ]}
      />
      <Header />

      {/* ── Hero ── */}
      <section style={{ paddingTop: 110, paddingBottom: 72, position: 'relative', overflow: 'hidden' }}>
        {/* Circuit board closeup — precision tech, internet infrastructure */}
        <PhotoBg url="https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=80" opacity={0.14} filter="saturate(0.5) brightness(0.6)" />
        {/* Aurora blobs */}
        <div aria-hidden style={{ position: 'absolute', top: '-20%', right: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.28) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.14) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
        {/* Grid */}
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
        {/* Scan line */}
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), rgba(6,182,212,0.5), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />

        <div className="max-w-[1100px] mx-auto px-5 sm:px-10 text-center relative">
          {/* Badge */}
          <div className="n-animate-in inline-flex items-center gap-2.5 mb-8" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 999, padding: '7px 18px' }}>
            <Wifi className="w-3.5 h-3.5" style={{ color: '#A78BFA' }} />
            <span style={{ color: '#A78BFA', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
              {isFrench ? 'Internet haute vitesse · Fibre XGS-PON' : 'High-speed Internet · XGS-PON Fibre'}
            </span>
          </div>

          <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(42px, 6vw, 72px)', letterSpacing: '-2.5px', lineHeight: 1.0, marginBottom: 16, color: '#fff' }}>
            {isFrench ? (
              <><span>Internet résidentiel </span><span className="n-shimmer-text">Québec</span></>
            ) : (
              <><span>Residential Internet </span><span className="n-shimmer-text">Quebec</span></>
            )}
          </h1>

          <p className="n-animate-in-delay-2" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, lineHeight: 1.7, maxWidth: 560, margin: '0 auto 48px' }}>
            {isFrench
              ? 'Connexion fibre haute performance. Borne Nivra WiFi requise — 60$ (achat unique). Aucune vérification de crédit.'
              : 'High-performance fibre connection. Nivra WiFi modem required — $60 (one-time). No credit check required.'}
          </p>

          <div className="n-animate-in-delay-3 flex flex-wrap justify-center gap-4">
            {[
              { val: isFrench ? 'Dès 45$/mois' : 'From $45/mo', sub: isFrench ? 'taxes incluses' : 'taxes included', color: '#A78BFA' },
              { val: isFrench ? 'Sans contrat' : 'No contract', sub: isFrench ? 'résiliez à tout moment' : 'cancel anytime', color: CYAN },
              { val: isFrench ? 'Fibre XGS-PON' : 'XGS-PON Fibre', sub: isFrench ? 'technologie avancée' : 'advanced technology', color: '#10B981' },
              { val: isFrench ? 'CGNAT-Free' : 'CGNAT-Free', sub: 'IPv6 · WPA3', color: '#F59E0B' },
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
                {isFrench
                  ? 'Entrez votre adresse pour confirmer la disponibilité du service'
                  : 'Enter your address to confirm service availability'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <AddressAutocomplete
                value={address}
                onValueChange={(value) => {
                  setAddress(value);
                  if (!value) { setAddressValidated(false); setAddressDetails(null); setAddressError(""); }
                }}
                onSelect={handleAddressSelect}
                placeholder={isFrench ? '123 rue Exemple, Montréal, QC H1A 1A1' : '123 Example St, Montreal, QC H1A 1A1'}
                restrictToQuebec={true}
              />
            </div>

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
                {isFrench ? 'Service disponible à cette adresse' : 'Service available at this address'}
              </div>
            )}
          </div>

          {/* ── Plans section heading ── */}
          <div className="text-center mb-10">
            <p className="n-label" style={{ marginBottom: 12 }}>
              {isFrench ? 'Nos forfaits' : 'Our plans'}
            </p>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-1.5px', color: '#fff', marginBottom: 8 }}>
              {isFrench ? 'Internet haute vitesse' : 'High-Speed Internet'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16 }}>
              {isFrench ? 'Choisissez le forfait adapté à vos besoins' : 'Choose the plan that fits your needs'}
            </p>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              {plans.map((plan) => {
                const speedNum = plan.speed.replace(/[^0-9]/g, '');
                const isGiga = plan.speed.includes('940') || plan.name.toLowerCase().includes('giga');
                const displayName = isGiga ? 'Internet GIGA' : `Internet ${speedNum}`;

                return (
                  <div
                    key={plan.id}
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
                        {isFrench ? 'FORFAIT INTERNET' : 'INTERNET PLAN'}
                      </p>
                      <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px', marginBottom: 18, color: '#fff' }}>
                        {displayName}
                      </h3>

                      {/* ── VITESSE section ── */}
                      <div style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.22)', borderRadius: 14, padding: '16px 18px', marginBottom: 18 }}>
                        <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                          <Wifi className="w-3 h-3 flex-shrink-0" style={{ color: '#67E8F9' }} />
                          <span style={{ color: '#67E8F9', fontSize: 9.5, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
                            {isFrench ? 'VITESSE' : 'SPEED'}
                          </span>
                        </div>

                        {/* Big speed number */}
                        <div className="flex items-baseline gap-1.5" style={{ marginBottom: 14 }}>
                          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 52, letterSpacing: '-2.5px', lineHeight: 1, color: '#fff' }}>
                            {speedNum}
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: 500 }}>
                            {isFrench ? 'Mbit/s illimité' : 'Mbit/s unlimited'}
                          </span>
                        </div>

                        {/* Two explicit lines */}
                        <div className="flex flex-col gap-2">
                          {[
                            isFrench ? `Vitesse de téléchargement jusqu'à ${speedNum} Mbit/s` : `Download speed up to ${speedNum} Mbit/s`,
                            isFrench ? 'Données incluses illimitées' : 'Unlimited data included',
                          ].map((line, i) => (
                            <div key={i} className="flex items-center gap-2" style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>
                              <Check className="w-3 h-3 flex-shrink-0" strokeWidth={3} style={{ color: '#67E8F9' }} />
                              {line}
                            </div>
                          ))}
                          {isGiga && (
                            <div className="flex items-center gap-2" style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }}>
                              <Check className="w-3 h-3 flex-shrink-0" strokeWidth={3} style={{ color: '#67E8F9' }} />
                              {isFrench ? 'Ultra-faible latence · CGNAT-Free · IPv6' : 'Ultra-low latency · CGNAT-Free · IPv6'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Price */}
                      <div style={{ marginBottom: 4 }}>
                        <div className="flex items-baseline gap-1">
                          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 50, letterSpacing: '-2.5px', lineHeight: 1, color: '#FFFFFF' }}>
                            ${plan.price}
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>
                            /{isFrench ? 'mois' : 'mo'}
                          </span>
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

                      <EquipmentRequiredBox type="internet" />

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
              })}
            </div>
          )}

          {/* ── Critical Information Summaries (CRTC Internet Code) ── */}
          {!isLoading && plans.length > 0 && (
            <div style={{ marginBottom: 56 }}>
              <p style={{ color: "#475569", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14, fontFamily: "'JetBrains Mono', monospace" }}>
                {isFrench ? "Résumés d'information essentielle — Code Internet CRTC" : "Critical Information Summaries — CRTC Internet Code"}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((plan) => {
                  const speedNum = plan.speed.replace(/[^0-9]/g, '');
                  return (
                    <CriticalInfoSummary
                      key={plan.id}
                      serviceType="internet"
                      planName={plan.name}
                      monthlyPrice={plan.price}
                      downloadSpeed={speedNum ? `${speedNum} Mbit/s` : undefined}
                      dataCapGb={null}
                      contractMonths={0}
                      activationFee={10}
                      equipmentFee={routerPrice}
                      language={isFrench ? "fr" : "en"}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {!addressValidated && !isLoading && (
            <p className="text-center" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: -40, marginBottom: 48, fontFamily: "'JetBrains Mono', monospace" }}>
              {isFrench ? '↑ Vérifiez d\'abord la disponibilité à votre adresse' : '↑ First verify availability at your address'}
            </p>
          )}

          {/* ── Equipment ── */}
          <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(255,255,255,0.04) 100%)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 20, padding: '36px 40px', marginBottom: 48, backdropFilter: 'blur(16px)' }}>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex items-center justify-center flex-shrink-0" style={{ width: 80, height: 80, borderRadius: 20, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
                <Router className="w-10 h-10" style={{ color: '#A78BFA' }} />
              </div>
              <div className="flex-1 text-center md:text-left">
                <p className="n-label" style={{ marginBottom: 6 }}>
                  {isFrench ? 'Équipement requis' : 'Required equipment'}
                </p>
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 22, color: '#fff', marginBottom: 8 }}>
                  Borne Nivra WiFi
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
                  {isFrench
                    ? `Borne WiFi haute performance obligatoire pour tous les forfaits Internet. Achat unique de ${routerPrice}$ payable avant l'installation. Vous en êtes propriétaire.`
                    : `High-performance WiFi modem mandatory for all Internet plans. One-time $${routerPrice} purchase payable before installation. You own it.`}
                </p>
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  {[
                    { label: isFrench ? 'Garantie 1 an' : '1-Year Warranty', color: '#10B981' },
                    { label: isFrench ? 'Défauts fabricant couverts' : 'Manufacturer Defects Covered', color: '#A78BFA' },
                  ].map((tag) => (
                    <span key={tag.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: `1px solid ${tag.color}30`, borderRadius: 999, padding: '4px 12px', fontSize: 12, color: tag.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5 }}>
                      <Shield className="w-3 h-3" />
                      {tag.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-center flex-shrink-0">
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 44, letterSpacing: '-2px', color: '#fff' }}>${routerPrice}</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>
                  {isFrench ? 'FRAIS UNIQUES' : 'ONE-TIME FEE'}
                </div>
              </div>
            </div>
          </div>

          {/* ── What sets us apart ── */}
          <div className="mb-16">
            <div className="text-center mb-10">
              <p className="n-label" style={{ marginBottom: 12 }}>
                {isFrench ? 'Notre avantage' : 'Our advantage'}
              </p>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(24px, 3vw, 36px)', letterSpacing: '-1px', color: '#fff' }}>
                {isFrench ? 'Ce qui nous différencie' : 'What Sets Us Apart'}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  icon: <Check className="w-6 h-6" strokeWidth={2.5} style={{ color: '#10B981' }} />,
                  iconBg: 'rgba(16,185,129,0.12)',
                  iconBorder: 'rgba(16,185,129,0.3)',
                  title: isFrench ? 'Aucune vérification de crédit' : 'No Credit Check',
                  desc: isFrench ? 'Nous ne vérifions jamais votre crédit. Accès universel.' : 'We never check your credit. Universal access.',
                },
                {
                  icon: <Shield className="w-6 h-6" strokeWidth={2} style={{ color: '#A78BFA' }} />,
                  iconBg: 'rgba(124,58,237,0.12)',
                  iconBorder: 'rgba(124,58,237,0.3)',
                  title: isFrench ? '100% Indépendant' : '100% Independent',
                  desc: isFrench ? 'Aucune affiliation avec les grands fournisseurs.' : 'No affiliation with major carriers.',
                },
                {
                  icon: <MapPin className="w-6 h-6" strokeWidth={2} style={{ color: '#F59E0B' }} />,
                  iconBg: 'rgba(245,158,11,0.12)',
                  iconBorder: 'rgba(245,158,11,0.3)',
                  title: isFrench ? 'Pièce d\'identité requise' : 'ID Required',
                  desc: isFrench ? 'Vérification d\'identité gouvernementale pour sécuriser votre compte.' : 'Government ID verification to secure your account.',
                },
              ].map((item) => (
                <div key={item.title} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 24px', backdropFilter: 'blur(12px)', textAlign: 'center' }}>
                  <div className="flex items-center justify-center mx-auto mb-4" style={{ width: 52, height: 52, borderRadius: 14, background: item.iconBg, border: `1px solid ${item.iconBorder}` }}>
                    {item.icon}
                  </div>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 8 }}>
                    {item.title}
                  </h3>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Info Box ── */}
          <div className="mb-12">
            <InternetInfoBox isFrench={isFrench} />
          </div>

          {/* ── Terms ── */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '28px 32px', marginBottom: 24, backdropFilter: 'blur(8px)' }}>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: 'rgba(255,255,255,0.7)', marginBottom: 14 }}>
              {isFrench ? 'Termes et conditions — Nivra Communications' : 'Terms and conditions — Nivra Communications'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(isFrench ? [
                'Les contrats doivent être affichés en français en premier pour la conformité au Québec.',
                'Aucun partenariat ni commission avec les fournisseurs de télécommunications.',
                'Aucune vérification de crédit requise.',
                'Une pièce d\'identité gouvernementale est requise pour valider toute commande.',
              ] : [
                'Contracts must be shown in French first for Quebec compliance.',
                'No carrier partnerships or commissions.',
                'No credit check required.',
                'Government ID required to validate any order.',
              ]).map((t, i) => (
                <div key={i} className="flex items-start gap-2" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  <span style={{ color: '#7C3AED', marginTop: 1 }}>•</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Delivery notice ── */}
          <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', marginBottom: 24, fontFamily: "'JetBrains Mono', monospace" }}>
            {isFrench
              ? "Livraison : L'équipement Nivra est normalement livré dans les 48h ouvrables en zone urbaine et 72h en zone rurale. Des délais peuvent survenir lors des jours fériés."
              : "Delivery: Nivra equipment is normally delivered within 48 working hours in urban areas and 72 hours in rural areas. Delays may occur during holidays."}
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default InternetPlans;
