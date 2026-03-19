import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowRight, Shield, Zap, Clock } from "lucide-react";
import ContactForm from "./ContactForm";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

const CTA = () => {
  const { t, language } = useLanguage();
  const isFrench = language === 'fr';

  return (
    <section id="contact" className="py-20 bg-primary relative overflow-hidden">
      {/* Subtle background accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-1/3 h-1/2 bg-gradient-to-bl from-white/5 to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/4 h-1/3 bg-gradient-to-tr from-white/3 to-transparent" />
      </div>

      <div className="container mx-auto px-4 relative max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left Content */}
          <div className="text-center lg:text-left lg:pt-8">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-5 leading-tight">
              {t('cta.title.order')}
            </h2>
            <p className="text-primary-foreground/70 mb-8 max-w-md mx-auto lg:mx-0 leading-relaxed text-lg">
              {t('cta.subtitle.order')}
            </p>

            {/* Trust micro-indicators */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-5 mb-8">
              {[
                { icon: Shield, text: isFrench ? "Sans contrat" : "No contract" },
                { icon: Zap, text: isFrench ? "Activation rapide" : "Fast activation" },
                { icon: Clock, text: isFrench ? "Support 7j/7" : "24/7 support" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 text-sm text-primary-foreground/60">
                  <item.icon className="w-4 h-4" />
                  <span className="font-medium">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-5">
              <Button 
                className="bg-white text-primary hover:bg-white/90 rounded-full px-8 h-12 font-bold gap-2 text-base shadow-lg"
                asChild
              >
                <Link to="/portal/auth">
                  <MessageSquare className="w-4 h-4" />
                  {isFrench ? "Chat / Ouvrir un ticket" : "Chat / Open a ticket"}
                </Link>
              </Button>
            </div>

            <p className="text-sm text-primary-foreground/40">
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
