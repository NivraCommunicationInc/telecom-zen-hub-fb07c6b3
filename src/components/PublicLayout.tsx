import { ReactNode } from "react";
import { AnnouncementBar } from "./AnnouncementBar";

interface PublicLayoutProps {
  children: ReactNode;
}

export const PublicLayout = ({ children }: PublicLayoutProps) => {
  return (
    <>
      <AnnouncementBar />
      {children}
    </>
  );
};
