import { Helmet } from "react-helmet-async";

const BASE_URL = "https://nivra-telecom.ca";

const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${BASE_URL}/#organization`,
  name: "Nivra Telecom",
  legalName: "Nivra Communications Inc.",
  url: BASE_URL,
  logo: `${BASE_URL}/logo-nivra.svg`,
  description:
    "Fournisseur Internet et TV prépayé au Québec sans contrat ni vérification de crédit.",
  foundingDate: "2024",
  areaServed: "Quebec, Canada",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Montréal",
    addressRegion: "QC",
    addressCountry: "CA",
  },
  contactPoint: {
    "@type": "ContactPoint",
    email: "support@nivra-telecom.ca",
    contactType: "customer service",
    availableLanguage: ["French", "English"],
    areaServed: "CA",
  },
  sameAs: [
    "https://www.facebook.com/nivratelecom",
    "https://www.instagram.com/nivratelecom",
  ],
};

const LOCAL_BUSINESS_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${BASE_URL}/#business`,
  name: "Nivra Telecom",
  description: "Internet et TV prépayé sans contrat au Québec",
  url: BASE_URL,
  email: "support@nivra-telecom.ca",
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Montréal",
    addressRegion: "QC",
    postalCode: "H3H 1P5",
    addressCountry: "CA",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 45.5017,
    longitude: -73.5673,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "22:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Saturday", "Sunday"],
      opens: "09:00",
      closes: "20:00",
    },
  ],
};

export const INTERNET_GIGA_PRODUCT = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Internet GIGA — Nivra Telecom",
  description: "Forfait Internet 1 010 Mbps prépayé sans contrat au Québec",
  brand: { "@type": "Brand", name: "Nivra Telecom" },
  offers: {
    "@type": "Offer",
    price: "60.00",
    priceCurrency: "CAD",
    availability: "https://schema.org/InStock",
    priceValidUntil: "2027-12-31",
    seller: { "@type": "Organization", name: "Nivra Telecom" },
  },
};

export const BUNDLE_GIGA_TV_PRODUCT = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Bundle GIGA + TV — Nivra Telecom",
  description: "Internet 1 010 Mbps + télévision IPTV sans contrat au Québec",
  brand: { "@type": "Brand", name: "Nivra Telecom" },
  offers: {
    "@type": "Offer",
    price: "100.00",
    priceCurrency: "CAD",
    availability: "https://schema.org/InStock",
    priceValidUntil: "2027-12-31",
    seller: { "@type": "Organization", name: "Nivra Telecom" },
  },
};

export const HOME_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Nivra Telecom offre-t-il Internet sans contrat?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Oui, tous nos forfaits Internet et TV sont sans contrat et sans engagement. Vous pouvez annuler à tout moment sans frais.",
      },
    },
    {
      "@type": "Question",
      name: "Nivra Telecom vérifie-t-il le crédit?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Non, Nivra Telecom n'effectue aucune vérification de crédit. Tout le monde est accepté.",
      },
    },
    {
      "@type": "Question",
      name: "Combien coûte Internet chez Nivra Telecom?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Notre forfait Internet GIGA coûte 60$ par mois (avant taxes). Aucun contrat, aucun frais caché.",
      },
    },
    {
      "@type": "Question",
      name: "Qu'est-ce qui distingue Nivra des grands fournisseurs?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Contrairement aux grands fournisseurs, Nivra Telecom offre des forfaits prépayés sans contrat, sans vérification de crédit et sans frais cachés. Vous payez mois par mois et pouvez annuler quand vous voulez.",
      },
    },
    {
      "@type": "Question",
      name: "Nivra Telecom est-il disponible partout au Québec?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Nivra Telecom est actuellement disponible à Montréal, Laval, Montréal-Nord, Saint-Léonard, Anjou et dans les environs. Vérifiez la disponibilité à votre adresse sur notre site.",
      },
    },
  ],
};

interface SchemaMarkupProps {
  /** Include Organization + LocalBusiness (default true). */
  includeBrand?: boolean;
  /** Include the home-page FAQ schema. */
  includeHomeFaq?: boolean;
  /** Include core product schemas (Internet GIGA + Bundle). */
  includeProducts?: boolean;
  /** Additional ad-hoc schemas to inject (already-formed JSON-LD objects). */
  extra?: Array<Record<string, unknown>>;
}

/**
 * SchemaMarkup — Injects JSON-LD structured data into <head>.
 * Use for brand identity, FAQ, products, and any extra schemas per page.
 */
export const SchemaMarkup = ({
  includeBrand = true,
  includeHomeFaq = false,
  includeProducts = false,
  extra = [],
}: SchemaMarkupProps) => {
  const schemas: Array<Record<string, unknown>> = [];
  if (includeBrand) {
    schemas.push(ORGANIZATION_SCHEMA, LOCAL_BUSINESS_SCHEMA);
  }
  if (includeHomeFaq) {
    schemas.push(HOME_FAQ_SCHEMA);
  }
  if (includeProducts) {
    schemas.push(INTERNET_GIGA_PRODUCT, BUNDLE_GIGA_TV_PRODUCT);
  }
  schemas.push(...extra);

  return (
    <Helmet>
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(s)}
        </script>
      ))}
    </Helmet>
  );
};

export default SchemaMarkup;
