import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ServiceShowcase from "@/components/ServiceShowcase";
import NetworkTrust from "@/components/NetworkTrust";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import { FeaturedOffers } from "@/components/FeaturedOffers";
import ReferralProgram from "@/components/ReferralProgram";
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
        {/* 1. Hero — Value prop + primary CTA */}
        <Hero />
        {/* 2. Service selection — Internet / Mobile / Combo */}
        <ServiceShowcase />
        {/* 3. Featured offers — Top plans highlighted */}
        <FeaturedOffers />
        {/* 4. Why Nivra — Trust elements */}
        <NetworkTrust />
        {/* 5. Referral program */}
        <ReferralProgram />
        {/* 6. Final CTA — Push to order */}
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
