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

  const PURPLE = '#7C3AED';

  return (
    <div style={{ background: '#080612', minHeight: '100vh' }}>
      <SEOHead {...SEO_DATA.contact} />
      <LocalBusinessSchema />
      <Header />

      {/* ── Hero ── */}
      <section style={{ background: 'linear-gradient(160deg, #080612 0%, #11082A 55%, #0C0C18 100%)', paddingTop: 96, paddingBottom: 64, position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div aria-hidden className="absolute pointer-events-none" style={{ top: -140, right: -80, width: 500, height: 500, background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.18) 0%, transparent 65%)' }} />
        <div className="max-w-[900px] mx-auto px-5 sm:px-10 text-center relative">
          <div className="inline-flex items-center gap-2 mb-6" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 999, padding: '6px 16px' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#A78BFA' }} />
            <span style={{ color: '#C4B5FD', fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
              {isFrench ? 'Support client réactif' : 'Responsive Customer Support'}
            </span>
          </div>
          <h1 className="font-black text-white" style={{ fontSize: 'clamp(32px, 5vw, 54px)', letterSpacing: '-1.5px', lineHeight: 1.05, marginBottom: 16 }}>
            {isFrench ? 'Écrivez-nous' : 'Write to Us'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, lineHeight: 1.65, maxWidth: 480, margin: '0 auto' }}>
            {isFrench
              ? 'Nous vous répondons par courriel dans les 2 heures ouvrables.'
              : 'We respond by email within 2 business hours.'}
          </p>
        </div>
      </section>

      {/* ── Main Content ── */}
      <section style={{ padding: '64px 0 80px', background: '#080612' }}>
        <div className="max-w-[1100px] mx-auto px-5 sm:px-10">
          <div className="grid lg:grid-cols-3 gap-8">

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28 }}>
                <div className="flex items-center gap-3 mb-7">
                  <div className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', flexShrink: 0 }}>
                    <Mail className="w-5 h-5" style={{ color: '#A78BFA' }} />
                  </div>
                  <div>
                    <p className="font-bold text-white" style={{ fontSize: 15 }}>
                      {isFrench ? `Support ${COMPANY_CONTACT.companyName}` : `${COMPANY_CONTACT.companyName} Support`}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                      {isFrench ? 'Réponse rapide garantie' : 'Fast response guaranteed'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
                  {supportBenefits.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <benefit.icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#A78BFA' }} />
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{benefit.text}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 24 }}>
                  <p style={{ color: '#C4B5FD', fontSize: 13, fontWeight: 600 }}>
                    {isFrench ? '✓ Aucun frais caché · Suivi clair · Support local' : '✓ No hidden fees · Clear tracking · Local support'}
                  </p>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p className="font-semibold text-white" style={{ fontSize: 13, marginBottom: 4 }}>
                    {isFrench ? 'Nous joindre' : 'Contact us'}
                  </p>
                  <Link to="/portal/auth" className="flex items-center justify-center gap-2 font-bold" style={{ height: 46, borderRadius: 10, background: PURPLE, color: '#FFFFFF', fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 16px rgba(124,58,237,0.4)' }}>
                    <MessageSquare className="w-4 h-4" />
                    {isFrench ? 'Chat / Ouvrir un ticket' : 'Chat / Open a ticket'}
                  </Link>
                  <a href={`mailto:${supportEmail.toLowerCase()}`} className="flex items-center justify-center gap-2 font-semibold" style={{ height: 46, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', fontSize: 14, textDecoration: 'none' }}>
                    <Mail className="w-4 h-4" style={{ color: '#A78BFA' }} />
                    {supportEmail}
                  </a>
                  <div className="flex items-center gap-2" style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <Clock className="w-4 h-4 flex-shrink-0" style={{ color: '#A78BFA' }} />
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{businessHours}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-2">
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '32px 36px' }}>
                <h2 className="font-bold text-white" style={{ fontSize: 20, marginBottom: 6 }}>
                  {isFrench ? 'Envoyez-nous votre demande' : 'Send us your request'}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 28 }}>
                  {isFrench
                    ? 'Activation, installation, changement de service ou support technique — décrivez votre besoin.'
                    : 'Activation, installation, service change or technical support — describe your needs.'}
                </p>
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
