import { useState } from "react";
import { X } from "lucide-react";
import { useQuickAnnouncement, type QuickAnnouncementType } from "@/hooks/useQuickAnnouncement";
import { useLanguage } from "@/contexts/LanguageContext";

const TYPE_STYLES: Record<QuickAnnouncementType, { bg: string; border: string; text: string; icon: string }> = {
  info: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF", icon: "ℹ️" },
  warning: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", icon: "⚠️" },
  error: { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B", icon: "🔴" },
  success: { bg: "#F0FDF4", border: "#BBF7D0", text: "#166534", icon: "✅" },
};

/**
 * QuickAnnouncementBanner
 * Global top-of-site banner controlled from Nivra Core (/core/maintenance > Annonce).
 * Bilingual, dismissible per-session, realtime via useQuickAnnouncement.
 */
export const QuickAnnouncementBanner = () => {
  const { announcement } = useQuickAnnouncement();
  const { language } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  if (!announcement.active || dismissed) return null;

  const isFr = language === "fr";
  const message = isFr ? announcement.message_fr : announcement.message_en || announcement.message_fr;
  const linkText = isFr ? announcement.link_text_fr : announcement.link_text_en || announcement.link_text_fr;

  if (!message) return null;

  const style = TYPE_STYLES[announcement.type] ?? TYPE_STYLES.info;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: style.bg,
        borderBottom: `1px solid ${style.border}`,
        padding: "10px 20px",
      }}
    >
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex-1 text-center">
          <span style={{ fontSize: "14px", color: style.text, fontWeight: 500 }}>
            <span aria-hidden>{style.icon}</span> {message}
            {announcement.link && (
              <a
                href={announcement.link}
                style={{
                  color: style.text,
                  fontWeight: 700,
                  marginLeft: "8px",
                  textDecoration: "underline",
                }}
              >
                {linkText || (isFr ? "En savoir plus" : "Learn more")}
              </a>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={isFr ? "Fermer l'annonce" : "Dismiss announcement"}
          style={{ color: style.text, padding: "4px", borderRadius: "4px" }}
          className="hover:bg-black/5 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default QuickAnnouncementBanner;
