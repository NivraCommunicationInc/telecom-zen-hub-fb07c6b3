/**
 * ReferralProgram — Xfinity-inspired dark premium section
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
    <section className="py-20 lg:py-28 bg-white relative overflow-hidden">
      <div className="container mx-auto px-4 max-w-6xl relative">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-100 border border-purple-200 text-purple-700 text-sm font-semibold">
            <Gift className="w-4 h-4" />
            Programme de parrainage
          </span>
        </div>

        {/* Headline */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-[2.5rem] font-bold text-black mb-5 tracking-[-0.025em]">
            Parrainez un proche, recevez <span className="text-purple-600">25$</span>
          </h2>
          <p className="text-lg text-black/60 leading-relaxed">
            Invitez vos proches chez Nivra et recevez une carte-cadeau Visa/Mastercard de 25$ après leur 3e cycle mensuel payé. Sans limite de parrainages.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-7 mb-16">
          {steps.map((step, i) => (
            <div key={i} className="relative group">
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8 h-full hover:border-purple-300 hover:shadow-lg transition-all duration-300">
                <div className="absolute -top-3 -left-1 w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold shadow-md">
                  {i + 1}
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-5 group-hover:bg-purple-200 transition-colors duration-300">
                  <step.icon className="w-6 h-6 text-purple-600 transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="font-bold text-black mb-2">{step.title}</h3>
                <p className="text-sm text-black/60 leading-relaxed">{step.description}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden lg:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10">
                  <ArrowRight className="w-5 h-5 text-gray-300" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Reward highlight */}
        <div className="bg-gradient-to-br from-purple-700 via-purple-600 to-purple-800 rounded-3xl p-10 md:p-14 text-center shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-white/5 to-transparent" />
          </div>
          <div className="relative">
            <div className="flex items-center justify-center gap-3 mb-5">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Carte-cadeau Visa/Mastercard de 25$
            </h3>
            <p className="text-white/70 max-w-lg mx-auto mb-8 text-lg leading-relaxed">
              Pour chaque parrainage qualifié. Aucune limite — plus vous parrainez, plus vous gagnez. Programme transparent, sans conditions cachées.
            </p>
            <Button
              className="bg-white text-purple-700 hover:bg-white/90 rounded-full px-8 h-12 font-bold gap-2 shadow-md transition-all duration-200"
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
