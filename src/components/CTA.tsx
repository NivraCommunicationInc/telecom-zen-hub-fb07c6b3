import { Button } from "@/components/ui/button";
import { Phone, Clock } from "lucide-react";
import ContactForm from "./ContactForm";
import { useLanguage } from "@/contexts/LanguageContext";

const CTA = () => {
  const { t } = useLanguage();

  return (
    <section id="contact" className="py-20 md:py-32 bg-hero relative overflow-hidden bg-layered">
      {/* 3D Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl float-3d" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-400/5 rounded-full blur-3xl float-3d-delayed" />
        
        {/* 3D Geometric Accents */}
        <div className="absolute top-20 left-20 w-20 h-20 border border-cyan-500/10 rounded-xl rotate-12 float-3d opacity-50" />
        <div className="absolute bottom-20 right-20 w-16 h-16 border border-cyan-400/10 rounded-lg -rotate-12 float-3d-delayed opacity-40" />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-6xl mx-auto">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            {/* Badge with 3D Effect */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-premium mb-8 card-3d">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-cyan-300">{t('cta.badge')}</span>
            </div>

            {/* Heading with 3D Text */}
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6 text-3d-dark">
              {t('cta.title.order')}
            </h2>
            <p className="text-lg md:text-xl text-cyan-100/70 mb-8">
              {t('cta.subtitle.order')}
            </p>

            {/* Phone CTA with 3D Button */}
            <div className="flex items-center justify-center lg:justify-start gap-4 mb-6">
              <Button variant="heroOutline" size="lg" className="gap-2 btn-3d" asChild>
                <a href="tel:+14385442233">
                  <Phone className="w-5 h-5" />
                  438-544-2233
                </a>
              </Button>
            </div>

            {/* Trust Note */}
            <p className="text-sm text-cyan-100/50">
              {t('contact.success.text')}
            </p>
          </div>

          {/* Right - Contact Form with 3D Card */}
          <div className="card-3d">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
