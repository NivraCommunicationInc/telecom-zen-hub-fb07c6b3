import { lazy, Suspense } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import HomePricing from "@/components/HomePricing";
import ComparisonTable from "@/components/ComparisonTable";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";
import LocalBusinessSchema from "@/components/LocalBusinessSchema";
import HomeStatusBanner from "@/components/HomeStatusBanner";
import LaunchOfferPopup from "@/components/marketing/LaunchOfferPopup";

const StatsBanner = lazy(() => import("@/components/marketing/StatsBanner"));

const TestimonialsSection = lazy(() => import("@/components/marketing/TestimonialsSection"));
const TrustBadges = lazy(() => import("@/components/marketing/TrustBadges"));
const CoverageSection = lazy(() => import("@/components/marketing/CoverageSection"));

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
        <ComparisonTable />
        <Suspense fallback={null}>
          <CoverageSection />
        </Suspense>
        <Suspense fallback={null}>
          <TestimonialsSection />
        </Suspense>
        <Suspense fallback={null}>
          <TrustBadges />
        </Suspense>
        <FinalCTA />
      </main>
      <Footer />
      <LaunchOfferPopup />
    </div>
  );
};

export default Index;
