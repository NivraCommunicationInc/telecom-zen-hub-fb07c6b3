import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import HowItWorks from "@/components/HowItWorks";
import Benefits from "@/components/Benefits";
import CTA from "@/components/CTA";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Services />
        <HowItWorks />
        <Benefits />
        <CTA />
        <section id="contact" className="py-20 bg-navy-900">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Prêt à économiser sur vos services télécom?
              </h2>
              <p className="text-cyan-100/70 max-w-2xl mx-auto">
                Remplissez le formulaire ci-dessous et un de nos experts vous contactera dans les 24 heures 
                pour planifier votre consultation gratuite. Sans engagement, sans frais cachés.
              </p>
            </div>
            <div className="max-w-lg mx-auto">
              <ContactForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
