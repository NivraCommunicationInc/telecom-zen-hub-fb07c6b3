import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Mail, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { COMPANY_CONTACT } from "@/config/company";

const ClientSuspended = () => {
  const { data: siteSettings } = useSiteSettings();
  
  // Use site_settings as source of truth, COMPANY_CONTACT as fallback
  const supportEmail = siteSettings?.support_email || COMPANY_CONTACT.supportEmailDisplay;
  const { language } = useLanguage();

  const content = {
    fr: {
      title: "Compte temporairement suspendu",
      message: "Votre accès en ligne a été suspendu pour vérification de sécurité. Veuillez nous contacter via le formulaire de contact du site ou par courriel pour réactiver votre accès.",
      contactForm: "Formulaire de contact",
      emailSupport: "Envoyer un courriel",
    },
    en: {
      title: "Account temporarily suspended",
      message: "Your online access has been suspended for a security review. Please contact us through the website contact form or by email to restore access.",
      contactForm: "Contact form",
      emailSupport: "Email support",
    },
  };

  const t = content[language as keyof typeof content] || content.fr;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl text-destructive">{t.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">{t.message}</p>
          
          <div className="flex flex-col gap-3">
            <Button asChild variant="default" className="w-full">
              <Link to="/contact">
                <MessageSquare className="w-4 h-4 mr-2" />
                {t.contactForm}
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="w-full">
              <a href={`mailto:${supportEmail.toLowerCase()}`}>
                <Mail className="w-4 h-4 mr-2" />
                {t.emailSupport}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientSuspended;
