import { useEffect } from "react";
import { COMPANY_CONTACT } from "@/config/company";

export interface ProductSchemaItem {
  name: string;
  description: string;
  price: number;
  priceCurrency?: string;
  sku?: string;
  category?: string;
  features?: string[];
  image?: string;
  url?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  priceValidUntil?: string;
}

interface ProductSchemaProps {
  products: ProductSchemaItem[];
  isService?: boolean;
}

/**
 * ProductSchema - Generates JSON-LD structured data for products/services
 * Helps Google display rich product snippets in search results
 * @see https://developers.google.com/search/docs/appearance/structured-data/product
 */
export const ProductSchema = ({ products, isService = true }: ProductSchemaProps) => {
  useEffect(() => {
    const scriptId = "product-schema";

    // Remove existing script if present
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    if (products.length === 0) return;

    // For services, use Service schema; for products, use Product schema
    const schemaType = isService ? "Service" : "Product";

    const schema = {
      "@context": "https://schema.org",
      "@graph": products.map((product, index) => {
        const baseSchema: Record<string, unknown> = {
          "@type": schemaType,
          "@id": `https://nivratelecom.ca/#${schemaType.toLowerCase()}-${index}`,
          name: product.name,
          description: product.description,
          provider: {
            "@type": "Organization",
            name: COMPANY_CONTACT.companyName,
            url: "https://nivratelecom.ca",
          },
          areaServed: {
            "@type": "State",
            name: "Quebec",
            containedIn: {
              "@type": "Country",
              name: "Canada",
            },
          },
        };

        // Add offers for pricing
        if (product.price > 0) {
          baseSchema.offers = {
            "@type": "Offer",
            price: product.price.toFixed(2),
            priceCurrency: product.priceCurrency || "CAD",
            availability: `https://schema.org/${product.availability || "InStock"}`,
            priceValidUntil: product.priceValidUntil || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            seller: {
              "@type": "Organization",
              name: COMPANY_CONTACT.companyName,
            },
          };
        }

        // Add category if provided
        if (product.category) {
          baseSchema.category = product.category;
        }

        // Add image if provided
        if (product.image) {
          baseSchema.image = product.image;
        }

        // Add URL if provided
        if (product.url) {
          baseSchema.url = product.url;
        }

        // Add SKU if provided
        if (product.sku) {
          baseSchema.sku = product.sku;
        }

        // Add features as itemListElement for services
        if (product.features && product.features.length > 0 && isService) {
          baseSchema.hasOfferCatalog = {
            "@type": "OfferCatalog",
            name: `${product.name} Features`,
            itemListElement: product.features.map((feature, i) => ({
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: feature,
              },
            })),
          };
        }

        return baseSchema;
      }),
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
  }, [products, isService]);

  return null;
};

export default ProductSchema;
