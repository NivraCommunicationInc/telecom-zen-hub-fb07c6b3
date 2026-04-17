import { useState, useEffect, useCallback, forwardRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const testimonials = [
  { name: "Marie-Claude B.", location: "Rosemont, Montréal", rating: 5, text: "J'en avais assez de payer Bell 95$ par mois avec un contrat de 2 ans. Avec Nivra, je paie moins et je peux changer quand je veux.", service: "Internet 400 Mbps" },
  { name: "Jean-François L.", location: "Laval, QC", rating: 5, text: "On vient d'emménager et on voulait pas signer un contrat. Nivra était parfait — activé en ligne, le modem livré en 2 jours.", service: "Internet 600 Mbps" },
  { name: "Thanh N.", location: "Brossard, QC", rating: 5, text: "Le support parle français ET vietnamien, c'est rare. J'ai eu de l'aide pour la configuration en moins d'une heure.", service: "Internet + TV" },
  { name: "Sophie T.", location: "Plateau-Mont-Royal", rating: 5, text: "Étudiante, je déménage chaque année. Avec Nivra, pas de stress de résiliation. J'amène mon forfait avec moi ou j'annule sans frais.", service: "Internet 400 Mbps" },
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
    <section ref={ref} aria-label={isFr ? "Témoignages clients" : "Customer testimonials"} className="px-5 sm:px-10" style={{ background: '#FFFFFF', paddingTop: 48, paddingBottom: 48 }}>
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <p className="uppercase mb-2" style={{ color: '#999999', fontSize: 11, letterSpacing: 2 }}>
            {isFr ? "Ce que disent nos clients" : "What our customers say"}
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: '#111111', letterSpacing: '-0.5px' }}>
            {isFr ? "Ils ont fait le saut" : "They made the switch"}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <span key={i} style={{ color: '#7C3AED', fontSize: 20 }}>★</span>
              ))}
            </div>
            <span className="font-bold text-lg" style={{ color: '#111111' }}>4.9/5</span>
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
                <div className="max-w-[600px] mx-auto" style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #EEEEEE', padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                  <div style={{ color: '#7C3AED', fontSize: 20, marginBottom: 12 }}>★★★★★</div>
                  <p style={{ fontSize: 16, color: '#444444', lineHeight: 1.7, fontStyle: 'italic', marginBottom: 16 }}>
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <div style={{ borderTop: '1px solid #EEEEEE', paddingTop: 12 }}>
                    <div style={{ fontWeight: 700, color: '#111111', fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 13, color: '#999999' }}>{t.location} · {t.service}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Arrows */}
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{ width: 40, height: 40, borderRadius: '50%', background: '#FFFFFF', border: '1px solid #EEEEEE', cursor: 'pointer', fontSize: 18 }}
            aria-label={isFr ? "Précédent" : "Previous"}
          >←</button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{ width: 40, height: 40, borderRadius: '50%', background: '#FFFFFF', border: '1px solid #EEEEEE', cursor: 'pointer', fontSize: 18 }}
            aria-label={isFr ? "Suivant" : "Next"}
          >→</button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-5">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="transition-colors"
              style={{ width: 8, height: 8, borderRadius: '50%', background: i === current ? '#7C3AED' : '#DDDDDD', border: 'none', cursor: 'pointer' }}
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
