import { useParams } from "react-router-dom";
import { useMemo } from "react";
import DOMPurify from "dompurify";
import { useSitePage } from "@/hooks/useSitePage";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";

// Strict HTML sanitization configuration - only allow safe formatting tags
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'blockquote', 'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'hr', 'span', 'div', 'sub', 'sup'
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur', 'style'],
};

// Configure DOMPurify to prevent javascript: URLs
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  // Check href attributes for javascript: protocol
  if (node.hasAttribute('href')) {
    const href = node.getAttribute('href') || '';
    if (href.toLowerCase().startsWith('javascript:') || href.toLowerCase().startsWith('data:')) {
      node.removeAttribute('href');
    }
  }
  // Force external links to open safely
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    const href = node.getAttribute('href') || '';
    if (href.startsWith('http://') || href.startsWith('https://')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  }
});

export default function DynamicPage() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const { data: page, isLoading, error } = useSitePage(slug || "");

  // Memoize sanitized content to avoid re-sanitizing on every render
  const sanitizedBody = useMemo(() => {
    if (!page) return "";
    const rawBody = language === "en" && page.body_en ? page.body_en : page.body_fr;
    return DOMPurify.sanitize(rawBody, DOMPURIFY_CONFIG);
  }, [page, language]);

  const title = useMemo(() => {
    if (!page) return "";
    return language === "en" && page.title_en ? page.title_en : page.title_fr;
  }, [page, language]);

  const metaDescription = useMemo(() => {
    if (!page) return "";
    return language === "en" && page.meta_description_en
      ? page.meta_description_en
      : page.meta_description_fr;
  }, [page, language]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col public-dark" style={{ background: 'hsl(230 60% 4%)' }}>
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
          <Skeleton className="h-10 w-2/3 mb-6" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex flex-col public-dark" style={{ background: 'hsl(230 60% 4%)' }}>
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl text-center">
          <h1 className="text-2xl font-bold mb-4">Page non trouvée</h1>
          <p className="text-muted-foreground">
            La page demandée n'existe pas ou n'est pas publiée.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col public-dark" style={{ background: 'hsl(230 60% 4%)' }}>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        {metaDescription && (
          <meta name="description" content={metaDescription} />
        )}
        <h1 className="text-3xl font-bold mb-6">{title}</h1>
        <div
          className="prose prose-lg dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizedBody }}
        />
        <p className="text-xs text-muted-foreground mt-8">
          Dernière mise à jour:{" "}
          {new Date(page.updated_at).toLocaleDateString("fr-CA")}
        </p>
      </main>
      <Footer />
    </div>
  );
}
