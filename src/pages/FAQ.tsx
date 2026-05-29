import { useMemo } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import SEOHead from "@/components/SEOHead";
import { FAQSchema, BreadcrumbSchema } from "@/components/seo";

const FAQ = () => {
  const { t, language } = useLanguage();
  const isFr = language === 'fr';

  const categories = [
    {
      title: isFr ? 'Forfaits & Prix' : 'Plans & Pricing',
      questions: [
        {
          q: isFr ? 'Combien coûte Internet sans contrat au Québec avec Nivra Telecom ?' : 'How much does no-contract Internet cost in Quebec with Nivra Telecom?',
          a: isFr ? 'Nos forfaits Internet sans contrat débutent à 45$/mois taxes incluses. Contrairement à Bell et Vidéotron, le prix affiché est le prix réel — aucuns frais cachés, aucune augmentation après 12 mois.' : 'Our no-contract Internet plans start at $45/month taxes included. Unlike Bell and Vidéotron, the price shown is the real price — no hidden fees, no increase after 12 months.',
        },
        {
          q: isFr ? 'Est-ce que Nivra Telecom est moins cher que Bell ou Vidéotron ?' : 'Is Nivra Telecom cheaper than Bell or Vidéotron?',
          a: isFr ? 'Oui. En moyenne, nos clients économisent entre 20$ et 45$ par mois par rapport à Bell et Vidéotron pour une vitesse équivalente. Sans compter l\'absence de frais de résiliation et de contrat de 2 ans.' : 'Yes. On average, our customers save between $20 and $45 per month compared to Bell and Vidéotron for equivalent speeds. Not to mention the absence of cancellation fees and 2-year contracts.',
        },
        {
          q: isFr ? 'Y a-t-il des frais d\'installation ou d\'activation ?' : 'Are there installation or activation fees?',
          a: isFr ? 'Non. L\'activation se fait entièrement en ligne en 10 minutes. Aucuns frais de technicien, aucuns frais d\'installation. La borne Nivra WiFi est livrée à votre domicile.' : 'No. Activation is done entirely online in 10 minutes. No technician fees, no installation fees. The Nivra WiFi modem is delivered to your home.',
        },
        {
          q: isFr ? 'Puis-je garder mon numéro de téléphone si je change pour Nivra ?' : 'Can I keep my phone number if I switch to Nivra?',
          a: isFr ? 'Oui. Le transfert de numéro (portabilité) est gratuit et géré par notre équipe. Vous conservez votre numéro existant.' : 'Yes. Number transfer (portability) is free and managed by our team. You keep your existing number.',
        },
      ],
    },
    {
      title: isFr ? 'Sans contrat' : 'No Contract',
      questions: [
        {
          q: isFr ? 'Qu\'est-ce que ça veut dire "sans contrat" ?' : 'What does "no contract" mean?',
          a: isFr ? 'Chez Nivra Telecom, il n\'y a aucun engagement de durée minimale. Vous pouvez annuler, changer de forfait ou déménager à tout moment sans payer de frais de résiliation. Votre service est prépayé mois par mois.' : 'At Nivra Telecom, there is no minimum commitment. You can cancel, change your plan, or move at any time without paying cancellation fees. Your service is prepaid month by month.',
        },
        {
          q: isFr ? 'Comment annuler mon service Nivra Telecom ?' : 'How do I cancel my Nivra Telecom service?',
          a: isFr ? 'L\'annulation se fait directement depuis votre espace client en ligne, en moins de 2 minutes. Aucun appel nécessaire, aucuns frais. Vous recevez un remboursement au prorata pour les jours non utilisés.' : 'Cancellation is done directly from your online account in less than 2 minutes. No call needed, no fees. You receive a prorated refund for unused days.',
        },
        {
          q: isFr ? 'Puis-je changer de forfait en cours de mois ?' : 'Can I change my plan mid-month?',
          a: isFr ? 'Oui, vous pouvez changer de forfait à tout moment depuis votre espace client. Le changement est effectif immédiatement et la différence de prix est calculée au prorata.' : 'Yes, you can change your plan at any time from your account. The change is effective immediately and the price difference is prorated.',
        },
      ],
    },
    {
      title: isFr ? 'Service & Couverture' : 'Service & Coverage',
      questions: [
        {
          q: isFr ? 'Dans quelles régions du Québec Nivra Telecom est-il disponible ?' : 'In which Quebec regions is Nivra Telecom available?',
          a: isFr ? 'Nivra Telecom est disponible dans les principales régions du Québec incluant Montréal, Laval, Longueuil, Brossard, la Rive-Sud, Québec, Sherbrooke, Gatineau et leurs environs. Vérifiez la disponibilité à votre adresse sur notre page forfaits.' : 'Nivra Telecom is available in major Quebec regions including Montreal, Laval, Longueuil, Brossard, South Shore, Quebec City, Sherbrooke, Gatineau and surrounding areas. Check availability at your address on our plans page.',
        },
        {
          q: isFr ? 'Quelle est la vitesse Internet disponible chez Nivra Telecom ?' : 'What Internet speeds are available at Nivra Telecom?',
          a: isFr ? 'Nous offrons des forfaits de 100 Mbps, 500 Mbps et GIGA (1 010 Mbps) selon votre région. La vitesse est symétrique sur certains forfaits fibre optique.' : 'We offer plans of 100 Mbps, 500 Mbps and GIGA (1,010 Mbps) depending on your region. Speed is symmetric on some fiber plans.',
        },
        {
          q: isFr ? 'Nivra Telecom offre-t-il la télévision ?' : 'Does Nivra Telecom offer television?',
          a: isFr ? 'Oui. Nous offrons des forfaits TV avec plus de 100 chaînes canadiennes et québécoises, incluant les chaînes francophones, les sports et les chaînes spécialisées. Disponible en combiné avec Internet ou séparément.' : 'Yes. We offer TV packages with over 100 Canadian and Quebec channels, including French-language, sports, and specialty channels. Available bundled with Internet or separately.',
        },
      ],
    },
    {
      title: isFr ? 'Équipement' : 'Equipment',
      questions: [
        {
          q: isFr ? "Est-ce que l'équipement Internet est inclus dans le forfait ?" : "Is Internet equipment included in the plan?",
          a: isFr ? "Non. La borne Nivra WiFi est obligatoire pour activer votre service Internet et s'achète une seule fois au prix de 60$. Elle vous appartient et il n'y a pas de frais mensuels. Le forfait mensuel couvre uniquement le service Internet." : "No. The Nivra WiFi modem is mandatory to activate your Internet service and is purchased once for $60. You own it and there are no monthly fees. The monthly plan covers Internet service only.",
        },
        {
          q: isFr ? "Combien coûtent les terminaux TV Nivra ?" : "How much do Nivra TV terminals cost?",
          a: isFr ? "Chaque terminal Nivra coûte 50$ à l'achat (frais unique). Vous pouvez avoir de 1 à 4 terminaux selon le nombre de télévisions dans votre domicile. Un forfait Internet actif est requis pour accéder à la télévision." : "Each Nivra terminal costs $50 (one-time fee). You can have 1 to 4 terminals depending on the number of TVs in your home. An active Internet plan is required to access TV.",
        },
        {
          q: isFr ? "Est-ce que la carte SIM est incluse dans le forfait mobile ?" : "Is the SIM card included in the mobile plan?",
          a: isFr ? "Non. La carte SIM Nivra est obligatoire pour activer votre forfait mobile et coûte 30$ à l'achat (frais unique). Elle vous appartient et fonctionne exclusivement avec les forfaits Nivra Mobile." : "No. The Nivra SIM card is mandatory to activate your mobile plan and costs $30 (one-time fee). You own it and it works exclusively with Nivra Mobile plans.",
        },
        {
          q: isFr ? "Combien de lignes mobiles puis-je avoir avec Nivra ?" : "How many mobile lines can I have with Nivra?",
          a: isFr ? "Vous pouvez avoir un maximum de 3 lignes mobiles par compte. Chaque ligne nécessite sa propre carte SIM Nivra à 30$." : "You can have a maximum of 3 mobile lines per account. Each line requires its own Nivra SIM card at $30.",
        },
      ],
    },
    {
      title: isFr ? 'Support technique' : 'Technical Support',
      questions: [
        {
          q: isFr ? 'Comment contacter le support de Nivra Telecom ?' : 'How do I contact Nivra Telecom support?',
          a: isFr ? 'Notre support est disponible en français et en anglais, 7 jours sur 7 de 8h à 20h, par courriel à support@nivra-telecom.ca ou par chat en direct sur notre site. Temps de réponse moyen : moins de 2 heures.' : 'Our support is available in French and English, 7 days a week from 8am to 8pm, by email at support@nivra-telecom.ca or live chat on our website. Average response time: under 2 hours.',
        },
        {
          q: isFr ? 'Que faire si ma connexion Internet est lente ou coupée ?' : 'What should I do if my Internet is slow or down?',
          a: isFr ? 'Commencez par redémarrer votre modem (débrancher 30 secondes). Si le problème persiste, connectez-vous à votre espace client pour diagnostiquer votre ligne en temps réel ou contactez notre support technique disponible 7j/7.' : 'Start by restarting your modem (unplug for 30 seconds). If the problem persists, log in to your account to diagnose your line in real time or contact our technical support available 7 days a week.',
        },
      ],
    },
    {
      title: t('faq.cat.payments'),
      questions: [
        { q: t('faq.pay.q1'), a: t('faq.pay.a1') },
        { q: t('faq.pay.q2'), a: t('faq.pay.a2') },
        { q: t('faq.pay.q3'), a: t('faq.pay.a3') },
      ],
    },
    {
      title: t('faq.cat.security'),
      questions: [
        { q: t('faq.sec.q1'), a: t('faq.sec.a1') },
        { q: t('faq.sec.q2'), a: t('faq.sec.a2') },
        { q: t('faq.sec.q3'), a: t('faq.sec.a3') },
      ],
    },
  ];

  // Flatten FAQs for schema
  const allFaqs = useMemo(() => 
    categories.flatMap((cat) => 
      cat.questions.map((q) => ({ question: q.q, answer: q.a }))
    ), 
    [categories]
  );

  const BG = '#080612';
  const PURPLE = '#7C3AED';

  return (
    <div style={{ background: BG, minHeight: '100vh' }}>
      <SEOHead
        title={isFr ? "FAQ — Internet sans contrat au Québec | Nivra Telecom" : "FAQ — No-Contract Internet in Quebec | Nivra Telecom"}
        description={isFr ? "Réponses aux questions fréquentes sur les forfaits Internet et TV sans contrat de Nivra Telecom au Québec. Prix, couverture, activation, support." : "Answers to frequently asked questions about Nivra Telecom no-contract Internet and TV plans in Quebec. Pricing, coverage, activation, support."}
      />
      <FAQSchema faqs={allFaqs} pageUrl="https://nivra-telecom.ca/faq" />
      <BreadcrumbSchema />
      <Header />

      {/* ── Hero ── */}
      <section style={{ background: 'linear-gradient(160deg, #080612 0%, #11082A 55%, #0C0C18 100%)', paddingTop: 96, paddingBottom: 72, position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div aria-hidden className="absolute pointer-events-none" style={{ top: -160, right: -80, width: 500, height: 500, background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.18) 0%, transparent 65%)' }} />

        <div className="max-w-[860px] mx-auto px-5 sm:px-10 text-center relative">
          <div className="inline-flex items-center gap-2 mb-6" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 999, padding: '6px 16px' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#A78BFA' }} />
            <span style={{ color: '#C4B5FD', fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
              {isFr ? 'Centre d\'aide' : 'Help Center'}
            </span>
          </div>
          <h1 className="font-black text-white" style={{ fontSize: 'clamp(32px, 5vw, 54px)', letterSpacing: '-1.5px', lineHeight: 1.05, marginBottom: 16 }}>
            {t('faq.title')}{' '}
            <span style={{ background: 'linear-gradient(90deg, #A78BFA 0%, #7C3AED 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              {t('faq.title2')}
            </span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, lineHeight: 1.65, maxWidth: 500, margin: '0 auto' }}>
            {t('faq.subtitle')}
          </p>
        </div>
      </section>

      {/* ── FAQ Content ── */}
      <section style={{ padding: '72px 0', background: BG }}>
        <div className="max-w-[760px] mx-auto px-5 sm:px-10">
          {categories.map((category, ci) => (
            <div key={category.title} style={{ marginBottom: 52 }}>
              <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
                <div style={{ width: 3, height: 22, background: PURPLE, borderRadius: 99 }} />
                <h2 className="font-bold text-white" style={{ fontSize: 18 }}>{category.title}</h2>
              </div>
              <Accordion type="single" collapsible className="space-y-2">
                {category.questions.map((item, index) => (
                  <AccordionItem
                    key={index}
                    value={`${ci}-${index}`}
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '0 20px' }}
                    className="border-0"
                  >
                    <AccordionTrigger className="text-left font-semibold py-4 hover:no-underline" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent style={{ color: 'rgba(255,255,255,0.58)', fontSize: 14, lineHeight: 1.7, paddingBottom: 16 }}>
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: 'rgba(124,58,237,0.08)', borderTop: '1px solid rgba(124,58,237,0.2)', padding: '72px 24px' }}>
        <div className="max-w-[560px] mx-auto text-center">
          <div className="flex items-center justify-center mx-auto mb-6" style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)' }}>
            <MessageSquare className="w-6 h-6" style={{ color: '#A78BFA' }} />
          </div>
          <h2 className="font-bold text-white" style={{ fontSize: 24, letterSpacing: '-0.5px', marginBottom: 12 }}>
            {t('faq.notfound.title')}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, lineHeight: 1.6, marginBottom: 28 }}>
            {t('faq.notfound.text')}
          </p>
          <Link to="/#contact">
            <button style={{ height: 50, paddingLeft: 32, paddingRight: 32, borderRadius: 10, background: PURPLE, color: '#FFFFFF', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(124,58,237,0.45)' }}>
              {t('faq.contact')}
            </button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default FAQ;