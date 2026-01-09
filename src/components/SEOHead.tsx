import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { COMPANY_CONTACT } from "@/config/company";
import { SEO_CONFIG } from "@/config/seo";

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
}

/**
 * SEOHead - Dynamic SEO meta tags for each page
 * Updates document head with title, description, canonical, OG, Twitter cards
 * Also injects Google Site Verification meta tag if configured
 */
export const SEOHead = ({
  title,
  description,
  canonical,
  ogImage = SEO_CONFIG.defaultOgImage,
  noindex = false,
}: SEOHeadProps) => {
  const location = useLocation();
  const baseUrl = SEO_CONFIG.baseUrl;
  const fullCanonical = canonical || `${baseUrl}${location.pathname}`;
  const fullOgImage = ogImage.startsWith("http") ? ogImage : `${baseUrl}${ogImage}`;

  useEffect(() => {
    // Update title
    if (title) {
      document.title = title;
    }

    // Helper to update or create meta tag
    const setMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? "property" : "name";
      let element = document.querySelector(`meta[${attr}="${name}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attr, name);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    // Helper to update or create link tag
    const setLink = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
      if (!element) {
        element = document.createElement("link");
        element.setAttribute("rel", rel);
        document.head.appendChild(element);
      }
      element.setAttribute("href", href);
    };

    // Set meta description
    if (description) {
      setMeta("description", description);
      setMeta("og:description", description, true);
      setMeta("twitter:description", description);
    }

    // Set canonical
    setLink("canonical", fullCanonical);

    // Set OG tags
    if (title) {
      setMeta("og:title", title, true);
      setMeta("twitter:title", title);
    }
    setMeta("og:url", fullCanonical, true);
    setMeta("og:image", fullOgImage, true);
    setMeta("twitter:image", fullOgImage);
    setMeta("og:type", "website", true);
    setMeta("og:site_name", COMPANY_CONTACT.companyName, true);

    // Handle robots - public pages should NEVER have noindex
    if (noindex) {
      setMeta("robots", "noindex, nofollow");
    } else {
      // Ensure public pages are indexable - set index, follow
      setMeta("robots", "index, follow");
    }

    // Twitter card type
    setMeta("twitter:card", "summary_large_image");

    // Google Site Verification - inject if configured
    if (SEO_CONFIG.googleSiteVerification) {
      setMeta("google-site-verification", SEO_CONFIG.googleSiteVerification);
    }

    // Cleanup function not needed since we want meta tags to persist
  }, [title, description, fullCanonical, fullOgImage, noindex]);

  return null;
};

// SEO data for each page
export const SEO_DATA = {
  home: {
    title: "Nivra Telecom | Télécom prépayée au Québec, sans engagement",
    description:
      "Services télécom sans contrat au Québec : mobile prépayé, Internet haute vitesse, télévision IPTV et sécurité résidentielle. Activation rapide, prix transparents.",
  },
  about: {
    title: "À propos de Nivra Telecom | Notre mission et valeurs",
    description:
      "Découvrez Nivra Telecom, entreprise québécoise de télécommunications prépayées. Services simples, rapides et sans engagement pour tous les Québécois.",
  },
  contact: {
    title: "Contactez Nivra Telecom | Support client au Québec",
    description:
      "Contactez notre équipe de support : 438-544-2233, support@nivratelecom.ca. Service en français, réponse rapide, lun-ven 9h-22h.",
  },
  services: {
    title: "Nos services télécom | Nivra Telecom Québec",
    description:
      "Internet haute vitesse, télévision IPTV, téléphonie mobile prépayée et sécurité résidentielle. Services sans contrat disponibles partout au Québec.",
  },
  internet: {
    title: "Forfaits Internet haute vitesse | Nivra Telecom Québec",
    description:
      "Internet illimité haute vitesse sans contrat. Forfaits de 25 à 1000 Mbps, installation rapide, équipement inclus. Vérifiez la disponibilité à votre adresse.",
  },
  tv: {
    title: "Forfaits télévision IPTV | Nivra Telecom Québec",
    description:
      "Télévision IPTV sans contrat avec 100+ chaînes. Forfaits personnalisables, enregistrement cloud, 4K disponible. Essayez sans engagement.",
  },
  mobile: {
    title: "Forfaits mobile prépayés | Nivra Telecom Québec",
    description:
      "Téléphonie mobile prépayée sans contrat. Données, appels et textos illimités. Activez votre carte SIM en ligne, réseau fiable partout au Québec.",
  },
  streaming: {
    title: "Services de streaming | Nivra Telecom Québec",
    description:
      "Ajoutez Netflix, Disney+, Spotify et plus à votre forfait. Prix réduits en combinant avec nos services télécom.",
  },
  faq: {
    title: "FAQ - Questions fréquentes | Nivra Telecom",
    description:
      "Trouvez les réponses à vos questions sur les forfaits, l'installation, la facturation et le support technique chez Nivra Telecom.",
  },
  careers: {
    title: "Carrières chez Nivra Telecom | Emplois au Québec",
    description:
      "Joignez l'équipe Nivra Telecom! Postes disponibles en vente, support technique et service client. Travaillez dans une entreprise québécoise en croissance.",
  },
  privacy: {
    title: "Politique de confidentialité | Nivra Telecom",
    description:
      "Consultez notre politique de confidentialité et protection des données personnelles conforme à la Loi 25 du Québec.",
  },
  terms: {
    title: "Conditions d'utilisation | Nivra Telecom",
    description:
      "Conditions générales d'utilisation des services Nivra Telecom. Lisez nos termes avant de souscrire à nos forfaits télécom.",
  },
} as const;

export default SEOHead;
