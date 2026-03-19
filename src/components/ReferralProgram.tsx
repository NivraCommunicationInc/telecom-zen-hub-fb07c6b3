import { Gift, Users, CreditCard, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const steps = [
  {
    icon: Users,
    title_fr: "Partagez votre code",
    title_en: "Share your code",
    desc_fr: "Chaque client Nivra reçoit un code de parrainage unique.",
    desc_en: "Every Nivra customer gets a unique referral code.",
  },
  {
    icon: Gift,
    title_fr: "Votre proche s'abonne",
    title_en: "Your friend subscribes",
    desc_fr: "Le nouveau client utilise votre code lors de sa commande.",
    desc_en: "The new customer uses your code when ordering.",
  },
  {
    icon: CheckCircle,
    title_fr: "3 mois payés",
    title_en: "3 months paid",
    desc_fr: "Après 3 cycles de facturation payés par le nouveau client.",
    desc_en: "After 3 billing cycles paid by the new customer.",
  },
  {
    icon: CreditCard,
    title_fr: "Recevez 25$",
    title_en: "Get $25",
    desc_fr: "Carte-cadeau Visa/Mastercard prépayée de 25$.",
    desc_en: "Prepaid $25 Visa/Mastercard gift card.",
  },
];

const ReferralProgram = () => {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  return (
    <section className="py-16 lg:py-24 bg-black text-white">
      <div className="container mx-auto px-4 max-w-[1320px]">
        <div className="text-center mb-12">
          <span className="inline-block bg-amber-400 text-black text-xs font-extrabold uppercase tracking-wider px-3 py-1.5 mb-6">
            {isFr ? "PROGRAMME DE PARRAINAGE" : "REFERRAL PROGRAM"}
          </span>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">
            {isFr ? "Parrainez, recevez " : "Refer a friend, get "}
            <span className="text-amber-400">25$</span>
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            {isFr
              ? "Sans limite de parrainages. Programme transparent, sans conditions cachées."
              : "No referral limit. Transparent program, no hidden conditions."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {steps.map((step, i) => (
            <div key={i} className="relative group">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 h-full hover:bg-white/10 transition-all duration-300">
                <div className="absolute -top-3 -left-1 w-7 h-7 rounded-sm bg-amber-400 text-black flex items-center justify-center text-xs font-extrabold">
                  {i + 1}
                </div>
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mb-4">
                  <step.icon className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="font-bold text-white mb-2">{isFr ? step.title_fr : step.title_en}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{isFr ? step.desc_fr : step.desc_en}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden lg:flex absolute top-1/2 -right-2 -translate-y-1/2 z-10">
                  <ArrowRight className="w-4 h-4 text-white/20" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              className="bg-amber-400 hover:bg-amber-300 text-black rounded-none px-8 h-12 font-bold uppercase tracking-wider gap-2 transition-all duration-200 hover:scale-105"
              asChild
            >
              <Link to="/portal/referrals">
                <Gift className="w-4 h-4" />
                {isFr ? "Voir mon code" : "See my code"}
              </Link>
            </Button>
            <Button
              className="border-2 border-white/20 text-white bg-transparent hover:bg-white/10 rounded-none px-8 h-12 font-bold uppercase tracking-wider gap-2"
              asChild
            >
              <Link to="/parrainage">
                {isFr ? "En savoir plus" : "Learn more"}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReferralProgram;
