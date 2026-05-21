import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

export interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
  lang?: "fr" | "en";
  keywords?: string[];
}

const SITE_NAME = "Nivra Telecom";
const BASE_URL = "https://nivra-telecom.ca";
const DEFAULT_IMAGE = "/og-image.png";
const TWITTER_HANDLE = "@NivraTelecom";

/**
 * SEO — Unified per-page SEO head component.
 * Renders title (with Nivra Telecom suffix), meta description, canonical,
 * Open Graph, Twitter cards, robots, and language metadata.
 */
export const SEO = ({
  title,
  description,
  canonical,
  image = DEFAULT_IMAGE,
  type = "website",
  noindex = false,
  lang = "fr",
  keywords,
}: SEOProps) => {
  const location = useLocation();
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const canonicalUrl = canonical || `${BASE_URL}${location.pathname}`;
  const imageUrl = image.startsWith("http") ? image : `${BASE_URL}${image}`;
  const htmlLang = lang === "en" ? "en-CA" : "fr-CA";

  return (
    <Helmet>
      <html lang={htmlLang} />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && keywords.length > 0 && (
        <meta name="keywords" content={keywords.join(", ")} />
      )}
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:locale" content={lang === "en" ? "en_CA" : "fr_CA"} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
};

export default SEO;
