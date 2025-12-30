import { Button } from "@/components/ui/button";
import { ArrowRight, Phone, Clock } from "lucide-react";

const CTA = () => {
  return (
    <section id="contact" className="py-20 md:py-32 bg-hero relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-400/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-8">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-300">30 minutes de consultation gratuite</span>
          </div>

          {/* Heading */}
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
            Prêt à optimiser vos{" "}
            <span className="text-gradient">télécoms</span>?
          </h2>
          <p className="text-lg md:text-xl text-cyan-100/70 max-w-2xl mx-auto mb-10">
            Réservez votre consultation gratuite dès maintenant. Nos experts analyseront vos besoins et vous proposeront les meilleures solutions du marché.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button variant="hero" size="xl" className="group w-full sm:w-auto">
              Réserver ma consultation
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button variant="heroOutline" size="xl" className="w-full sm:w-auto gap-2">
              <Phone className="w-5 h-5" />
              1-800-NIVRA
            </Button>
          </div>

          {/* Trust Note */}
          <p className="text-sm text-cyan-100/50">
            Sans engagement • 100% gratuit • Réponse en 24h
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTA;
