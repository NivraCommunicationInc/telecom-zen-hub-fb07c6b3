import { Helmet } from "react-helmet-async";
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
 * SEOHead - Dynamic SEO meta tags for each page via react-helmet-async.
 * Updates document head with title, description, canonical, OG, Twitter cards.
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

  return (
    <Helmet>
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={fullCanonical} />

      {/* Robots */}
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />

      {/* Open Graph */}
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:image" content={fullOgImage} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="fr_CA" />
      <meta property="og:site_name" content={COMPANY_CONTACT.companyName} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@NivraQC" />
      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={fullOgImage} />

      {/* Google Site Verification */}
      {SEO_CONFIG.googleSiteVerification && (
        <meta name="google-site-verification" content={SEO_CONFIG.googleSiteVerification} />
      )}
    </Helmet>
  );
};

// SEO data for each page
export const SEO_DATA = {
  home: {
    title: "Nivra Telecom | Internet & TV prépayé au Québec",
    description:
      "Internet haute vitesse dès 45$/mois, TV et Mobile 4G sans contrat au Québec. Zéro vérification de crédit, activation en 10 min. Alternative à Bell et Vidéotron. Montréal, Laval, Québec, Rive-Sud.",
  },
  about: {
    title: "À propos de Nivra Telecom | Notre mission et valeurs",
    description:
      "Découvrez Nivra Telecom, entreprise québécoise de télécommunications prépayées. Services simples, rapides et sans engagement pour tous les Québécois.",
  },
  contact: {
    title: "Contactez Nivra Telecom | Support client au Québec",
    description:
      "Contactez notre équipe de support via chat ou tickets. Service en français, réponse entre 1h et 24h, lun-ven 9h-22h.",
  },
  services: {
    title: "Nos services télécom | Nivra Telecom Québec",
    description:
      "Internet haute vitesse, télévision IPTV, téléphonie mobile prépayée et sécurité résidentielle. Services sans contrat disponibles partout au Québec.",
  },
  internet: {
    title: "Internet haute vitesse au Québec | Nivra Telecom",
    description:
      "Forfaits Internet sans contrat au Québec : 400, 600 Mbps et GIGA 940 Mbps. Données illimitées. Aucune vérification de crédit. Prix à vie garanti. Dès 45$/mois taxes incluses.",
  },
  tv: {
    title: "Télévision au Québec | Nivra Telecom — Forfaits dès 75$/mois",
    description:
      "Forfaits TV IPTV sans contrat au Québec. 100+ chaînes HD : générales, sports, cinéma. Sans engagement, sans vérification de crédit. Bundlé avec Internet dès 75$/mois.",
  },
  mobile: {
    title: "Forfaits Mobile 4G au Québec | Nivra Telecom — Dès 50$/mois",
    description:
      "Mobile 4G illimité Canada. 50 Go et 75 Go. Appels illimités. SMS/MMS internationaux. Dès 50$/mois.",
  },
  streaming: {
    title: "Services de streaming | Nivra Telecom Québec",
    description:
      "Ajoutez Netflix, Disney+, Spotify et plus à votre forfait Nivra. Prix réduits disponibles en combinant avec Internet, TV ou mobile sans contrat au Québec.",
  },
  faq: {
    title: "FAQ Internet sans contrat Québec | Nivra Telecom",
    description:
      "Questions fréquentes sur l'Internet sans contrat, la vérification de crédit, l'activation, la facturation et le support chez Nivra Telecom. Réponses rapides.",
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
