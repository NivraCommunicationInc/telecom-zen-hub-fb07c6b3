import { useLanguage } from "@/contexts/LanguageContext";
import { Star } from "lucide-react";

const testimonials = [
  { name: "Marie-Claude B.", location: "Rosemont, Montréal", rating: 5, text: "J'en avais assez de payer Bell 95$ par mois avec un contrat de 2 ans. Avec Nivra, je paie moins et je peux changer quand je veux.", service: "Internet 400 Mbps" },
  { name: "Jean-François L.", location: "Laval, QC", rating: 5, text: "On vient d'emménager et on voulait pas signer un contrat. Nivra était parfait — activé en ligne, le modem livré en 2 jours.", service: "Internet 600 Mbps" },
  { name: "Thanh N.", location: "Brossard, QC", rating: 5, text: "Le support parle français ET vietnamien, c'est rare. J'ai eu de l'aide pour la configuration en moins d'une heure.", service: "Internet + TV" },
  { name: "Sophie T.", location: "Plateau-Mont-Royal", rating: 5, text: "Étudiante, je déménage chaque année. Avec Nivra, pas de stress de résiliation. J'amène mon forfait avec moi ou j'annule sans frais.", service: "Internet 400 Mbps" },
];

export default function TestimonialsSection() {
  const { language } = useLanguage();
  const isFr = language === "fr";

  return (
    <section aria-label={isFr ? "Témoignages clients" : "Customer testimonials"} className="px-5 sm:px-10" style={{ background: '#FFFFFF', paddingTop: 48, paddingBottom: 48 }}>
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <p className="uppercase mb-2" style={{ color: '#999999', fontSize: 11, letterSpacing: 2 }}>
            {isFr ? "Ce que disent nos clients" : "What our customers say"}
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: '#0D0D0D', letterSpacing: '-0.5px' }}>
            {isFr ? "Ils ont fait le saut" : "They made the switch"}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-current" style={{ color: '#7C3AED' }} />
              ))}
            </div>
            <span className="font-bold text-lg" style={{ color: '#0D0D0D' }}>4.9/5</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {testimonials.map((t, i) => (
            <article key={i} className="p-5 sm:p-6" style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #EEEEEE', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="flex mb-3">
                {[...Array(t.rating)].map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-current" style={{ color: '#7C3AED' }} />
                ))}
              </div>
              <p className="leading-relaxed mb-4 italic" style={{ color: '#444444', fontSize: 15 }}>&ldquo;{t.text}&rdquo;</p>
              <div className="pt-3" style={{ borderTop: '1px solid #EEEEEE' }}>
                <div className="font-bold" style={{ color: '#0D0D0D', fontSize: 13 }}>{t.name}</div>
                <div style={{ color: '#999999', fontSize: 12 }}>{t.location} · {t.service}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
