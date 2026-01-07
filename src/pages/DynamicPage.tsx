import { useParams } from "react-router-dom";
import { useSitePage } from "@/hooks/useSitePage";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";

export default function DynamicPage() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const { data: page, isLoading, error } = useSitePage(slug || "");

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
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
      <div className="min-h-screen flex flex-col">
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

  const title = language === "en" && page.title_en ? page.title_en : page.title_fr;
  const body = language === "en" && page.body_en ? page.body_en : page.body_fr;
  const metaDescription =
    language === "en" && page.meta_description_en
      ? page.meta_description_en
      : page.meta_description_fr;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        {metaDescription && (
          <meta name="description" content={metaDescription} />
        )}
        <h1 className="text-3xl font-bold mb-6">{title}</h1>
        <div
          className="prose prose-lg dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: body }}
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
