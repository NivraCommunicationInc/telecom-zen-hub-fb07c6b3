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

const FAQ = () => {
  const { t } = useLanguage();

  const categories = [
    {
      title: t('faq.cat.about'),
      questions: [
        { q: t('faq.about.q1'), a: t('faq.about.a1') },
        { q: t('faq.about.q2'), a: t('faq.about.a2') },
        { q: t('faq.about.q3'), a: t('faq.about.a3') },
        { q: t('faq.about.q4'), a: t('faq.about.a4') },
        { q: t('faq.about.q5'), a: t('faq.about.a5') },
      ],
    },
    {
      title: t('faq.cat.consultations'),
      questions: [
        { q: t('faq.consult.q1'), a: t('faq.consult.a1') },
        { q: t('faq.consult.q2'), a: t('faq.consult.a2') },
        { q: t('faq.consult.q3'), a: t('faq.consult.a3') },
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

  return (
    <div className="min-h-screen bg-background">
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