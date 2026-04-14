import { lazy, Suspense } from "react";
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

const StatsBanner = lazy(() => import("@/components/marketing/StatsBanner"));
const MarketingComparisonTable = lazy(() => import("@/components/marketing/MarketingComparisonTable"));
const TestimonialsSection = lazy(() => import("@/components/marketing/TestimonialsSection"));
const TrustBadges = lazy(() => import("@/components/marketing/TrustBadges"));

const Index = () => {
  return (
    <div className="min-h-screen">
      <SEOHead {...SEO_DATA.home} />
      <LocalBusinessSchema />
      <Header />
      <HomeStatusBanner />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <Suspense fallback={null}>
          <StatsBanner />
        </Suspense>
        <HomePricing />
        <HowItWorks />
        <WhyNivra />
        <Reliability />
        <ComparisonTable />
        <Suspense fallback={null}>
          <MarketingComparisonTable />
        </Suspense>
        <Suspense fallback={null}>
          <TestimonialsSection />
        </Suspense>
        <ReferralProgram />
        <Suspense fallback={null}>
          <TrustBadges />
        </Suspense>
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
