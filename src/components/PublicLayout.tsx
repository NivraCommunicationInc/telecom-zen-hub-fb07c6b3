import { ReactNode } from "react";
import { useLiveActivityTracker } from "@/hooks/useLiveActivityTracker";

interface PublicLayoutProps {
  children: ReactNode;
}

export const PublicLayout = ({ children }: PublicLayoutProps) => {
  useLiveActivityTracker();

  return (
    <div className="text-foreground">
      <a href="#main-content" className="skip-nav">
        Aller au contenu principal
      </a>
      {children}
    </div>
  );
};
