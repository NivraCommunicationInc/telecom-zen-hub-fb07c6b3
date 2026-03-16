/**
 * ReferralProgram — Premium homepage section for the Nivra referral program
 */
import { Gift, Users, CreditCard, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const steps = [
  {
    icon: Users,
    title: "Partagez votre code",
    description: "Chaque client Nivra reçoit un code de parrainage unique à partager avec ses proches.",
  },
  {
    icon: Gift,
    title: "Votre proche s'abonne",
    description: "Le nouveau client utilise votre code lors de sa commande sur Nivra.",
  },
  {
    icon: CheckCircle,
    title: "3 mois payés",
    description: "Après 3 cycles de facturation mensuels payés par le nouveau client.",
  },
  {
    icon: CreditCard,
    title: "Recevez 25$",
    description: "Vous recevez automatiquement une carte-cadeau Visa/Mastercard prépayée de 25$.",
  },
];

const ReferralProgram = () => {
  return (
    <section className="py-20 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
      {/* Subtle decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#003366]/3 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-500/3 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

      <div className="container mx-auto px-4 max-w-6xl relative">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
            <Gift className="w-4 h-4" />
            Programme de parrainage
          </span>
        </div>

        {/* Headline */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Parrainez un proche, recevez <span className="text-emerald-600">25$</span>
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            Invitez vos proches chez Nivra et recevez une carte-cadeau Visa/Mastercard de 25$ après leur 3e cycle mensuel payé. Sans limite de parrainages.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
          {steps.map((step, i) => (
            <div key={i} className="relative group">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 h-full shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-300">
                {/* Step number */}
                <div className="absolute -top-3 -left-1 w-7 h-7 rounded-full bg-[#003366] text-white flex items-center justify-center text-xs font-bold shadow-md">
                  {i + 1}
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                  <step.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
              </div>
              {/* Connector arrow (hidden on last) */}
              {i < steps.length - 1 && (
                <div className="hidden lg:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10">
                  <ArrowRight className="w-5 h-5 text-slate-300" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Reward highlight */}
        <div className="bg-[#003366] rounded-2xl p-8 md:p-10 text-center shadow-xl">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-emerald-400" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">
            Carte-cadeau Visa/Mastercard de 25$
          </h3>
          <p className="text-white/70 max-w-lg mx-auto mb-6">
            Pour chaque parrainage qualifié. Aucune limite — plus vous parrainez, plus vous gagnez. Programme transparent, sans conditions cachées.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              className="bg-white text-[#003366] hover:bg-slate-100 rounded-full px-6 h-11 font-semibold gap-2"
              asChild
            >
              <Link to="/portal/referrals">
                <Gift className="w-4 h-4" />
                Voir mon code
              </Link>
            </Button>
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 rounded-full px-6 h-11 font-semibold gap-2"
              asChild
            >
              <Link to="/parrainage">
                En savoir plus
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
