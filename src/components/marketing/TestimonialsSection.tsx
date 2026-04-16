import { useLanguage } from "@/contexts/LanguageContext";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Marie-Claude B.",
    location: "Rosemont, Montréal",
    rating: 5,
    text: "J'en avais assez de payer Bell 95$ par mois avec un contrat de 2 ans. Avec Nivra, je paie moins et je peux changer quand je veux. La configuration du modem était super simple.",
    service: "Internet 400 Mbps",
    date: "Mars 2025",
  },
  {
    name: "Jean-François L.",
    location: "Laval, QC",
    rating: 5,
    text: "On vient d'emménager et on voulait pas signer un contrat. Nivra était parfait — activé en ligne, le modem livré en 2 jours. Aucun technicien à attendre.",
    service: "Internet 600 Mbps",
    date: "Février 2025",
  },
  {
    name: "Thanh N.",
    location: "Brossard, QC",
    rating: 5,
    text: "Le support parle français ET vietnamien, c'est rare. J'ai eu de l'aide pour la configuration en moins d'une heure. Je recommande à toute ma famille.",
    service: "Internet + TV",
    date: "Janvier 2025",
  },
  {
    name: "Sophie T.",
    location: "Plateau-Mont-Royal, Montréal",
    rating: 5,
    text: "Étudiante, je déménage chaque année. Avec Nivra, pas de stress de résiliation. J'amène mon forfait avec moi ou j'annule sans frais. Exactement ce dont j'avais besoin.",
    service: "Internet 400 Mbps",
    date: "Avril 2025",
  },
];

export default function TestimonialsSection() {
  const { language } = useLanguage();
  const isFr = language === "fr";

  return (
    <section aria-label={isFr ? "Témoignages clients" : "Customer testimonials"} className="py-10 sm:py-16 px-4 sm:px-6 bg-[#f4f7fb]">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <p className="text-xs tracking-[2px] uppercase text-[#8a94a6] mb-2">
            {isFr ? "Ce que disent nos clients" : "What our customers say"}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1a1a2e]">
            {isFr ? "Ils ont fait le saut" : "They made the switch"}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="flex" aria-hidden="true">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <span className="font-bold text-lg text-[#1a1a2e]">4.9/5</span>
            <span className="text-[#8a94a6] text-sm">
              — {isFr ? "selon nos premiers clients" : "from our first customers"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
          {testimonials.map((t, i) => (
            <article
              key={i}
              className="bg-white rounded-xl p-[18px] sm:p-6 border border-[#e8edf3] hover:border-purple-300 transition-colors shadow-sm"
            >
              <div className="flex mb-3" aria-label={`${t.rating} étoiles sur 5`}>
                {[...Array(t.rating)].map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-[#555e6d] leading-relaxed mb-4 text-[14px]">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="border-t border-[#e8edf3] pt-3">
                <div className="font-bold text-sm text-[#1a1a2e]">{t.name}</div>
                <div className="text-[12px] text-[#8a94a6] mt-0.5">
                  {t.location} · {t.service} · {t.date}
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="text-center text-[12px] text-[#8a94a6] mt-6 px-2">
          * {isFr
            ? "Les témoignages reflètent l'expérience de clients réels. Les résultats peuvent varier selon la région et la configuration."
            : "Testimonials reflect real customer experiences. Results may vary by region and setup."}
        </p>
      </div>
    </section>
  );
}
