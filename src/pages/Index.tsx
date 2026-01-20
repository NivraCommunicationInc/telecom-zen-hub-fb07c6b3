import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TelecomStatsBar from "@/components/TelecomStatsBar";
import ServiceShowcase from "@/components/ServiceShowcase";
import NetworkTrust from "@/components/NetworkTrust";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import { FeaturedOffers } from "@/components/FeaturedOffers";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";
import LocalBusinessSchema from "@/components/LocalBusinessSchema";
import HomeStatusBanner from "@/components/HomeStatusBanner";

const Index = () => {
  return (
    <div className="min-h-screen">
      <SEOHead {...SEO_DATA.home} />
      <LocalBusinessSchema />
      <Header />
      <HomeStatusBanner />
      <main>
        <Hero />
        <TelecomStatsBar />
        <FeaturedOffers />
        <ServiceShowcase />
        <NetworkTrust />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
