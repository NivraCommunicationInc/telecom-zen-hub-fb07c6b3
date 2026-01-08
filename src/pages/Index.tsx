import Header from "@/components/Header";
import Hero from "@/components/Hero";
import CoverageSetupBand from "@/components/CoverageSetupBand";
import Services from "@/components/Services";
import HowItWorks from "@/components/HowItWorks";
import ServiceStandards from "@/components/ServiceStandards";
import Benefits from "@/components/Benefits";
import Testimonials from "@/components/Testimonials";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import { FeaturedOffers } from "@/components/FeaturedOffers";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <CoverageSetupBand />
        <FeaturedOffers />
        <Services />
        <HowItWorks />
        <ServiceStandards />
        <Benefits />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;