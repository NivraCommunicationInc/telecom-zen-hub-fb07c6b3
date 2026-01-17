import { useEffect } from "react";

export interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  faqs: FAQItem[];
  pageUrl?: string;
}

/**
 * FAQSchema - Generates JSON-LD structured data for FAQ pages
 * Helps Google display FAQ rich snippets in search results
 * @see https://developers.google.com/search/docs/appearance/structured-data/faqpage
 */
export const FAQSchema = ({ faqs, pageUrl }: FAQSchemaProps) => {
  useEffect(() => {
    const scriptId = "faq-schema";

    // Remove existing script if present
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    if (faqs.length === 0) return;

    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
      ...(pageUrl && { url: pageUrl }),
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
  }, [faqs, pageUrl]);

  return null;
};

export default FAQSchema;
