import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageSEO from "@/components/shared/PageSEO";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <>
      <PageSEO
        title="Page introuvable"
        description="La page que vous recherchez n'existe pas ou a été déplacée."
        path={location.pathname}
        noindex
      />
      <Header />
      <div className="min-h-screen flex items-center justify-center bg-background p-4 pt-24">
        <div className="text-center space-y-5 max-w-lg">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <SearchX className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-5xl font-extrabold text-foreground">404</h1>
          <p className="text-xl font-semibold text-foreground">
            Page introuvable
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            La page <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{location.pathname}</code> n'existe pas ou a été déplacée.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button asChild>
              <Link to="/">Retour à l'accueil</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/forfaits">Voir nos forfaits</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/contact-us">Contactez-nous</Link>
            </Button>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
