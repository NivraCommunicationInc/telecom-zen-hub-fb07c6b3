import { ReactNode } from "react";
import AnnouncementBar from "@/components/layout/AnnouncementBar";

interface PublicLayoutProps {
  children: ReactNode;
}

export const PublicLayout = ({ children }: PublicLayoutProps) => {
  return (
    <>
      {/* Promotional announcement bar */}
      <AnnouncementBar />
      {children}
    </>
  );
};
