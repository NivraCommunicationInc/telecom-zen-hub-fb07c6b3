import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ServiceShowcase from "@/components/ServiceShowcase";
import NetworkTrust from "@/components/NetworkTrust";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import { FeaturedOffers } from "@/components/FeaturedOffers";
import ShopServices from "@/components/ShopServices";
import ReferralProgram from "@/components/ReferralProgram";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";
import LocalBusinessSchema from "@/components/LocalBusinessSchema";
import HomeStatusBanner from "@/components/HomeStatusBanner";
import PromoBar from "@/components/PromoBar";

const Index = () => {
  return (
    <div className="min-h-screen public-light bg-white">
      <SEOHead {...SEO_DATA.home} />
      <LocalBusinessSchema />
      <PromoBar />
      <Header />
      <HomeStatusBanner />
      <main>
        <Hero />
        <FeaturedOffers />
        <ServiceShowcase />
        <NetworkTrust />
        <ReferralProgram />
        <ShopServices />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
