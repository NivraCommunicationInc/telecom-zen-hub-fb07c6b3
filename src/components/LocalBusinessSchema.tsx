import { useEffect } from "react";
import { COMPANY_CONTACT } from "@/config/company";

/**
 * LocalBusinessSchema - JSON-LD structured data for Google
 * Helps Google understand Nivra as a real business
 */
export const LocalBusinessSchema = () => {
  useEffect(() => {
    const scriptId = "local-business-schema";
    
    // Remove existing script if present
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    const schema = {
      "@context": "https://schema.org",
      "@type": "TelecommunicationsCompany",
      "@id": "https://nivratelecom.ca/#organization",
      name: COMPANY_CONTACT.companyName,
      legalName: COMPANY_CONTACT.legalName,
      alternateName: ["Nivra Communications", "Nivra Communications Inc", "Nivra Télécom"],
      url: "https://nivratelecom.ca",
      logo: "https://nivratelecom.ca/favicon.png",
      image: "https://nivratelecom.ca/og-image.png",
      description:
        "Entreprise de télécommunications prépayées au Québec offrant des services de téléphonie mobile, Internet, télévision et sécurité sans contrat.",
      telephone: COMPANY_CONTACT.supportPhoneTel,
      email: COMPANY_CONTACT.supportEmail,
      address: {
        "@type": "PostalAddress",
        streetAddress: "1799 Av. Pierre-Péladeau",
        addressLocality: "Laval",
        addressRegion: "QC",
        postalCode: "H7T 2Y5",
        addressCountry: "CA",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 45.5579,
        longitude: -73.7492,
      },
      areaServed: {
        "@type": "AdministrativeArea",
        name: "Province of Quebec",
        addressCountry: "CA",
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
      contactPoint: [
        {
          "@type": "ContactPoint",
          telephone: COMPANY_CONTACT.supportPhoneTel,
          contactType: "customer service",
          availableLanguage: ["French", "English"],
          areaServed: "CA",
        },
      ],
      sameAs: [
        // Add social media URLs here when available
      ],
      priceRange: "$$",
      currenciesAccepted: "CAD",
      paymentAccepted: ["Credit Card", "Debit Card", "Interac e-Transfer"],
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Services télécom Nivra",
        itemListElement: [
          {
            "@type": "OfferCatalog",
            name: "Internet haute vitesse",
            itemListElement: [
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Internet résidentiel",
                  description: "Internet illimité haute vitesse sans contrat",
                },
              },
            ],
          },
          {
            "@type": "OfferCatalog",
            name: "Télévision IPTV",
            itemListElement: [
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Télévision IPTV",
                  description: "Télévision sur IP avec 100+ chaînes",
                },
              },
            ],
          },
          {
            "@type": "OfferCatalog",
            name: "Mobile prépayé",
            itemListElement: [
              {
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: "Forfait mobile prépayé",
                  description: "Téléphonie mobile sans contrat",
                },
              },
            ],
          },
        ],
      },
    };

    const script = document.createElement("script");
    script.id = scriptId;
    script.type = "application/ld+json";
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.getElementById(scriptId);
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, []);

  return null;
};

export default LocalBusinessSchema;
