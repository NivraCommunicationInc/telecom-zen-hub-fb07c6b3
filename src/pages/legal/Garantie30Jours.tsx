/**
 * Garantie 30 jours — Public marketing + policy page
 * Routes: /garantie (FR) and /guarantee (EN)
 * Premium redesign matching top telecom brands.
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { ArrowRight, Check, X, Mail, Package, RefreshCw, CreditCard, Gift, ShieldCheck, Truck, Plus } from "lucide-react";
import { COMPANY_CONTACT } from "@/config/company";
import { PhotoBg } from "@/components/PhotoBg";

const Garantie30Jours = () => {
  const location = useLocation();
  const isFr = !location.pathname.startsWith("/guarantee");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const t = isFr
    ? {
        eyebrow: "GARANTIE 30 JOURS",
        titlePart1: "Essayez Nivra",
        titleAccent: "sans risque",
        titlePart2: "— 30 jours pour changer d'avis",
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
        howSubtitle: "Un processus simple en 4 étapes — sans paperasse, sans tracas.",
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
        trustTitle: "Trois bonnes raisons d'essayer",
        trust: [
          { icon: Gift, title: "Premier mois GRATUIT", desc: "Avec le code BIENVENUE2026", bg: "purple" },
          { icon: ShieldCheck, title: "30 jours pour changer d'avis", desc: "Satisfait ou remboursé", bg: "dark" },
          { icon: Truck, title: "Retour gratuit — on paie", desc: "Waybill prépayé inclus", bg: "green" },
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
        finalCta: "Prêt à essayer sans risque?",
        finalCtaSub: "Premier mois gratuit + 30 jours satisfait ou remboursé.",
        finalCtaButton: "Commander maintenant — Premier mois GRATUIT",
        finalCtaFooter: "Aucun contrat • Aucune vérification de crédit • Remboursement garanti",
      }
    : {
        eyebrow: "30-DAY GUARANTEE",
        titlePart1: "Try Nivra",
        titleAccent: "risk-free",
        titlePart2: "— 30 days to change your mind",
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
        howSubtitle: "A simple 4-step process — no paperwork, no hassle.",
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
        trustTitle: "Three great reasons to try",
        trust: [
          { icon: Gift, title: "First month FREE", desc: "With code BIENVENUE2026", bg: "purple" },
          { icon: ShieldCheck, title: "30 days to change your mind", desc: "Money-back guarantee", bg: "dark" },
          { icon: Truck, title: "Free return — we pay", desc: "Prepaid waybill included", bg: "green" },
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
        finalCta: "Ready to try risk-free?",
        finalCtaSub: "First month free + 30-day money-back guarantee.",
        finalCtaButton: "Order now — First month FREE",
        finalCtaFooter: "No contract • No credit check • Refund guaranteed",
      };

  const stepIcons = [Mail, Package, RefreshCw, CreditCard];

  return (
    <div style={{ background: "#020209", minHeight: "100vh" }} className="relative overflow-hidden">
      <PhotoBg url="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1920&q=80" opacity={0.10} filter="saturate(0.5) brightness(0.6)" />
      <div aria-hidden style={{ position: "absolute", top: "-10%", right: "-8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-10%", left: "-6%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)", pointerEvents: "none" }} />
      <SEOHead
        title={isFr ? "Garantie 30 jours satisfait ou remboursé | Nivra Telecom" : "30-day money-back guarantee | Nivra Telecom"}
        description={t.subtitle}
        canonical={isFr ? "https://nivra-telecom.ca/garantie" : "https://nivra-telecom.ca/guarantee"}
      />
      <Header />

      <main>
        {/* HERO — dark with animated gradient */}
        <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28" style={{ background: "#020209" }}>
          <div aria-hidden style={{ position: 'absolute', top: '-20%', right: '-10%', width: 550, height: 550, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.22) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
          <div aria-hidden style={{ position: 'absolute', bottom: '-20%', left: '-8%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.12) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />

          <div className="relative max-w-[1100px] mx-auto px-5 sm:px-10 text-center">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full border animate-fade-in"
              style={{ borderColor: "rgba(124, 58, 237, 0.4)", background: "rgba(124, 58, 237, 0.1)" }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#7C3AED" }} />
              <span className="text-xs font-bold tracking-[3px]" style={{ color: "#A78BFA" }}>
                {t.eyebrow}
              </span>
            </div>

            <h1
              className="font-extrabold mb-6 text-white animate-fade-in"
              style={{ fontSize: "clamp(40px, 7vw, 72px)", lineHeight: 1.05, letterSpacing: "-2px" }}
            >
              {t.titlePart1}{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {t.titleAccent}
              </span>
              <br className="hidden sm:block" />
              <span style={{ color: "#FFFFFF" }}> {t.titlePart2}</span>
            </h1>

            <p
              className="mx-auto mb-10 animate-fade-in"
              style={{ color: "rgba(255,255,255,0.7)", fontSize: 19, lineHeight: 1.6, maxWidth: 680 }}
            >
              {t.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in">
              <Link
                to="/commander?promo=BIENVENUE2026"
                className="inline-flex items-center justify-center gap-2 px-8 font-bold text-white transition-all hover:scale-105 hover:shadow-[0_10px_40px_rgba(124,58,237,0.5)]"
                style={{ height: 56, borderRadius: 50, background: "#7C3AED", fontSize: 15 }}
              >
                {t.ctaPrimary} <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/forfaits"
                className="inline-flex items-center justify-center gap-2 px-7 font-semibold transition-all hover:bg-white/10"
                style={{
                  height: 56,
                  borderRadius: 50,
                  border: "2px solid rgba(255,255,255,0.3)",
                  color: "#FFFFFF",
                  fontSize: 15,
                }}
              >
                {t.ctaSecondary}
              </Link>
            </div>
          </div>
        </section>

        {/* REFUNDED vs NOT REFUNDED */}
        <section className="py-20 sm:py-28" style={{ background: "#020209" }}>
          <div className="max-w-[1100px] mx-auto px-5 sm:px-10">
            <div className="grid md:grid-cols-2 gap-6">
              {/* GREEN — Refunded */}
              <div
                className="rounded-3xl p-8 sm:p-10 transition-all hover:-translate-y-1"
                style={{
                  background: "rgba(16,185,129,0.06)",
                  border: "2px solid rgba(16,185,129,0.5)",
                  boxShadow: "0 4px 20px rgba(16, 185, 129, 0.12)",
                }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: "#10B981" }}
                  >
                    <Check className="w-7 h-7 text-white" strokeWidth={3} />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: "#FFFFFF" }}>
                    {t.refundedTitle}
                  </h2>
                </div>
                <ul className="space-y-4">
                  {t.refunded.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-base" style={{ color: "rgba(255,255,255,0.75)" }}>
                      <div
                        className="w-6 h-6 rounded-full shrink-0 mt-0.5 flex items-center justify-center"
                        style={{ background: "rgba(16,185,129,0.2)" }}
                      >
                        <Check className="w-4 h-4" style={{ color: "#10B981" }} strokeWidth={3} />
                      </div>
                      <span className="font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* RED — Not refunded */}
              <div
                className="rounded-3xl p-8 sm:p-10 transition-all hover:-translate-y-1"
                style={{
                  background: "rgba(239,68,68,0.06)",
                  border: "2px solid rgba(239,68,68,0.5)",
                  boxShadow: "0 4px 20px rgba(239, 68, 68, 0.12)",
                }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: "#EF4444" }}
                  >
                    <X className="w-7 h-7 text-white" strokeWidth={3} />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: "#FFFFFF" }}>
                    {t.notRefundedTitle}
                  </h2>
                </div>
                <ul className="space-y-4">
                  {t.notRefunded.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-base" style={{ color: "rgba(255,255,255,0.75)" }}>
                      <div
                        className="w-6 h-6 rounded-full shrink-0 mt-0.5 flex items-center justify-center"
                        style={{ background: "rgba(239,68,68,0.2)" }}
                      >
                        <X className="w-4 h-4" style={{ color: "#EF4444" }} strokeWidth={3} />
                      </div>
                      <span className="font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 4-STEP TIMELINE */}
        <section className="py-20 sm:py-28" style={{ background: "#020209", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="max-w-[1200px] mx-auto px-5 sm:px-10">
            <div className="text-center mb-14">
              <h2
                className="text-3xl sm:text-5xl font-extrabold mb-4"
                style={{ color: "#FFFFFF", letterSpacing: "-1px" }}
              >
                {t.howTitle}
              </h2>
              <p className="text-lg" style={{ color: "rgba(255,255,255,0.55)", maxWidth: 600, margin: "0 auto" }}>
                {t.howSubtitle}
              </p>
            </div>

            <div className="relative">
              {/* Connecting line — desktop only */}
              <div
                className="hidden lg:block absolute top-8 left-0 right-0 h-0.5"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, #7C3AED 15%, #7C3AED 85%, transparent 100%)",
                  marginLeft: "12.5%",
                  marginRight: "12.5%",
                }}
              />

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4 relative">
                {t.steps.map((step, i) => {
                  const Icon = stepIcons[i];
                  return (
                    <div key={i} className="relative flex flex-col items-center text-center">
                      {/* Number badge */}
                      <div
                        className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center text-white font-extrabold text-xl mb-5 transition-all hover:scale-110"
                        style={{
                          background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
                          boxShadow: "0 8px 24px rgba(124, 58, 237, 0.35)",
                        }}
                      >
                        {i + 1}
                      </div>

                      {/* Card */}
                      <div
                        className="rounded-2xl p-6 w-full transition-all hover:-translate-y-1"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}
                      >
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto"
                          style={{ background: "rgba(124,58,237,0.15)" }}
                        >
                          <Icon className="w-6 h-6" style={{ color: "#A78BFA" }} />
                        </div>
                        <h3 className="font-bold text-lg mb-2" style={{ color: "#FFFFFF" }}>
                          {step.t}
                        </h3>
                        <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                          {step.d}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* TRUST BADGES — 3 large cards */}
        <section className="py-20 sm:py-28" style={{ background: "#020209", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="max-w-[1100px] mx-auto px-5 sm:px-10">
            <h2
              className="text-3xl sm:text-5xl font-extrabold mb-14 text-center"
              style={{ color: "#FFFFFF", letterSpacing: "-1px" }}
            >
              {t.trustTitle}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {t.trust.map((card, i) => {
                const Icon = card.icon;
                const styles =
                  card.bg === "purple"
                    ? { bg: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)", text: "#FFFFFF", iconBg: "rgba(255,255,255,0.15)" }
                    : card.bg === "dark"
                    ? { bg: "linear-gradient(135deg, #1F1F1F 0%, #111111 100%)", text: "#FFFFFF", iconBg: "rgba(255,255,255,0.1)" }
                    : { bg: "linear-gradient(135deg, #10B981 0%, #059669 100%)", text: "#FFFFFF", iconBg: "rgba(255,255,255,0.15)" };
                return (
                  <div
                    key={i}
                    className="rounded-3xl p-8 sm:p-10 transition-all hover:scale-[1.03] hover:shadow-2xl"
                    style={{ background: styles.bg, color: styles.text }}
                  >
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                      style={{ background: styles.iconBg }}
                    >
                      <Icon className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-extrabold mb-2" style={{ letterSpacing: "-0.5px" }}>
                      {card.title}
                    </h3>
                    <p className="text-base opacity-90">{card.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ — clean accordion */}
        <section className="py-20 sm:py-28" style={{ background: "#020209", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="max-w-[820px] mx-auto px-5 sm:px-10">
            <h2
              className="text-3xl sm:text-5xl font-extrabold mb-12 text-center"
              style={{ color: "#FFFFFF", letterSpacing: "-1px" }}
            >
              {t.faqTitle}
            </h2>
            <div className="space-y-3">
              {t.faqs.map((faq, i) => {
                const isOpen = openFaq === i;
                return (
                  <div
                    key={i}
                    className="rounded-2xl overflow-hidden transition-all"
                    style={{
                      background: isOpen ? "rgba(124,58,237,0.06)" : "rgba(255,255,255,0.04)",
                      border: isOpen ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.08)",
                      boxShadow: isOpen ? "0 8px 24px rgba(124, 58, 237, 0.15)" : "none",
                    }}
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <span className="font-semibold text-base sm:text-lg" style={{ color: "#FFFFFF" }}>
                        {faq.q}
                      </span>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all"
                        style={{
                          background: isOpen ? "#7C3AED" : "rgba(124,58,237,0.15)",
                          transform: isOpen ? "rotate(45deg)" : "rotate(0)",
                        }}
                      >
                        <Plus className="w-4 h-4" style={{ color: isOpen ? "#FFFFFF" : "#A78BFA" }} strokeWidth={3} />
                      </div>
                    </button>
                    <div
                      className="grid transition-all duration-300"
                      style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                    >
                      <div className="overflow-hidden">
                        <p
                          className="px-6 pb-5 text-base leading-relaxed"
                          style={{ color: "rgba(255,255,255,0.6)" }}
                        >
                          {faq.a}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FINAL CTA — dark purple gradient */}
        <section
          className="relative overflow-hidden py-20 sm:py-28"
          style={{ background: "linear-gradient(135deg, #4C1D95 0%, #6D28D9 50%, #7C3AED 100%)" }}
        >
          <div
            className="absolute -top-20 -left-20 w-[400px] h-[400px] rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, #FFFFFF 0%, transparent 70%)" }}
          />
          <div
            className="absolute -bottom-20 -right-20 w-[500px] h-[500px] rounded-full opacity-15 blur-3xl"
            style={{ background: "radial-gradient(circle, #FFFFFF 0%, transparent 70%)" }}
          />

          <div className="relative max-w-[800px] mx-auto px-5 sm:px-10 text-center">
            <h2
              className="text-3xl sm:text-5xl font-extrabold mb-4 text-white"
              style={{ letterSpacing: "-1px", lineHeight: 1.1 }}
            >
              {t.finalCta}
            </h2>
            <p className="text-lg sm:text-xl mb-10" style={{ color: "rgba(255,255,255,0.85)" }}>
              {t.finalCtaSub}
            </p>
            <Link
              to="/commander?promo=BIENVENUE2026"
              className="inline-flex items-center justify-center gap-2 px-8 sm:px-10 font-bold transition-all hover:scale-105 hover:shadow-[0_15px_50px_rgba(0,0,0,0.3)]"
              style={{
                height: 60,
                borderRadius: 50,
                background: "#FFFFFF",
                color: "#7C3AED",
                fontSize: 16,
              }}
            >
              {t.finalCtaButton}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="mt-6 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
              {t.finalCtaFooter}
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Garantie30Jours;
