import { ReactNode } from "react";
import AnnouncementBar from "@/components/layout/AnnouncementBar";
import { useLiveActivityTracker } from "@/hooks/useLiveActivityTracker";

interface PublicLayoutProps {
  children: ReactNode;
}

export const PublicLayout = ({ children }: PublicLayoutProps) => {
  // Activate live tracking for all public pages (page_view auto on route change)
  useLiveActivityTracker();

  return (
    <div className="text-foreground">
      {/* Skip navigation — WCAG 2.1 AA */}
      <a href="#main-content" className="skip-nav">
        Aller au contenu principal
      </a>
      {/* Promotional announcement bar */}
      <AnnouncementBar />
      {children}
    </div>
  );
};
