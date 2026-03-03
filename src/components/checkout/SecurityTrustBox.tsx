/**
 * Rogers-style Security Trust Box
 * Lock icon + DigiCert badge + 256-bit encryption text
 * Clean, minimal - matches Rogers checkout footer
 */
import { Lock, Phone, Mail } from "lucide-react";
import { COMPANY_CONTACT, getMailtoLink, getTelLink } from "@/config/company";

interface SecurityTrustBoxProps {
  isFrench?: boolean;
  showSupport?: boolean;
  supportPhone?: string;
  supportEmail?: string;
}

export const SecurityTrustBox = ({ 
  isFrench = true, 
  showSupport = true,
  supportPhone = COMPANY_CONTACT.supportPhoneDisplay,
  supportEmail = COMPANY_CONTACT.supportEmailDisplay
}: SecurityTrustBoxProps) => {
  return (
    <div className="space-y-5 mt-6">
      {/* Rogers-style security footer */}
      <div className="flex items-center gap-3 py-4">
        <Lock className="w-5 h-5 text-slate-500 flex-shrink-0" />
        <p className="text-xs text-slate-500 leading-relaxed">
          {isFrench 
            ? "Protégé par un chiffrement sécurisé 256 bits pour garantir la sécurité de vos données."
            : "Protected by 256-bit secure encryption to ensure the security of your data."}
        </p>
      </div>

      {/* Support Callout - clean links */}
      {showSupport && (
        <div className="border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-900 mb-2">
            {isFrench ? "Besoin d'aide?" : "Need help?"}
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <a 
              href={getTelLink()}
              className="flex items-center gap-1.5 text-red-600 hover:underline"
            >
              <Phone className="w-4 h-4" />
              {supportPhone}
            </a>
            <a 
              href={getMailtoLink()}
              className="flex items-center gap-1.5 text-red-600 hover:underline"
            >
              <Mail className="w-4 h-4" />
              {supportEmail}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityTrustBox;
