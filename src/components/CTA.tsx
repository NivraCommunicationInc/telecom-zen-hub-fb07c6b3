import { Button } from "@/components/ui/button";
import { Phone, Clock } from "lucide-react";
import ContactForm from "./ContactForm";

const CTA = () => {
  return (
    <section id="contact" className="py-20 md:py-32 bg-hero relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-400/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-6xl mx-auto">
          {/* Left Content */}
          <div className="text-center lg:text-left">
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
            <p className="text-lg md:text-xl text-cyan-100/70 mb-8">
              Réservez votre consultation gratuite dès maintenant. Nos experts analyseront vos besoins et vous proposeront les meilleures solutions du marché.
            </p>

            {/* Phone CTA */}
            <div className="flex items-center justify-center lg:justify-start gap-4 mb-6">
              <Button variant="heroOutline" size="lg" className="gap-2" asChild>
                <a href="tel:+14385442233">
                  <Phone className="w-5 h-5" />
                  438-544-2233
                </a>
              </Button>
            </div>

            {/* Trust Note */}
            <p className="text-sm text-cyan-100/50">
              Sans engagement • 100% gratuit • Réponse en 24h
            </p>
          </div>

          {/* Right - Contact Form */}
          <div>
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
