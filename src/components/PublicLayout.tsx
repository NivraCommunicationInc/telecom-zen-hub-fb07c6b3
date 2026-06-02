import { ReactNode } from "react";
import { useLiveActivityTracker } from "@/hooks/useLiveActivityTracker";
import { QuickAnnouncementBanner } from "@/components/public/QuickAnnouncementBanner";

interface PublicLayoutProps {
  children: ReactNode;
}

export const PublicLayout = ({ children }: PublicLayoutProps) => {
  useLiveActivityTracker();

  return (
    <div style={{ background: "#020209", minHeight: "100vh", color: "#fff" }}>
      <a href="#main-content" className="skip-nav">
        Aller au contenu principal
      </a>
      <QuickAnnouncementBanner />
      {children}
    </div>
  );
};
