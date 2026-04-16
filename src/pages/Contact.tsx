import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Clock, CheckCircle, Mail, MessageSquare } from "lucide-react";
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

  const supportEmail = siteSettings?.support_email || COMPANY_CONTACT.supportEmailDisplay;
  const businessHours = siteSettings?.business_hours || COMPANY_CONTACT.supportHours;

  const supportBenefits = [
    {
      icon: Clock,
      text: isFrench ? "Réponse par courriel: 2h ouvrables" : "Email response: 2 business hours"
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
      <section className="pt-32 pb-12 bg-gradient-to-b from-[#0d0d1a] to-background">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#ede9fe] border border-[#6b21e8]/20 mb-6">
            <CheckCircle className="w-4 h-4 text-[#6b21e8]" />
            <span className="text-sm font-medium text-[#6b21e8]">
              {isFrench ? "Support client réactif" : "Responsive Customer Support"}
            </span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            {isFrench ? "Écrivez-nous" : "Write to Us"}
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            {isFrench 
              ? "Nous vous répondons par courriel dans les 2 heures ouvrables."
              : "We respond by email within 2 business hours."}
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
                  <div className="w-12 h-12 rounded-full bg-[#ede9fe] flex items-center justify-center">
                    <Mail className="w-6 h-6 text-[#6b21e8]" />
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
                      <benefit.icon className="w-5 h-5 text-[#6b21e8] mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{benefit.text}</span>
                    </div>
                  ))}
                </div>

                {/* Trust Message */}
                <div className="bg-[#ede9fe] border border-[#6b21e8]/20 rounded-lg p-4 mb-6">
                  <p className="text-sm text-[#6b21e8] font-medium">
                    {isFrench 
                      ? "✓ Aucun frais caché • Suivi clair • Support local" 
                      : "✓ No hidden fees • Clear tracking • Local support"}
                  </p>
                </div>

                <div className="border-t border-border pt-6 space-y-4">
                  <h4 className="font-medium text-foreground mb-3">
                    {isFrench ? "Nous joindre" : "Contact us"}
                  </h4>
                  
                  <Button variant="default" className="w-full justify-start gap-3" style={{ background: '#6b21e8' }} asChild>
                    <Link to="/portal/auth">
                      <MessageSquare className="w-4 h-4" />
                      <span>{isFrench ? "Chat / Ouvrir un ticket" : "Chat / Open a ticket"}</span>
                    </Link>
                  </Button>
                  
                  <Button variant="outline" className="w-full justify-start gap-3" asChild>
                    <a href={`mailto:${supportEmail.toLowerCase()}`}>
                      <Mail className="w-4 h-4 text-[#6b21e8]" />
                      <span>{supportEmail}</span>
                    </a>
                  </Button>
                  
                  <div className="flex items-start gap-3 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                    <Clock className="w-4 h-4 text-[#6b21e8] flex-shrink-0 mt-0.5" />
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
