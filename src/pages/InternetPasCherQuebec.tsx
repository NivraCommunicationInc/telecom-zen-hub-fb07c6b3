import { useState, FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { Wifi, Check, Shield, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const BRAND = "#7c3aed";

const InternetPasCherQuebec = () => {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  // Honeypot — bots typically fill every visible field. Real users won't see this.
  const [hp, setHp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!consent) {
      toast.error("Merci de cocher la case de consentement.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Adresse courriel invalide.");
      return;
    }
    if (!firstName.trim()) {
      toast.error("Le prénom est requis.");
      return;
    }
    if (hp.trim() !== "") {
      // Silent honeypot trip — pretend success
      setSubmitted(true);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-lead-capture", {
        body: {
          first_name: firstName.trim(),
          email: email.trim().toLowerCase(),
          city: city.trim() || null,
          postal_code: postalCode.trim() || null,
          phone: phone.trim() || null,
          consent: true,
          consent_source: "website_explicit",
          landing: "internet-pas-cher-quebec",
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Erreur");
      setSubmitted(true);
      toast.success("Demande reçue! On vous écrit dans la minute.");
    } catch (err: any) {
      console.error("[lead-capture]", err);
      toast.error(err?.message ?? "Impossible d'envoyer la demande pour l'instant.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Internet pas cher au Québec — GIGA 60$/mois sans contrat | Nivra Telecom</title>
        <meta
          name="description"
          content="Internet GIGA 940 Mbps à 60$/mois sans contrat, sans vérification de crédit. Fournisseur local québécois, sans engagement. Réservation en 30 secondes."
        />
        <link rel="canonical" href="https://nivra-telecom.ca/internet-pas-cher-quebec" />
        <meta property="og:title" content="Internet pas cher au Québec — GIGA 60$/mois sans contrat" />
        <meta property="og:description" content="Internet GIGA 940 Mbps. Sans contrat, sans crédit, support québécois." />
        <meta property="og:url" content="https://nivra-telecom.ca/internet-pas-cher-quebec" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Internet GIGA 940 Mbps Nivra Telecom",
            provider: {
              "@type": "Organization",
              name: "Nivra Telecom",
              areaServed: "Quebec, Canada",
              url: "https://nivra-telecom.ca",
            },
            offers: {
              "@type": "Offer",
              price: "60.00",
              priceCurrency: "CAD",
              priceSpecification: {
                "@type": "UnitPriceSpecification",
                price: "60.00",
                priceCurrency: "CAD",
                referenceQuantity: { "@type": "QuantitativeValue", value: "1", unitCode: "MON" },
              },
            },
            description: "Internet GIGA 940 Mbps sans contrat, sans vérification de crédit, support québécois.",
          })}
        </script>
      </Helmet>

      <main style={{ background: '#020209' }}>
        {/* HERO */}
        <section className="relative overflow-hidden px-6 max-w-6xl mx-auto" style={{ paddingTop: 100, paddingBottom: 64 }}>
          <div style={{ position: 'absolute', top: '-20%', left: '-15%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', animation: 'n-aurora-1 18s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 70%)', animation: 'n-aurora-2 14s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), rgba(6,182,212,0.4), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />
          <div className="grid md:grid-cols-2 gap-12 items-center" style={{ position: 'relative', zIndex: 2 }}>
            <div>
              <div className="n-animate-in" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 100, padding: '6px 16px', marginBottom: 20 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#A78BFA', letterSpacing: '0.08em' }}>OFFRE QUÉBEC — SANS CONTRAT</span>
              </div>
              <h1 className="n-animate-in-delay-1 font-bold leading-tight text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(30px, 5vw, 52px)', letterSpacing: '-2px', marginTop: 0 }}>
                Internet GIGA pas cher au Québec à{' '}<span className="n-shimmer-text">60$/mois</span>
              </h1>
              <p className="mt-4 text-lg" style={{ color: 'rgba(255,255,255,0.65)' }}>
                940 Mbps. Sans contrat. Sans vérification de crédit. Un fournisseur local québécois — support
                client en français, équipe basée au Québec.
              </p>
              <ul className="mt-6 space-y-2" style={{ color: 'rgba(255,255,255,0.78)' }}>
                {[
                  "GIGA 940 Mbps illimité — 60$/mois",
                  "Aucun engagement, annulable en tout temps",
                  "Tout le monde accepté — pas de vérif. crédit",
                  "Économisez ~720$/an comparé à votre forfait actuel",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <Check className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#A78BFA' }} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* FORM */}
            <div
              id="reserver"
              className="rounded-2xl p-6 md:p-8"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}
            >
              {submitted ? (
                <div className="text-center py-8">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                    style={{ backgroundColor: BRAND }}
                  >
                    <Check className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="mt-4 text-2xl font-bold text-white">Demande reçue!</h2>
                  <p className="mt-2" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    On vous écrit dans la minute avec les détails. Surveillez aussi votre dossier indésirables au cas où.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <h2 className="text-2xl font-bold text-white">Réservez votre forfait</h2>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>30 secondes. Aucune carte de crédit requise.</p>

                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">Prénom *</Label>
                    <Input
                      id="firstName"
                      type="text"
                      autoComplete="given-name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">Courriel *</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="city">Ville</Label>
                      <Input
                        id="city"
                        type="text"
                        autoComplete="address-level2"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="postal">Code postal</Label>
                      <Input
                        id="postal"
                        type="text"
                        autoComplete="postal-code"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
                        maxLength={7}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Téléphone (optionnel)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  {/* Honeypot — hidden from real users */}
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={hp}
                    onChange={(e) => setHp(e.target.value)}
                    style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                    aria-hidden="true"
                  />

                  <label className="flex items-start gap-3 text-sm pt-2" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <Checkbox
                      checked={consent}
                      onCheckedChange={(v) => setConsent(v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      J'autorise Nivra Telecom à m'envoyer des informations sur ses forfaits et offres. Je peux me
                      désabonner en tout temps. Conforme Loi 25 et LCAP.
                    </span>
                  </label>

                  <Button
                    type="submit"
                    disabled={submitting || !consent}
                    className="w-full text-base font-semibold py-6"
                    style={{ backgroundColor: BRAND, color: "white" }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Envoi...
                      </>
                    ) : (
                      "Réserver mon forfait"
                    )}
                  </Button>

                  <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    En soumettant, vous confirmez avoir 18 ans ou plus et résider au Québec.
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* PRICING / WHY */}
        <section className="px-6 py-16" style={{ background: '#020209' }}>
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-white" style={{ letterSpacing: '-0.8px' }}>
              Votre fournisseur actuel vous coûte combien de trop?
            </h2>
            <p className="mt-3 text-center max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Comparaison directe sur le même service — Internet GIGA 940 Mbps illimité, sans engagement.
            </p>

            <div className="mt-10 grid md:grid-cols-3 gap-6">
              {[
                { label: "Grands fournisseurs A", price: "100-120$", note: "Internet GIGA seul, prix promo limité à 12 mois" },
                { label: "Grands fournisseurs B", price: "90-110$", note: "Avec frais d'installation, contrat 24 mois" },
                { label: "Nivra", price: "60$", note: "Prix réel, sans contrat, sans vérif. crédit", highlight: true },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl p-6"
                  style={{
                    background: card.highlight ? 'linear-gradient(180deg, #16111F 0%, #0A0A0F 100%)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${card.highlight ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.09)'}`,
                    transform: card.highlight ? 'scale(1.05)' : 'none',
                    boxShadow: card.highlight ? '0 20px 50px rgba(124,58,237,0.4)' : 'none',
                  }}
                >
                  <div className="text-sm font-semibold" style={{ color: card.highlight ? '#A78BFA' : 'rgba(255,255,255,0.5)' }}>{card.label}</div>
                  <div className="mt-3 text-4xl font-bold" style={{ color: card.highlight ? '#FFFFFF' : 'rgba(255,255,255,0.7)', letterSpacing: '-1px' }}>
                    {card.price}
                    <span className="text-base font-normal" style={{ color: 'rgba(255,255,255,0.4)' }}>/mois</span>
                  </div>
                  <p className="mt-3 text-sm" style={{ color: 'rgba(255,255,255,0.58)' }}>{card.note}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <p className="text-2xl font-bold text-white">
                Économisez jusqu'à <span style={{ color: '#C4B5FD' }}>720$/an</span> avec Nivra.
              </p>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="px-6 py-16 max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {[
              { Icon: Wifi, title: "GIGA 940 Mbps", body: "Fibre/coax sur infrastructure certifiée — même qualité que les grands réseaux." },
              { Icon: Shield, title: "Sans contrat", body: "Annulable en tout temps, aucune pénalité." },
              { Icon: MapPin, title: "Support québécois", body: "Équipe locale en français." },
            ].map(({ Icon, title, body }) => (
              <div key={title}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.3)' }}>
                  <Icon className="w-6 h-6" style={{ color: '#A78BFA' }} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.62)' }}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 py-16" style={{ background: '#020209' }}>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-white" style={{ letterSpacing: '-0.8px' }}>Questions fréquentes</h2>
            <div className="mt-10 space-y-4">
              {[
                {
                  q: "C'est vraiment 60$/mois sans frais cachés?",
                  a: "Oui. 60$/mois TPS+TVQ incluses, sans frais d'activation, sans frais de matériel mensuel. Vous payez la borne WiFi 60$ une fois si vous n'en avez pas.",
                },
                {
                  q: "Pas de vérification de crédit, comment c'est possible?",
                  a: "On utilise le mode prépayé sur réseau certifié. Vous payez d'avance, donc aucun risque de notre côté. Tout le monde est accepté.",
                },
                {
                  q: "C'est quoi la couverture?",
                  a: "Dans toutes les grandes villes du Québec — Montréal, Laval, Longueuil, Québec, Sherbrooke, Trois-Rivières et beaucoup d'autres villes. Vérifiez votre adresse sur notre carte de couverture.",
                },
                {
                  q: "Combien de temps pour l'installation?",
                  a: "Habituellement 3 à 7 jours ouvrables. Un technicien certifié passe à votre domicile (frais inclus).",
                },
              ].map((item) => (
                <details key={item.q} className="rounded-xl p-5 group cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                  <summary className="font-semibold text-white cursor-pointer flex items-center justify-between">
                    {item.q}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default InternetPasCherQuebec;
