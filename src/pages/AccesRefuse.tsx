import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageSEO from "@/components/shared/PageSEO";

export default function AccesRefuse() {
  return (
    <>
      <PageSEO
        title="Accès refusé"
        description="Vous n'avez pas les permissions nécessaires pour accéder à cette page."
        path="/acces-refuse"
        noindex
      />
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-5 max-w-md">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-4xl font-extrabold text-foreground">403</h1>
          <p className="text-lg font-semibold text-foreground">Accès refusé</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
          <Button asChild className="mt-4">
            <Link to="/">Retour à l'accueil</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
