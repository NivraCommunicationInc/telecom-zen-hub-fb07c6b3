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
    <section className="py-20 lg:py-28 bg-slate-50">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium mb-6">
            <Gift className="w-4 h-4" />
            {isFr ? "Programme de parrainage" : "Referral program"}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            {isFr ? "Parrainez un proche, recevez " : "Refer a friend, get "}
            <span className="text-emerald-600">25$</span>
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            {isFr
              ? "Sans limite de parrainages. Programme transparent, sans conditions cachées."
              : "No referral limit. Transparent program, no hidden conditions."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
          {steps.map((step, i) => (
            <div key={i} className="relative group">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 h-full hover:border-emerald-300 hover:shadow-md transition-all duration-300">
                <div className="absolute -top-3 -left-1 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  {i + 1}
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                  <step.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{isFr ? step.title_fr : step.title_en}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{isFr ? step.desc_fr : step.desc_en}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden lg:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10">
                  <ArrowRight className="w-5 h-5 text-slate-300" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200 p-8 md:p-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-emerald-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">
            {isFr ? "Carte-cadeau Visa/Mastercard de 25$" : "$25 Visa/Mastercard Gift Card"}
          </h3>
          <p className="text-slate-500 max-w-lg mx-auto mb-6">
            {isFr
              ? "Pour chaque parrainage qualifié. Plus vous parrainez, plus vous gagnez."
              : "For every qualified referral. The more you refer, the more you earn."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-full px-6 h-11 font-semibold gap-2"
              asChild
            >
              <Link to="/portal/referrals">
                <Gift className="w-4 h-4" />
                {isFr ? "Voir mon code" : "See my code"}
              </Link>
            </Button>
            <Button
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-50 rounded-full px-6 h-11 font-semibold gap-2"
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
