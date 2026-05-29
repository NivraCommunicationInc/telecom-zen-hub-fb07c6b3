/**
 * ReferralProgram — Dark premium referral section
 */
import { Gift, Users, CreditCard, ArrowRight, CheckCircle } from "lucide-react";
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
    <section className="py-12 sm:py-20 lg:py-28 relative overflow-hidden" style={{ background: '#080612' }}>
      <div className="container mx-auto px-4 max-w-6xl relative">
        {/* Badge */}
        <div className="flex justify-center mb-5 sm:mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-semibold text-sm" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', color: '#C4B5FD' }}>
            <Gift className="w-4 h-4" />
            Programme de parrainage
          </span>
        </div>

        {/* Headline */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16">
          <h2 className="font-bold text-white mb-4 sm:mb-5" style={{ fontSize: 'clamp(22px, 3.5vw, 38px)', letterSpacing: '-0.8px' }}>
            Parrainez un proche, recevez <span style={{ color: '#C4B5FD' }}>25$</span>
          </h2>
          <p className="text-[16px] sm:text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Invitez vos proches chez Nivra et recevez une carte-cadeau Visa/Mastercard de 25$ après leur 3e cycle mensuel payé. Sans limite de parrainages.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-7 mb-10 sm:mb-16">
          {steps.map((step, i) => (
            <div key={i} className="relative group">
              <div
                className="rounded-xl sm:rounded-2xl p-4 sm:p-8 h-full transition-all duration-300"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.4)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(124,58,237,0.2)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.09)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <div className="absolute -top-2.5 -left-0.5 sm:-top-3 sm:-left-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold" style={{ background: '#7C3AED', color: '#FFFFFF' }}>
                  {i + 1}
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-5 transition-all duration-300" style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.28)' }}>
                  <step.icon className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-300 group-hover:scale-110" style={{ color: '#A78BFA' }} />
                </div>
                <h3 className="font-bold text-white mb-1.5 sm:mb-2 text-[14px] sm:text-base">{step.title}</h3>
                <p className="text-[13px] sm:text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{step.description}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden lg:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10">
                  <ArrowRight className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.25)' }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Reward highlight */}
        <div
          className="rounded-2xl sm:rounded-3xl p-6 sm:p-10 md:p-14 text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #3B0764 0%, #5B21B6 50%, #6D28D9 100%)', boxShadow: '0 24px 60px rgba(124,58,237,0.5)' }}
        >
          <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
          <div className="relative">
            <div className="flex items-center justify-center gap-3 mb-4 sm:mb-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <CreditCard className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3" style={{ letterSpacing: '-0.5px' }}>
              Carte-cadeau Visa/Mastercard de 25$
            </h3>
            <p className="max-w-lg mx-auto mb-6 sm:mb-8 text-[15px] sm:text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Pour chaque parrainage qualifié. Aucune limite — plus vous parrainez, plus vous gagnez. Programme transparent, sans conditions cachées.
            </p>
            <Link
              to="/parrainage"
              className="inline-flex items-center gap-2 font-bold transition-all hover:opacity-90"
              style={{ height: 48, background: '#FFFFFF', color: '#5B21B6', borderRadius: 999, paddingLeft: 28, paddingRight: 28, fontSize: 14, textDecoration: 'none' }}
            >
              En savoir plus
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReferralProgram;
