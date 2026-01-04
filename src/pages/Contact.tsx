import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Calendar, Clock, CheckCircle, Phone, Mail, MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import ContactForm from "@/components/ContactForm";
import { Button } from "@/components/ui/button";

const Contact = () => {
  const { t } = useLanguage();

  const benefits = [
    t('benefits.independent.desc'),
    t('benefits.simple.desc'),
    t('benefits.savings.desc'),
    t('benefits.support.desc'),
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-12 bg-gradient-to-b from-navy-900 to-background">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-300">{t('cta.badge')}</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
            {t('contact.title')}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('contact.subtitle')}
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Benefits Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-xl p-6 sticky top-24">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground">{t('contact.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('cta.badge')}</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-6 space-y-4">
                  <h4 className="font-medium text-foreground mb-3">Nous joindre</h4>
                  
                  <Button variant="outline" className="w-full justify-start gap-3" asChild>
                    <a href="tel:+14385442233">
                      <Phone className="w-4 h-4 text-cyan-400" />
                      <span>438-544-2233</span>
                    </a>
                  </Button>
                  
                  <Button variant="outline" className="w-full justify-start gap-3" asChild>
                    <a href="mailto:Nivratelecom@gmail.com">
                      <Mail className="w-4 h-4 text-cyan-400" />
                      <span>Nivratelecom@gmail.com</span>
                    </a>
                  </Button>
                  
                  <div className="flex items-center gap-3 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <span>Montréal, QC - Québec seulement</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-xl p-6 md:p-8">
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