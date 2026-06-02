import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/seo/SEO";
import SchemaMarkup from "@/components/seo/SchemaMarkup";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Shield, 
  CheckCircle2,
  MapPin,
  Mail,
  Clock,
  ChevronRight,
  Wifi,
  Tv,
  Smartphone,
  CreditCard,
  Users,
  Headphones,
  MessageSquare
} from "lucide-react";
import { COMPANY_CONTACT } from "@/config/company";
import Testimonials from "@/components/Testimonials";

const APropos = () => {
  const howItWorks = [
    { 
      step: "01", 
      title: "Commande", 
      description: "Choisissez vos services (Internet, TV, Mobile) et complétez votre commande en ligne." 
    },
    { 
      step: "02", 
      title: "Paiement", 
      description: "Payez par carte de crédit ou e-Transfer. Services prépayés — aucune vérification de crédit." 
    },
    { 
      step: "03", 
      title: "Activation", 
      description: "Activation rapide après confirmation du paiement. Livraison ou installation selon le service." 
    },
    { 
      step: "04", 
      title: "Support", 
      description: "Gérez vos services via le portail client. Support 7 jours sur 7." 
    },
  ];

  const whyNivra = [
    {
      icon: CreditCard,
      title: "Sans engagement",
      description: "Services prépayés, aucun contrat à long terme. Annulez quand vous voulez."
    },
    {
      icon: Shield,
      title: "Transparent",
      description: "Prix clairs, pas de frais cachés. Ce que vous voyez est ce que vous payez."
    },
    {
      icon: Users,
      title: "Portail client",
      description: "Gérez vos services, factures et tickets en ligne 24/7."
    },
    {
      icon: Headphones,
      title: "Support 7/7",
      description: "Équipe locale disponible par courriel, chat et portail."
    },
  ];

  const services = [
    { icon: Wifi, name: "Internet", desc: "Fibre haute vitesse" },
    { icon: Tv, name: "Télévision", desc: "IPTV 4K avec chaînes à la carte" },
    { icon: Smartphone, name: "Mobile", desc: "Forfaits voix/data flexibles" },
  ];

  return (
    <div style={{ background: "#020209", minHeight: "100vh" }}>
      <SEO
        title="À propos de Nivra Telecom | Fournisseur Internet Québec"
        description="Nivra Telecom est un fournisseur Internet et TV québécois qui offre des services prépayés sans contrat. Notre mission: rendre Internet accessible à tous."
        canonical="https://nivra-telecom.ca/a-propos"
      />
      <SchemaMarkup includeBrand />
      <Header />
      
      {/* ── Hero ── */}
      <section style={{ paddingTop: 110, paddingBottom: 80, position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', top: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.25) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-8%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), rgba(6,182,212,0.5), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />
        <div className="max-w-[860px] mx-auto px-5 sm:px-10 text-center relative">
          <div className="n-animate-in inline-flex items-center gap-2 mb-8" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 999, padding: '7px 18px' }}>
            <Shield className="w-3.5 h-3.5" style={{ color: '#A78BFA' }} />
            <span style={{ color: '#A78BFA', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>Fournisseur télécom québécois</span>
          </div>
          <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(36px, 5.5vw, 64px)', letterSpacing: '-2.5px', lineHeight: 1.0, marginBottom: 16, color: '#fff' }}>
            À propos de{' '}
            <span className="n-shimmer-text">{COMPANY_CONTACT.companyName}</span>
          </h1>
          <p className="n-animate-in-delay-2" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, lineHeight: 1.65, maxWidth: 560, margin: '0 auto' }}>
            <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{COMPANY_CONTACT.companyName}</strong> ({COMPANY_CONTACT.legalName}) — Services télécommunications prépayés au Québec. Simplicité, transparence et contrôle sur vos services.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="section-padding">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, letterSpacing: '-1.5px', color: '#fff' }}>Notre mission</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                <strong>{COMPANY_CONTACT.companyName}</strong> offre des services de téléphonie mobile prépayée, Internet, télévision et sécurité 
                au Québec. Notre approche : <strong>simplicité</strong>, <strong>transparence</strong> et 
                <strong> contrôle</strong> pour nos clients.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-foreground"><strong>Prépayé</strong> — Payez à l'avance, aucune surprise</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-foreground"><strong>Sans engagement</strong> — Annulez à tout moment</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-foreground"><strong>Aucune vérification de crédit</strong> — Accessible à tous</span>
                </li>
              </ul>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl bg-primary border border-border p-8 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
                    <span className="font-bold text-white text-4xl">N</span>
                  </div>
                  <p className="text-white font-semibold mb-1">{COMPANY_CONTACT.companyName}</p>
                  <p className="text-white/50 text-xs">{COMPANY_CONTACT.legalName}</p>
                  <p className="text-white/60 text-sm mt-1">Services prépayés au Québec</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section-padding bg-muted/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, letterSpacing: '-1.5px', color: '#fff' }}>Nos services</h2>
            <p className="text-muted-foreground">Des solutions télécoms complètes pour le Québec</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {services.map((service) => (
              <div key={service.name} className="bg-card border border-border rounded-2xl p-6 text-center hover:border-accent/30 transition-colors">
                <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <service.icon className="w-7 h-7 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{service.name}</h3>
                <p className="text-sm text-muted-foreground">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Zones desservies */}
      <section className="section-padding">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, letterSpacing: '-1.5px', color: '#fff' }}>Zones desservies</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Nous desservons principalement le <strong>Québec</strong>, avec une couverture optimale dans 
                la région du Grand Montréal. Livraison express disponible dans certaines zones.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm">
                  <MapPin className="w-4 h-4 text-accent" /> Montréal
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm">
                  <MapPin className="w-4 h-4 text-accent" /> Laval
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm">
                  <MapPin className="w-4 h-4 text-accent" /> Longueuil
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm">
                  <MapPin className="w-4 h-4 text-accent" /> Rive-Sud
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm">
                  <MapPin className="w-4 h-4 text-accent" /> Rive-Nord
                </span>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video rounded-2xl bg-primary border border-border overflow-hidden flex items-center justify-center">
                <div className="text-center p-8">
                  <MapPin className="w-12 h-12 text-accent/30 mx-auto mb-3" />
                  <p className="text-white/60 text-sm">Service partout au Québec</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pourquoi Nivra */}
      <section className="section-padding bg-muted/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, letterSpacing: '-1.5px', color: '#fff' }}>Pourquoi choisir {COMPANY_CONTACT.companyName}?</h2>
            <p className="text-muted-foreground">Ce qui nous différencie</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {whyNivra.map((item, index) => (
              <div 
                key={index} 
                className="flex gap-4 p-5 bg-card border border-border rounded-2xl hover:border-accent/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comment ça fonctionne */}
      <section className="section-padding">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, letterSpacing: '-1.5px', color: '#fff' }}>Comment ça fonctionne</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              4 étapes simples pour vos services télécoms
            </p>
          </div>
          
          {/* Desktop Timeline */}
          <div className="hidden md:block">
            <div className="relative">
              <div className="absolute top-8 left-0 right-0 h-px bg-border" />
              <div className="grid grid-cols-4 gap-5 relative">
                {howItWorks.map((step, index) => (
                  <div key={index} className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto mb-4 relative z-10 shadow-sm">
                      <span className="font-bold text-accent text-lg">{step.step}</span>
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Mobile Timeline */}
          <div className="md:hidden space-y-5">
            {howItWorks.map((step, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="font-bold text-accent">{step.step}</span>
                  </div>
                  {index < howItWorks.length - 1 && (
                    <div className="w-px h-full bg-border mt-2" />
                  )}
                </div>
                <div className="pb-5">
                  <h3 className="font-semibold text-foreground mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <Testimonials />

      {/* Contact */}
      <section className="section-padding bg-muted/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="bg-card border border-border rounded-2xl p-8">
            <h2 className="text-center mb-8" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, letterSpacing: '-1.5px', color: '#fff' }}>Nous joindre</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-6 h-6 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">Chat / Tickets</p>
                <Link to="/contact" className="font-medium text-primary hover:underline">Nous joindre</Link>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-6 h-6 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">Courriel</p>
                <p className="font-medium text-foreground">{COMPANY_CONTACT.supportEmailDisplay}</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-6 h-6 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">Heures de support</p>
                <p className="font-medium text-foreground text-sm">{COMPANY_CONTACT.supportHoursWeekday}</p>
                <p className="font-medium text-foreground text-sm">{COMPANY_CONTACT.supportHoursWeekend}</p>
              </div>
            </div>
            <div className="text-center mt-8">
              <Link to="/contact">
                <Button variant="hero" size="lg">
                  Contactez-nous
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default APropos;
