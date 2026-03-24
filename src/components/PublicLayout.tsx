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
      {/* Promotional announcement bar */}
      <AnnouncementBar />
      {children}
    </div>
  );
};
