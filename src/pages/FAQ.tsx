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
          a: isFr ? 'Nos forfaits Internet sans contrat débutent à 39$/mois taxes incluses. Contrairement à Bell et Vidéotron, le prix affiché est le prix réel — aucuns frais cachés, aucune augmentation après 12 mois.' : 'Our no-contract Internet plans start at $39/month taxes included. Unlike Bell and Vidéotron, the price shown is the real price — no hidden fees, no increase after 12 months.',
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
          a: isFr ? 'Nous offrons des forfaits de 400 Mbps, 600 Mbps et 1 Gbps (1000 Mbps) selon votre région. La vitesse est symétrique sur certains forfaits fibre optique.' : 'We offer plans from 400 Mbps, 600 Mbps and 1 Gbps (1000 Mbps) depending on your region. Speed is symmetric on some fiber plans.',
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
          a: isFr ? 'Notre support est disponible en français et en anglais, 7 jours sur 7 de 8h à 20h, par courriel à support@nivra-telecom.ca, par chat en direct sur notre site, ou par téléphone. Temps de réponse moyen : moins de 2 heures.' : 'Our support is available in French and English, 7 days a week from 8am to 8pm, by email at support@nivra-telecom.ca, live chat on our website, or by phone. Average response time: under 2 hours.',
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

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={isFr ? "FAQ — Internet sans contrat au Québec | Nivra Telecom" : "FAQ — No-Contract Internet in Quebec | Nivra Telecom"}
        description={isFr ? "Réponses aux questions fréquentes sur les forfaits Internet et TV sans contrat de Nivra Telecom au Québec. Prix, couverture, activation, support." : "Answers to frequently asked questions about Nivra Telecom no-contract Internet and TV plans in Quebec. Pricing, coverage, activation, support."}
      />
      <FAQSchema faqs={allFaqs} pageUrl="https://nivra-telecom.ca/faq" />
      <BreadcrumbSchema />
      <Header />
      
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-b from-navy-900 to-background">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
            {t('faq.title')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">{t('faq.title2')}</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('faq.subtitle')}
          </p>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          {categories.map((category) => (
            <div key={category.title} className="mb-12">
              <h2 className="font-display text-2xl font-bold text-foreground mb-6">{category.title}</h2>
              <Accordion type="single" collapsible className="space-y-3">
                {category.questions.map((item, index) => (
                  <AccordionItem
                    key={index}
                    value={`${category.title}-${index}`}
                    className="bg-card border border-border rounded-xl px-6"
                  >
                    <AccordionTrigger className="text-left font-medium text-foreground hover:text-cyan-400 py-4">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="w-8 h-8 text-cyan-400" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-4">
            {t('faq.notfound.title')}
          </h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            {t('faq.notfound.text')}
          </p>
          <Link to="/#contact">
            <Button variant="hero" size="lg">
              {t('faq.contact')}
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default FAQ;