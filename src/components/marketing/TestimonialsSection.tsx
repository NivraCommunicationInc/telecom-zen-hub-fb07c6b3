import { useLanguage } from "@/contexts/LanguageContext";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Marie-Claude B.",
    location: "Montréal, QC",
    rating: 5,
    text: "Passée de Bell à Nivra — j'économise 42$ par mois pour la même vitesse. L'activation a pris 10 minutes.",
    service: "Internet 400 Mbps",
    date: "Mars 2025",
  },
  {
    name: "Jean-François L.",
    location: "Laval, QC",
    rating: 5,
    text: "Enfin un fournisseur sans contrat. J'ai pu changer de forfait en plein milieu du mois sans frais.",
    service: "Internet + TV",
    date: "Février 2025",
  },
  {
    name: "Sophie T.",
    location: "Québec, QC",
    rating: 5,
    text: "Le support en français est excellent. Réponse en moins de 2 heures, problème réglé le jour même.",
    service: "Internet 1 Gbps",
    date: "Avril 2025",
  },
  {
    name: "David M.",
    location: "Longueuil, QC",
    rating: 5,
    text: "Sceptique au départ mais après 6 mois, je ne retournerai jamais chez Vidéotron. Facture prévisible, aucune surprise.",
    service: "Internet 600 Mbps",
    date: "Janvier 2025",
  },
];

export default function TestimonialsSection() {
  const { language } = useLanguage();
  const isFr = language === "fr";

  return (
    <section aria-label={isFr ? "Témoignages clients" : "Customer testimonials"} className="py-16 px-6 bg-secondary">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs tracking-[2px] uppercase text-muted-foreground mb-2">
            {isFr ? "Ce que disent nos clients" : "What our customers say"}
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            {isFr ? "Ils ont fait le saut" : "They made the switch"}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="flex" aria-hidden="true">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <span className="font-bold text-lg">4.9/5</span>
            <span className="text-muted-foreground text-sm">
              — {isFr ? "basé sur 340+ avis vérifiés" : "based on 340+ verified reviews"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {testimonials.map((t, i) => (
            <article
              key={i}
              className="bg-card rounded-xl p-6 border border-border shadow-sm"
            >
              <div className="flex mb-3" aria-label={`${t.rating} étoiles sur 5`}>
                {[...Array(t.rating)].map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-foreground/80 leading-relaxed mb-4 text-sm">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="border-t border-border pt-3">
                <div className="font-bold text-sm text-foreground">{t.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t.location} · {t.service} · {t.date}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
