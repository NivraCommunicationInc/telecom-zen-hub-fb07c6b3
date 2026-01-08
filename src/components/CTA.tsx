import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import ContactForm from "./ContactForm";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { COMPANY_CONTACT } from "@/config/company";

const CTA = () => {
  const { t } = useLanguage();
  const { data: siteSettings } = useSiteSettings();
  
  // Use site_settings as source of truth, COMPANY_CONTACT as fallback
  const supportPhone = siteSettings?.support_phone || COMPANY_CONTACT.supportPhoneDisplay;

  return (
    <section id="contact" className="section-padding bg-primary relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl" />
      </div>


      <div className="container mx-auto px-4 relative max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          {/* Left Content */}
          <div className="text-center lg:text-left lg:pt-8">
            <span className="inline-block px-3 py-1 rounded-full bg-accent/15 text-accent text-xs font-semibold mb-4">
              {t('cta.badge')}
            </span>

            <h2 className="text-white mb-4">
              {t('cta.title.order')}
            </h2>
            <p className="text-white/70 mb-6 max-w-md mx-auto lg:mx-0 leading-relaxed">
              {t('cta.subtitle.order')}
            </p>

            {/* Phone CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-5">
              <Button 
                variant="heroOutline" 
                size="default" 
                className="gap-2" 
                asChild
              >
                <a href={`tel:+1${supportPhone.replace(/[^+\d]/g, '')}`}>
                  <Phone className="w-4 h-4" />
                  {t('cta.phone')}
                </a>
              </Button>
            </div>

            {/* Response time */}
            <p className="text-xs text-white/50">
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