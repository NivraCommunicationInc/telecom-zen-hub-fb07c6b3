import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Calendar, Clock, CheckCircle, Mail, MapPin, MessageSquare } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import ContactForm from "@/components/ContactForm";
import { Button } from "@/components/ui/button";
import { COMPANY_CONTACT } from "@/config/company";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";
import { LocalBusinessSchema } from "@/components/seo";
import { Link } from "react-router-dom";

const Contact = () => {
  const { language } = useLanguage();
  const isFrench = language === 'fr';
  const { data: siteSettings } = useSiteSettings();

  // Use site_settings as source of truth, COMPANY_CONTACT as fallback
  const supportEmail = siteSettings?.support_email || COMPANY_CONTACT.supportEmailDisplay;
  const address = siteSettings?.address || COMPANY_CONTACT.fullAddress;
  const businessHours = siteSettings?.business_hours || COMPANY_CONTACT.supportHours;

  const supportBenefits = [
    {
      icon: Clock,
      text: isFrench ? "Réponse tickets: 1h à 24h" : "Ticket response: 1h to 24h"
    },
    {
      icon: CheckCircle,
      text: isFrench ? "Suivi clair de votre demande" : "Clear tracking of your request"
    },
    {
      icon: MessageSquare,
      text: isFrench ? "Chat live selon disponibilité" : "Live chat based on availability"
    },
    {
      icon: Mail,
      text: isFrench ? "Assistance par courriel" : "Email assistance"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead {...SEO_DATA.contact} />
      <LocalBusinessSchema />
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-12 bg-gradient-to-b from-primary to-background">
        <div className="container mx-auto px-4 text-center">
          {/* Phone number prominent */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-2">
              {isFrench ? "Support téléphonique" : "Phone Support"}
            </p>
            <a href="tel:+18336487222" className="text-3xl md:text-4xl font-extrabold text-white hover:text-accent transition-colors">
              1-833-NIVRA-CA
            </a>
            <p className="text-sm text-white/60 mt-2">
              {isFrench ? "Lundi–Dimanche, 8h00–20h00 (HE)" : "Monday–Sunday, 8:00 AM–8:00 PM (ET)"}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
            <CheckCircle className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-accent">
              {isFrench ? "Support client réactif" : "Responsive Customer Support"}
            </span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            {isFrench ? "Nous sommes là pour vous aider" : "We're Here to Help"}
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            {isFrench 
              ? "Ouverture de demande, assistance, activation ou problème technique — notre équipe vous répond rapidement."
              : "Service requests, assistance, activation or technical issues — our team responds quickly."}
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Support Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-xl p-6 sticky top-24">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground">
                      {isFrench ? `Support ${COMPANY_CONTACT.companyName}` : `${COMPANY_CONTACT.companyName} Support`}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {isFrench ? "Réponse rapide garantie" : "Fast response guaranteed"}
                    </p>
                  </div>
                </div>

                {/* Support Benefits */}
                <div className="space-y-4 mb-6">
                  {supportBenefits.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <benefit.icon className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{benefit.text}</span>
                    </div>
                  ))}
                </div>

                {/* Trust Message */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 mb-6">
                  <p className="text-sm text-emerald-600 font-medium">
                    {isFrench 
                      ? "✓ Aucun frais caché • Suivi clair • Support local" 
                      : "✓ No hidden fees • Clear tracking • Local support"}
                  </p>
                </div>

                <div className="border-t border-border pt-6 space-y-4">
                  <h4 className="font-medium text-foreground mb-3">
                    {isFrench ? "Nous joindre" : "Contact us"}
                  </h4>
                  
                  <Button variant="default" className="w-full justify-start gap-3" asChild>
                    <Link to="/portal/auth">
                      <MessageSquare className="w-4 h-4" />
                      <span>{isFrench ? "Chat / Ouvrir un ticket" : "Chat / Open a ticket"}</span>
                    </Link>
                  </Button>
                  
                  <Button variant="outline" className="w-full justify-start gap-3" asChild>
                    <a href={`mailto:${supportEmail.toLowerCase()}`}>
                      <Mail className="w-4 h-4 text-accent" />
                      <span>{supportEmail}</span>
                    </a>
                  </Button>
                  
                  <div className="flex items-start gap-3 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                    <MapPin className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    <span>{address}</span>
                  </div>
                  
                  <div className="flex items-start gap-3 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                    <Clock className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    <div>
                      <p>{businessHours}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-xl p-6 md:p-8">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    {isFrench ? "Envoyez-nous votre demande" : "Send us your request"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {isFrench 
                      ? "Activation, installation, changement de service ou support technique — décrivez votre besoin."
                      : "Activation, installation, service change or technical support — describe your needs."}
                  </p>
                </div>
                <ContactForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;