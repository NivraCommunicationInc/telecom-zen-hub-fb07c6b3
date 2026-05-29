import { useState, useEffect, useCallback, forwardRef } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const testimonials = [
  { name: "Marie-Claude B.", location: "Rosemont, Montréal", rating: 5, text: "J'en avais assez de payer Bell 95$ par mois avec un contrat de 2 ans. Avec Nivra, je paie moins et je peux changer quand je veux.", service: "Internet 100 Mbps" },
  { name: "Jean-François L.", location: "Laval, QC", rating: 5, text: "On vient d'emménager et on voulait pas signer un contrat. Nivra était parfait — activé en ligne, le modem livré en 2 jours.", service: "Internet GIGA" },
  { name: "Thanh N.", location: "Brossard, QC", rating: 5, text: "Le support parle français ET vietnamien, c'est rare. J'ai eu de l'aide pour la configuration en moins d'une heure.", service: "Internet + TV" },
  { name: "Sophie T.", location: "Plateau-Mont-Royal", rating: 5, text: "Étudiante, je déménage chaque année. Avec Nivra, pas de stress de résiliation. J'amène mon forfait avec moi ou j'annule sans frais.", service: "Internet 500 Mbps" },
];

const TestimonialsSection = forwardRef<HTMLElement>((_props, ref) => {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent(i => (i + 1) % testimonials.length), []);
  const prev = useCallback(() => setCurrent(i => (i - 1 + testimonials.length) % testimonials.length), []);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <section ref={ref} aria-label={isFr ? "Témoignages clients" : "Customer testimonials"} className="px-5 sm:px-10" style={{ background: '#0A0A18', paddingTop: 48, paddingBottom: 48 }}>
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <p className="uppercase mb-2" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, letterSpacing: 2 }}>
            {isFr ? "Ce que disent nos clients" : "What our customers say"}
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white" style={{ letterSpacing: '-0.5px' }}>
            {isFr ? "Ils ont fait le saut" : "They made the switch"}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-current" style={{ color: '#A78BFA' }} />
              ))}
            </div>
            <span className="font-bold text-lg text-white">4.9/5</span>
          </div>
        </div>

        {/* Carousel */}
        <div className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-400 ease-in-out"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {testimonials.map((t, i) => (
              <div key={i} className="w-full flex-shrink-0 px-4">
                <div className="max-w-[600px] mx-auto" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', padding: 28 }}>
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(5)].map((_, si) => (
                      <Star key={si} className="w-4 h-4 fill-current" style={{ color: '#A78BFA' }} />
                    ))}
                  </div>
                  <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, fontStyle: 'italic', marginBottom: 16 }}>
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
                    <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{t.location} · {t.service}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Arrows */}
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors cursor-pointer"
            style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            aria-label={isFr ? "Précédent" : "Previous"}
          >
            <ChevronLeft className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors cursor-pointer"
            style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            aria-label={isFr ? "Suivant" : "Next"}
          >
            <ChevronRight className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.6)' }} />
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-5">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="transition-colors"
              style={{ width: 8, height: 8, borderRadius: '50%', background: i === current ? '#7C3AED' : 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer' }}
              aria-label={`Testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
});

TestimonialsSection.displayName = "TestimonialsSection";

export default TestimonialsSection;
