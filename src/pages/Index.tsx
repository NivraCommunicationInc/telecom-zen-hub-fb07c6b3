import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HomePricing from "@/components/HomePricing";
import HowItWorks from "@/components/HowItWorks";
import WhyNivra from "@/components/WhyNivra";
import Reliability from "@/components/Reliability";
import ComparisonTable from "@/components/ComparisonTable";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";
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
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <HomePricing />
        <HowItWorks />
        <WhyNivra />
        <Reliability />
        <ComparisonTable />
        <ReferralProgram />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
