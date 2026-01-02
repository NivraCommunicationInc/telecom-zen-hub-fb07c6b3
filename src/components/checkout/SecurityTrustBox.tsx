import { Shield, Lock, Phone, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SecurityTrustBoxProps {
  isFrench?: boolean;
  showSupport?: boolean;
  supportPhone?: string;
  supportEmail?: string;
}

export const SecurityTrustBox = ({ 
  isFrench = true, 
  showSupport = true,
  supportPhone = "1-888-NIVRA",
  supportEmail = "support@nivra.ca"
}: SecurityTrustBoxProps) => {
  return (
    <div className="space-y-4">
      {/* Security Notice */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold text-foreground">
                {isFrench ? "Sécurité & Confidentialité" : "Security & Privacy"}
              </h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Lock className="w-3 h-3" />
                  {isFrench 
                    ? "Ne partagez jamais de NAS ou de données bancaires par courriel."
                    : "Never share SIN or banking information by email."}
                </li>
                <li className="flex items-center gap-2">
                  <Shield className="w-3 h-3" />
                  {isFrench 
                    ? "Vos informations sont protégées et utilisées uniquement pour traiter votre demande."
                    : "Your information is protected and used only to process your request."}
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Support Callout */}
      {showSupport && (
        <Card className="bg-muted/50 border-border">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  {isFrench ? "Besoin d'aide?" : "Need help?"}
                </h4>
                <div className="flex flex-wrap gap-3 text-xs">
                  <a 
                    href={`tel:${supportPhone.replace(/[^0-9]/g, '')}`}
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <Phone className="w-3 h-3" />
                    {supportPhone}
                  </a>
                  <a 
                    href={`mailto:${supportEmail}`}
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <Mail className="w-3 h-3" />
                    {supportEmail}
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SecurityTrustBox;
