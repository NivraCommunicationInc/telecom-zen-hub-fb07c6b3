import { Mail, HelpCircle } from "lucide-react";
import { PARTNER_CONTACT, getPartnerMailtoLink } from "@/config/partnerContact";

interface PartnerHelpFooterProps {
  showPartnersEmail?: boolean;
  className?: string;
}

/**
 * Reusable footer component for all Partner Portal pages
 * Shows support contact information consistently
 */
const PartnerHelpFooter = ({ showPartnersEmail = true, className = "" }: PartnerHelpFooterProps) => {
  return (
    <div className={`mt-8 pt-6 border-t border-border ${className}`}>
      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          <span>Besoin d'aide?</span>
          <a
            href={getPartnerMailtoLink("support")}
            className="text-primary hover:underline font-medium"
          >
            {PARTNER_CONTACT.supportEmailDisplay}
          </a>
        </div>
        
        {showPartnersEmail && (
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            <span>Programme partenaires:</span>
            <a
              href={getPartnerMailtoLink("partners")}
              className="text-primary hover:underline font-medium"
            >
              {PARTNER_CONTACT.partnersEmailDisplay}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerHelpFooter;
