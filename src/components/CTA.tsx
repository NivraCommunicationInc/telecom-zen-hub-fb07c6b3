import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import ContactForm from "./ContactForm";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

const CTA = () => {
  const { t, language } = useLanguage();
  const isFrench = language === 'fr';

  return (
    <section id="contact" className="section-padding bg-gradient-to-b from-primary to-navy-700 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-1/3 h-1/2 bg-gradient-to-bl from-accent/5 to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/4 h-1/3 bg-gradient-to-tr from-accent/3 to-transparent" />
      </div>

      <div className="container mx-auto px-4 relative max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          {/* Left Content */}
          <div className="text-center lg:text-left lg:pt-8">
            <span className="inline-block px-3 py-1 rounded-full bg-accent/15 text-accent text-xs font-semibold mb-4">
              {t('cta.badge')}
            </span>

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {t('cta.title.order')}
            </h2>
            <p className="text-white/80 mb-6 max-w-md mx-auto lg:mx-0 leading-relaxed text-lg">
              {t('cta.subtitle.order')}
            </p>

            {/* Chat CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-5">
              <Button 
                variant="heroOutline" 
                size="lg" 
                className="gap-2" 
                asChild
              >
                <Link to="/portal/auth">
                  <MessageSquare className="w-4 h-4" />
                  {isFrench ? "Chat / Ouvrir un ticket" : "Chat / Open a ticket"}
                </Link>
              </Button>
            </div>

            {/* Response time */}
            <p className="text-sm text-white/60">
              {isFrench ? "Réponse entre 1h et 24h • Chat live selon disponibilité" : "Response within 1h to 24h • Live chat based on availability"}
            </p>
          </div>

          {/* Right - Contact Form */}
          <div>
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;