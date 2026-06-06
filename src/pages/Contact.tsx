import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Clock, CheckCircle, Mail, MessageSquare, ArrowRight } from "lucide-react";
import { PhotoBg } from "@/components/PhotoBg";
import { useLanguage } from "@/contexts/LanguageContext";
import ContactForm from "@/components/ContactForm";
import { COMPANY_CONTACT } from "@/config/company";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";
import { LocalBusinessSchema } from "@/components/seo";
import { Link } from "react-router-dom";

const BG = '#020209';
const PURPLE = '#7C3AED';

const Contact = () => {
  const { language } = useLanguage();
  const isFrench = language === 'fr';
  const { data: siteSettings } = useSiteSettings();

  const supportEmail = siteSettings?.support_email || COMPANY_CONTACT.supportEmailDisplay;
  const businessHours = siteSettings?.business_hours || COMPANY_CONTACT.supportHours;

  const supportBenefits = [
    { icon: Clock, text: isFrench ? "Réponse par courriel: 2h ouvrables" : "Email response: 2 business hours", color: '#A78BFA' },
    { icon: CheckCircle, text: isFrench ? "Suivi clair de votre demande" : "Clear tracking of your request", color: '#10B981' },
    { icon: MessageSquare, text: isFrench ? "Chat live selon disponibilité" : "Live chat based on availability", color: '#06B6D4' },
    { icon: Mail, text: isFrench ? "Assistance par courriel" : "Email assistance", color: '#A78BFA' },
  ];

  return (
    <div style={{ background: BG, minHeight: '100vh' }} className="relative overflow-hidden">
      <PhotoBg url="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=80" opacity={0.08} filter="saturate(0.6) brightness(0.6)" />
      <div aria-hidden style={{ position: 'absolute', top: '-10%', right: '-8%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-10%', left: '-6%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.05) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <SEOHead {...SEO_DATA.contact} />
      <LocalBusinessSchema />
      <Header />

      {/* ── Hero ── */}
      <section style={{ paddingTop: 110, paddingBottom: 64, position: 'relative', overflow: 'hidden' }}>
        {/* Server room blue glow — reliable infrastructure behind our support */}
        <PhotoBg url="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=80" opacity={0.13} filter="saturate(0.6) brightness(0.6)" />
        <div aria-hidden style={{ position: 'absolute', top: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.25) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), rgba(6,182,212,0.5), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />

        <div className="max-w-[1100px] mx-auto px-5 sm:px-10 text-center relative">
          <div className="n-animate-in inline-flex items-center gap-2.5 mb-8" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 999, padding: '7px 18px' }}>
            <CheckCircle className="w-3.5 h-3.5" style={{ color: '#10B981' }} />
            <span style={{ color: '#A78BFA', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>
              {isFrench ? 'Support client réactif' : 'Responsive Customer Support'}
            </span>
          </div>

          <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(40px, 6vw, 68px)', letterSpacing: '-2.5px', lineHeight: 1.0, marginBottom: 16, color: '#fff' }}>
            {isFrench ? (
              <><span>Écrivez-</span><span className="n-shimmer-text">nous</span></>
            ) : (
              <><span>Write </span><span className="n-shimmer-text">to Us</span></>
            )}
          </h1>
          <p className="n-animate-in-delay-2" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, lineHeight: 1.7, maxWidth: 480, margin: '0 auto' }}>
            {isFrench
              ? "Nous vous répondons par courriel dans les 2 heures ouvrables."
              : "We respond by email within 2 business hours."}
          </p>
        </div>
      </section>

      {/* ── Main Content ── */}
      <section style={{ paddingBottom: 80 }}>
        <div className="max-w-[1100px] mx-auto px-5 sm:px-10">
          <div className="grid lg:grid-cols-3 gap-8">

            {/* ── Sidebar ── */}
            <div className="lg:col-span-1">
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '28px', position: 'sticky', top: 90, backdropFilter: 'blur(16px)' }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
                    <Mail className="w-6 h-6" style={{ color: '#A78BFA' }} />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: '#fff' }}>
                      {isFrench ? `Support ${COMPANY_CONTACT.companyName}` : `${COMPANY_CONTACT.companyName} Support`}
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                      {isFrench ? 'Réponse rapide garantie' : 'Fast response guaranteed'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                  {supportBenefits.map((b, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: 8, background: `${b.color}15`, border: `1px solid ${b.color}30` }}>
                        <b.icon className="w-3.5 h-3.5" style={{ color: b.color }} />
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{b.text}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 12, padding: '12px 14px', marginBottom: 24 }}>
                  <p style={{ color: '#A78BFA', fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                    {isFrench ? '✓ Aucun frais caché · Suivi clair · Support local' : '✓ No hidden fees · Clear tracking · Local support'}
                  </p>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <h4 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                    {isFrench ? 'Nous joindre' : 'Contact us'}
                  </h4>

                  <Link to="/portal/auth" style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, paddingLeft: 16, paddingRight: 16, borderRadius: 10, background: PURPLE, color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: "'Space Grotesk', sans-serif", textDecoration: 'none', boxShadow: '0 4px 20px rgba(124,58,237,0.4)', transition: 'box-shadow .2s' }}>
                    <MessageSquare className="w-4 h-4" />
                    {isFrench ? 'Chat / Ouvrir un ticket' : 'Chat / Open a ticket'}
                    <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                  </Link>

                  <a href={`mailto:${supportEmail.toLowerCase()}`} style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, paddingLeft: 16, paddingRight: 16, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: "'JetBrains Mono', monospace", textDecoration: 'none', transition: 'background .2s' }}>
                    <Mail className="w-4 h-4" style={{ color: '#A78BFA' }} />
                    {supportEmail}
                  </a>

                  <div className="flex items-start gap-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
                    <Clock className="w-4 h-4 flex-shrink-0" style={{ color: '#A78BFA', marginTop: 1 }} />
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.5 }}>{businessHours}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Contact Form ── */}
            <div className="lg:col-span-2">
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '32px', backdropFilter: 'blur(16px)' }}>
                <div style={{ marginBottom: 24 }}>
                  <p className="n-label" style={{ marginBottom: 8 }}>
                    {isFrench ? 'Formulaire de contact' : 'Contact form'}
                  </p>
                  <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 24, letterSpacing: '-0.5px', color: '#fff', marginBottom: 8 }}>
                    {isFrench ? 'Envoyez-nous votre demande' : 'Send us your request'}
                  </h2>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
                    {isFrench
                      ? 'Activation, installation, changement de service ou support technique — décrivez votre besoin.'
                      : 'Activation, installation, service change or technical support — describe your needs.'}
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
