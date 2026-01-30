import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export interface BreadcrumbItem {
  name: string;
  url?: string;
}

interface BreadcrumbSchemaProps {
  items?: BreadcrumbItem[];
  autoGenerate?: boolean;
}

// French labels for common routes
const ROUTE_LABELS: Record<string, string> = {
  "": "Accueil",
  "about": "À propos",
  "a-propos": "À propos",
  "contact": "Contact",
  "faq": "FAQ",
  "services": "Services",
  "mobile": "Mobile",
  "mobile-plans": "Forfaits Mobile",
  "internet": "Internet",
  "tv": "Télévision",
  "television": "Télévision",
  "streaming": "Streaming",
  "security": "Sécurité",
  "securite": "Sécurité",
  "support": "Support",
  "careers": "Carrières",
  "carrieres": "Carrières",
  "blog": "Blog",
  "news": "Actualités",
  "terms": "Conditions",
  "privacy": "Confidentialité",
  "legal": "Légal",
  "checkout": "Commander",
  "order": "Commande",
};

/**
 * BreadcrumbSchema - Generates JSON-LD structured data for breadcrumbs
 * Helps Google display breadcrumb trails in search results
 * @see https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
 */
export const BreadcrumbSchema = ({ items, autoGenerate = true }: BreadcrumbSchemaProps) => {
  const location = useLocation();

  useEffect(() => {
    const scriptId = "breadcrumb-schema";

    // Remove existing script if present
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    let breadcrumbs: BreadcrumbItem[] = [];

    if (items && items.length > 0) {
      // Use provided items
      breadcrumbs = items;
    } else if (autoGenerate) {
      // Auto-generate from current path
      const pathSegments = location.pathname.split("/").filter(Boolean);
      
      // Always start with home
      breadcrumbs.push({ name: "Accueil", url: "https://nivratelecom.com/" });

      // Build breadcrumb trail
      let currentPath = "";
      pathSegments.forEach((segment, index) => {
        currentPath += `/${segment}`;
        const label = ROUTE_LABELS[segment] || segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        
        // Last item doesn't get a URL (current page)
        if (index === pathSegments.length - 1) {
          breadcrumbs.push({ name: label });
        } else {
          breadcrumbs.push({ name: label, url: `https://nivratelecom.com${currentPath}` });
        }
      });
    }

    if (breadcrumbs.length <= 1) return; // No need for breadcrumbs on homepage only

    const schema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        ...(item.url && { item: item.url }),
      })),
    };

    const script = document.createElement("script");
    script.id = scriptId;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.getElementById(scriptId);
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [items, autoGenerate, location.pathname]);

  return null;
};

export default BreadcrumbSchema;
