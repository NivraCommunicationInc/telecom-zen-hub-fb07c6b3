import { Button } from "@/components/ui/button";
import { ShieldX, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const NotAuthorized = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-hero p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-6">
          <ShieldX className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="font-display text-3xl font-bold text-primary-foreground mb-4">
          Accès non autorisé
        </h1>
        <p className="text-muted-foreground mb-8">
          Vous n'avez pas les permissions nécessaires pour accéder à cette page. 
          Seuls les administrateurs peuvent accéder au tableau de bord.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild variant="hero">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à l'accueil
            </Link>
          </Button>
          <Button asChild variant="heroOutline">
            <Link to="/admin/login">
              Se connecter
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotAuthorized;
