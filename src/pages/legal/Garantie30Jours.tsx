/**
 * Garantie 30 jours — Public marketing + policy page
 * Routes: /garantie (FR) and /guarantee (EN)
 * Switches language via URL path; useLanguage drives header/footer.
 */
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Check, X, Mail, Package, RefreshCw, CreditCard } from "lucide-react";
import { COMPANY_CONTACT } from "@/config/company";

const Garantie30Jours = () => {
  const location = useLocation();
  const isFr = !location.pathname.startsWith("/guarantee");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const t = isFr
    ? {
        title: "Essayez Nivra sans risque — 30 jours pour changer d'avis",
        subtitle:
          "Premier mois de service GRATUIT. Si vous n'êtes pas satisfait, retournez l'équipement et soyez remboursé. Sans questions.",
        ctaPrimary: "Commander maintenant",
        ctaSecondary: "Voir les forfaits",
        refundedTitle: "Ce qui est remboursé",
        notRefundedTitle: "Ce qui n'est pas remboursé",
        refunded: [
          "Frais d'équipement (borne WiFi, terminal TV)",
          "Nivra paie les frais de retour (waybill fourni)",
        ],
        notRefunded: [
          "Frais d'activation (10$)",
          "Frais de livraison (20$)",
          "Frais d'installation technicien (si applicable)",
        ],
        howTitle: "Comment procéder",
        steps: [
          {
            t: "Contactez-nous",
            d: `Écrivez à ${COMPANY_CONTACT.supportEmailDisplay} dans les 30 jours suivant la réception de votre équipement.`,
          },
          {
            t: "Recevez votre waybill gratuit",
            d: "Nous vous envoyons un bordereau de retour prépayé par courriel — aucun frais à votre charge.",
          },
          {
            t: "Retournez l'équipement",
            d: "Emballage d'origine, en bon état, avec tous les accessoires inclus.",
          },
          {
            t: "Remboursement rapide",
            d: "Effectué via votre méthode de paiement originale dans 3 à 5 jours ouvrables après réception.",
          },
        ],
        faqTitle: "Questions fréquentes",
        faqs: [
          {
            q: "Est-ce que je peux annuler à tout moment ?",
            a: "Oui. Tous les services Nivra sont prépayés et sans engagement. Vous pouvez annuler à tout moment, le service reste actif jusqu'à la fin du cycle déjà payé.",
          },
          {
            q: "Combien ça coûte de retourner l'équipement ?",
            a: "Rien. Nivra paie les frais de retour. Nous vous envoyons un waybill prépayé par courriel — vous n'avez qu'à coller l'étiquette sur la boîte et déposer le colis.",
          },
          {
            q: "Quand vais-je recevoir mon remboursement ?",
            a: "Dans 3 à 5 jours ouvrables après réception et inspection de l'équipement, sur la même méthode de paiement utilisée à l'achat.",
          },
          {
            q: "Et si l'équipement est endommagé ?",
            a: "L'équipement doit être retourné dans son emballage d'origine et en bon état (usure normale acceptée). Les dommages physiques ou liquides peuvent réduire le remboursement.",
          },
          {
            q: "Le premier mois est-il vraiment gratuit ?",
            a: "Oui — utilisez le code promo BIENVENUE2026 au checkout. Vous ne payez aujourd'hui que les frais d'équipement et d'activation. Le premier mois de service est offert.",
          },
        ],
        finalCta: "Prêt à essayer Nivra sans risque ?",
        finalCtaSub: "Premier mois gratuit + 30 jours satisfait ou remboursé.",
        finalCtaButton: "Commander — Essai 30 jours",
      }
    : {
        title: "Try Nivra risk-free — 30 days to change your mind",
        subtitle:
          "First month of service FREE. If you're not satisfied, return the equipment and get refunded. No questions asked.",
        ctaPrimary: "Order now",
        ctaSecondary: "See plans",
        refundedTitle: "What is refunded",
        notRefundedTitle: "What is not refunded",
        refunded: [
          "Equipment fees (WiFi modem, TV terminal)",
          "Nivra covers return shipping (waybill provided)",
        ],
        notRefunded: [
          "Activation fee ($10)",
          "Delivery fee ($20)",
          "Technician installation fee (if applicable)",
        ],
        howTitle: "How to proceed",
        steps: [
          {
            t: "Contact us",
            d: `Email ${COMPANY_CONTACT.supportEmailDisplay} within 30 days of receiving your equipment.`,
          },
          {
            t: "Receive your free waybill",
            d: "We send you a prepaid return label by email — at no cost to you.",
          },
          {
            t: "Return the equipment",
            d: "Original packaging, in good condition, with all accessories included.",
          },
          {
            t: "Fast refund",
            d: "Processed to your original payment method within 3 to 5 business days after receipt.",
          },
        ],
        faqTitle: "Frequently asked questions",
        faqs: [
          {
            q: "Can I cancel at any time?",
            a: "Yes. All Nivra services are prepaid with no commitment. You can cancel anytime — service stays active until the end of the cycle already paid.",
          },
          {
            q: "How much does it cost to return the equipment?",
            a: "Nothing. Nivra covers return shipping. We email you a prepaid waybill — just stick the label on the box and drop it off.",
          },
          {
            q: "When will I get my refund?",
            a: "Within 3 to 5 business days after we receive and inspect the equipment, refunded to the original payment method.",
          },
          {
            q: "What if the equipment is damaged?",
            a: "Equipment must be returned in original packaging and in good condition (normal wear accepted). Physical or liquid damage may reduce the refund.",
          },
          {
            q: "Is the first month really free?",
            a: "Yes — use promo code BIENVENUE2026 at checkout. You only pay for equipment and activation fees today. The first month of service is on us.",
          },
        ],
        finalCta: "Ready to try Nivra risk-free?",
        finalCtaSub: "First month free + 30-day money-back guarantee.",
        finalCtaButton: "Order — 30-day trial",
      };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={isFr ? "Garantie 30 jours satisfait ou remboursé | Nivra Telecom" : "30-day money-back guarantee | Nivra Telecom"}
        description={t.subtitle}
        canonical={isFr ? "https://nivra-telecom.ca/garantie" : "https://nivra-telecom.ca/guarantee"}
      />
      <Header />

      <main className="pt-20">
        {/* Hero */}
        <section className="relative overflow-hidden" style={{ background: "#EDE9FF" }}>
          <div className="max-w-[1100px] mx-auto px-5 sm:px-10 py-16 sm:py-24">
            <div className="max-w-3xl">
              <p className="font-semibold uppercase mb-4" style={{ color: "#7C3AED", fontSize: 12, letterSpacing: 3 }}>
                🔄 {isFr ? "GARANTIE 30 JOURS" : "30-DAY GUARANTEE"}
              </p>
              <h1
                className="font-extrabold mb-6"
                style={{ color: "#111111", fontSize: "clamp(36px, 6vw, 56px)", lineHeight: 1.1, letterSpacing: "-1px" }}
              >
                {t.title}
              </h1>
              <p className="mb-8" style={{ color: "#555555", fontSize: 18, lineHeight: 1.6, maxWidth: 640 }}>
                {t.subtitle}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/commander"
                  className="flex items-center justify-center gap-2 px-8 font-bold text-white transition-all"
                  style={{ height: 52, borderRadius: 50, background: "#7C3AED", fontSize: 15 }}
                >
                  {t.ctaPrimary} <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  to="/forfaits"
                  className="flex items-center justify-center gap-2 px-7 font-semibold transition-all"
                  style={{ height: 52, borderRadius: 50, border: "2px solid #7C3AED", color: "#7C3AED", fontSize: 15 }}
                >
                  {t.ctaSecondary} →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Refunded vs Not refunded */}
        <section className="py-16 sm:py-20" style={{ background: "#FFFFFF" }}>
          <div className="max-w-[1100px] mx-auto px-5 sm:px-10">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-2" style={{ borderColor: "#10B98140" }}>
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: "#10B98115" }}
                    >
                      <Check className="w-6 h-6" style={{ color: "#10B981" }} />
                    </div>
                    <h2 className="text-2xl font-bold" style={{ color: "#111111" }}>
                      {t.refundedTitle}
                    </h2>
                  </div>
                  <ul className="space-y-3">
                    {t.refunded.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-base" style={{ color: "#374151" }}>
                        <Check className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#10B981" }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2" style={{ borderColor: "#F59E0B40" }}>
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: "#F59E0B15" }}
                    >
                      <X className="w-6 h-6" style={{ color: "#F59E0B" }} />
                    </div>
                    <h2 className="text-2xl font-bold" style={{ color: "#111111" }}>
                      {t.notRefundedTitle}
                    </h2>
                  </div>
                  <ul className="space-y-3">
                    {t.notRefunded.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-base" style={{ color: "#374151" }}>
                        <X className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#F59E0B" }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="py-16 sm:py-20" style={{ background: "#F7F7F7" }}>
          <div className="max-w-[1100px] mx-auto px-5 sm:px-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-10 text-center" style={{ color: "#111111" }}>
              {t.howTitle}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {t.steps.map((step, i) => {
                const Icon = [Mail, Package, RefreshCw, CreditCard][i];
                return (
                  <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ background: "#7C3AED" }}
                      >
                        {i + 1}
                      </div>
                      <Icon className="w-5 h-5" style={{ color: "#7C3AED" }} />
                    </div>
                    <h3 className="font-bold text-lg mb-2" style={{ color: "#111111" }}>
                      {step.t}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: "#555555" }}>
                      {step.d}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 sm:py-20" style={{ background: "#FFFFFF" }}>
          <div className="max-w-[800px] mx-auto px-5 sm:px-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-10 text-center" style={{ color: "#111111" }}>
              {t.faqTitle}
            </h2>
            <div className="space-y-4">
              {t.faqs.map((faq, i) => (
                <details
                  key={i}
                  className="group rounded-xl border p-5 transition-all"
                  style={{ borderColor: "#E8E8E8", background: "#FAFAFA" }}
                >
                  <summary className="cursor-pointer font-semibold text-base list-none flex items-center justify-between gap-4" style={{ color: "#111111" }}>
                    <span>{faq.q}</span>
                    <span className="text-2xl shrink-0 transition-transform group-open:rotate-45" style={{ color: "#7C3AED" }}>+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "#555555" }}>
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 sm:py-20" style={{ background: "#7C3AED" }}>
          <div className="max-w-[800px] mx-auto px-5 sm:px-10 text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 text-white">{t.finalCta}</h2>
            <p className="text-lg mb-8 text-white/90">{t.finalCtaSub}</p>
            <Link
              to="/commander"
              className="inline-flex items-center justify-center gap-2 px-10 font-bold transition-all"
              style={{ height: 56, borderRadius: 50, background: "#FFFFFF", color: "#7C3AED", fontSize: 16 }}
            >
              {t.finalCtaButton}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Garantie30Jours;
