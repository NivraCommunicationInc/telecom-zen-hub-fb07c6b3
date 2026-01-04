import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import ContactForm from "./ContactForm";
import { useLanguage } from "@/contexts/LanguageContext";

const CTA = () => {
  const { t } = useLanguage();

  const scrollToContact = () => {
    const form = document.querySelector('form');
    if (form) {
      form.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="contact" className="section-padding bg-hero relative overflow-hidden">
      {/* Background - Simplified */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/8 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start max-w-5xl mx-auto">
          {/* Left Content */}
          <div className="text-center lg:text-left lg:pt-8">
            <span className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-medium mb-4">
              {t('cta.badge')}
            </span>

            <h2 className="text-primary-foreground mb-3">
              {t('cta.title.order')}
            </h2>
            <p className="text-body text-cyan-100/60 mb-6 max-w-md mx-auto lg:mx-0">
              {t('cta.subtitle.order')}
            </p>

            {/* Phone CTA */}
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
              <Button 
                variant="heroOutline" 
                size="default" 
                className="gap-2 focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-primary" 
                onClick={scrollToContact}
              >
                {t('hero.cta.order')}
              </Button>
              <Button 
                variant="heroOutline" 
                size="default" 
                className="gap-2 focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-primary" 
                asChild
              >
                <a href="tel:+14385442233">
                  <Phone className="w-4 h-4" />
                  {t('cta.phone')}
                </a>
              </Button>
            </div>

            {/* Response time */}
            <p className="text-xs text-cyan-100/40">
              {t('contact.success.text')}
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