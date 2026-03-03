import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ServiceShowcase from "@/components/ServiceShowcase";
import NetworkTrust from "@/components/NetworkTrust";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import { FeaturedOffers } from "@/components/FeaturedOffers";
import ShopServices from "@/components/ShopServices";
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
        <FeaturedOffers />
        <ServiceShowcase />
        <NetworkTrust />
        <ShopServices />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
