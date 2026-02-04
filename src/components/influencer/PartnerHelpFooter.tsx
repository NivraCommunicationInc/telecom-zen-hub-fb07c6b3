import { HelpCircle } from "lucide-react";
import { PARTNER_SUPPORT_EMAIL, getPartnerMailtoLink } from "@/config/partnerContact";

interface PartnerHelpFooterProps {
  className?: string;
}

/**
 * Reusable footer component for all Partner Portal pages
 * Shows ONLY Support@nivra-telecom.ca - no other contact email
 */
const PartnerHelpFooter = ({ className = "" }: PartnerHelpFooterProps) => {
  return (
    <div className={`mt-8 pt-6 border-t border-border ${className}`}>
      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          <span>Besoin d'aide?</span>
          <a
            href={getPartnerMailtoLink()}
            className="text-primary hover:underline font-medium"
          >
            {PARTNER_SUPPORT_EMAIL}
          </a>
        </div>
      </div>
    </div>
  );
};

export default PartnerHelpFooter;
