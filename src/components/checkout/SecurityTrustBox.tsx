/**
 * Rogers-style Security Trust Box
 * Lock icon + DigiCert badge + 256-bit encryption text
 * Clean, minimal - matches Rogers checkout footer
 *
 * NOTE: Nivra ne fournit AUCUN support téléphonique. Le seul canal officiel
 * est support@nivra-telecom.ca (+ chat sur le site). Aucun numéro de téléphone
 * ne doit être affiché ici.
 */
import { Lock, Mail } from "lucide-react";
import { COMPANY_CONTACT, getMailtoLink } from "@/config/company";

interface SecurityTrustBoxProps {
  isFrench?: boolean;
  showSupport?: boolean;
  /** @deprecated phone support has been removed — kept only for prop compat */
  supportPhone?: string;
  supportEmail?: string;
}

export const SecurityTrustBox = ({
  isFrench = true,
  showSupport = true,
  supportEmail = COMPANY_CONTACT.supportEmailDisplay,
}: SecurityTrustBoxProps) => {
  return (
    <div className="space-y-4 mt-6">
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00A651]/10 text-[#00A651] text-xs font-semibold border border-[#00A651]/20">
          <Lock className="w-3.5 h-3.5" />
          {isFrench ? "SSL 256-bit" : "SSL 256-bit"}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0066CC]/10 text-[#0066CC] text-xs font-semibold border border-[#0066CC]/20">
          {isFrench ? "PCI-DSS Level 1" : "PCI-DSS Level 1"}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[#1A1A2E] text-xs font-semibold border border-[#E5E7EB]">
          {isFrench ? "Satisfait ou remboursé 30 j" : "30-day money back"}
        </span>
      </div>

      {showSupport && (
        <div className="border-t border-[#E5E7EB] pt-4">
          <p className="text-sm font-semibold text-[#1A1A2E] mb-2">
            {isFrench ? "Besoin d'aide?" : "Need help?"}
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <a
              href={getMailtoLink()}
              className="flex items-center gap-1.5 text-[#0066CC] hover:text-[#0052A3] hover:underline font-medium"
            >
              <Mail className="w-4 h-4" />
              {supportEmail}
            </a>
          </div>
          <p className="text-xs text-[#6B7280] mt-2">
            {isFrench
              ? "Support par courriel et clavardage uniquement — réponse rapide 7j/7."
              : "Email and live chat support only — fast response 7 days a week."}
          </p>
        </div>
      )}
    </div>
  );
};

export default SecurityTrustBox;
