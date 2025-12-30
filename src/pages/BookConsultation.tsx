import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Calendar, Clock, CheckCircle } from "lucide-react";

declare global {
  interface Window {
    Calendly: any;
  }
}

interface CalendlyEmbedProps {
  url: string;
  prefillName?: string;
  prefillEmail?: string;
  className?: string;
}

const CalendlyEmbed = ({ url, prefillName, prefillEmail, className }: CalendlyEmbedProps) => {
  useEffect(() => {
    // Load Calendly widget script
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup
      const existingScript = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  // Build prefill parameters
  const prefillParams = new URLSearchParams();
  if (prefillName) prefillParams.set("name", prefillName);
  if (prefillEmail) prefillParams.set("email", prefillEmail);
  
  const fullUrl = prefillParams.toString() 
    ? `${url}?${prefillParams.toString()}`
    : url;

  return (
    <div
      className={`calendly-inline-widget ${className || ""}`}
      data-url={fullUrl}
      style={{ minWidth: "320px", height: "700px" }}
    />
  );
};

const BookConsultation = () => {
  const benefits = [
    "Analyse gratuite de vos besoins télécom",
    "Conseils 100% objectifs et impartiaux",
    "Aucune obligation ni pression commerciale",
    "Recommandations personnalisées",
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="pt-32 pb-12 bg-gradient-to-b from-navy-900 to-background">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-300">30 minutes de consultation</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
            Réservez votre{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">
              consultation
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Prenez rendez-vous avec un expert Nivra pour analyser vos besoins télécom et recevoir des conseils personnalisés.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Benefits Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-xl p-6 sticky top-24">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-foreground">Consultation gratuite</h3>
                    <p className="text-sm text-muted-foreground">30 minutes avec un expert</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-6">
                  <h4 className="font-medium text-foreground mb-3">Comment ça fonctionne?</h4>
                  <ol className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                      <span>Choisissez un créneau disponible</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                      <span>Recevez une confirmation par courriel</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                      <span>Participez à votre consultation en ligne ou par téléphone</span>
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Calendly Embed */}
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <CalendlyEmbed
                  url="https://calendly.com/nivratelecom/30min"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default BookConsultation;
