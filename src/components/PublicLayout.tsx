import { ReactNode } from "react";

interface PublicLayoutProps {
  children: ReactNode;
}

export const PublicLayout = ({ children }: PublicLayoutProps) => {
  return (
    <div className="public-dark text-foreground" style={{ background: 'hsl(230 60% 4%)' }}>
      {children}
    </div>
  );
};
