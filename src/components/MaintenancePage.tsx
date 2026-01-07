import { useLanguage } from "@/contexts/LanguageContext";
import { Construction, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface MaintenancePageProps {
  eta?: string | null;
  messageFr?: string;
  messageEn?: string;
}

const MaintenancePage = ({ eta, messageFr, messageEn }: MaintenancePageProps) => {
  const { language } = useLanguage();
  
  const message = language === "fr" 
    ? (messageFr || "Notre site est temporairement en maintenance. Merci de votre patience.")
    : (messageEn || "Our site is temporarily under maintenance. Thank you for your patience.");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
          <Construction className="w-10 h-10 text-accent" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {language === "fr" ? "Site en maintenance" : "Site Under Maintenance"}
          </h1>
          <p className="text-muted-foreground">
            {message}
          </p>
        </div>

        {eta && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
            <Clock className="w-4 h-4" />
            <span>
              {language === "fr" ? "Retour estimé: " : "Estimated return: "}
              {eta}
            </span>
          </div>
        )}

        <div className="pt-4 space-y-3">
          <Link to="/contact">
            <Button variant="outline" className="w-full">
              {language === "fr" ? "Nous contacter" : "Contact Us"}
            </Button>
          </Link>
          <Link to="/portal/auth">
            <Button variant="ghost" className="w-full text-sm">
              {language === "fr" ? "Accès portail client" : "Client Portal Access"}
            </Button>
          </Link>
        </div>

        <p className="text-xs text-muted-foreground/60">
          Nivra Télécom
        </p>
      </div>
    </div>
  );
};

export default MaintenancePage;
