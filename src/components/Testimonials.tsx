import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Marie-Claude B.",
    location: "Rosemont, Montréal",
    text: "J'en avais assez de payer Bell 95$ par mois avec un contrat de 2 ans. Avec Nivra, je paie moins et je peux changer quand je veux.",
    rating: 5,
  },
  {
    name: "Jean-François L.",
    location: "Laval",
    text: "On vient d'emménager et on voulait pas signer un contrat. Nivra était parfait — activé en ligne, le modem livré en 2 jours.",
    rating: 5,
  },
  {
    name: "Thanh N.",
    location: "Brossard",
    text: "Le support parle français ET vietnamien, c'est rare. J'ai eu de l'aide pour la configuration en moins d'une heure.",
    rating: 5,
  },
  {
    name: "Sophie T.",
    location: "Plateau-Mont-Royal, Montréal",
    text: "Étudiante, je déménage chaque année. Avec Nivra, pas de stress de résiliation. J'amène mon forfait avec moi ou j'annule sans frais.",
    rating: 5,
  },
  {
    name: "Pierre D.",
    location: "Terrebonne",
    text: "Très satisfait du service Internet. Les prix sont clairs, pas de surprise sur la facture.",
    rating: 5,
  },
  {
    name: "Caroline B.",
    location: "Longueuil",
    text: "J'apprécie de pouvoir tout gérer en ligne. Le portail est simple à utiliser.",
    rating: 4,
  },
];

const Testimonials = () => {
  return (
    <section className="section-padding bg-muted/30">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-10">
          <h2 className="mb-3">Témoignages clients</h2>
          <p className="text-muted-foreground">
            Ce que nos clients disent de nos services
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-2xl p-6 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < testimonial.rating
                        ? "text-amber-400 fill-amber-400"
                        : "text-muted-foreground"
                    }`}
                  />
                ))}
              </div>
              <div className="relative mb-4">
                <Quote className="w-8 h-8 text-accent/20 absolute -top-2 -left-1" />
                <p className="text-foreground text-sm leading-relaxed pl-6">
                  {testimonial.text}
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <span className="text-accent font-semibold text-sm">
                    {testimonial.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">
                    {testimonial.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Avis recueillis auprès de clients Nivra
        </p>
      </div>
    </section>
  );
};

export default Testimonials;
