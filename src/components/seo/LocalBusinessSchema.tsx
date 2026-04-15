import { Helmet } from "react-helmet-async";

export default function LocalBusinessSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Nivra Telecom",
    "url": "https://nivra-telecom.ca",
    "email": "support@nivra-telecom.ca",
    "address": {
      "@type": "PostalAddress",
      "addressRegion": "QC",
      "addressCountry": "CA",
    },
    "areaServed": {
      "@type": "State",
      "name": "Québec",
    },
    "priceRange": "$$",
    "openingHours": "Mo-Su 08:00-20:00",
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}
