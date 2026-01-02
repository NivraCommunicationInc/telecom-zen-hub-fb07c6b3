import { useState, useEffect, useRef, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  User, ChevronUp, Shield, CreditCard, Package, Ticket, 
  FileText, Users, History, Settings, Phone, Mail, MapPin 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientInfo {
  full_name?: string;
  email?: string;
  client_number?: string;
  phone?: string;
  account_status?: string;
  security_status?: string;
  security_alert_level?: string;
  balance?: number;
  store_credit?: number;
}

interface NavSection {
  id: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

interface ClientProfileScrollContainerProps {
  client: ClientInfo;
  children: ReactNode;
  isAdmin?: boolean;
  onQuickAction?: (action: string) => void;
}

const navSections: NavSection[] = [
  { id: "overview", label: "Vue d'ensemble", icon: <User className="w-4 h-4" /> },
  { id: "services", label: "Services", icon: <Package className="w-4 h-4" /> },
  { id: "orders", label: "Commandes", icon: <CreditCard className="w-4 h-4" /> },
  { id: "tickets", label: "Tickets", icon: <Ticket className="w-4 h-4" /> },
  { id: "billing", label: "Facturation", icon: <FileText className="w-4 h-4" /> },
  { id: "authorized", label: "Autorisés", icon: <Users className="w-4 h-4" /> },
  { id: "security", label: "Sécurité", icon: <Shield className="w-4 h-4" /> },
  { id: "logs", label: "Logs", icon: <History className="w-4 h-4" />, adminOnly: true },
];

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  suspended: "bg-red-500/20 text-red-500 border-red-500/30",
  hold: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  frozen: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  deactivated: "bg-red-500/20 text-red-500 border-red-500/30",
};

const statusLabels: Record<string, string> = {
  active: "Actif",
  suspended: "Suspendu",
  hold: "En attente",
  frozen: "Gelé",
  deactivated: "Désactivé",
};

export const ClientProfileScrollContainer = ({
  client,
  children,
  isAdmin = false,
  onQuickAction,
}: ClientProfileScrollContainerProps) => {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const visibleSections = navSections.filter(
    (section) => !section.adminOnly || isAdmin
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShowBackToTop(container.scrollTop > 200);

      // Update active section based on scroll position
      const sections = visibleSections.map((s) => ({
        id: s.id,
        element: container.querySelector(`[data-section="${s.id}"]`),
      }));

      for (const section of sections.reverse()) {
        if (section.element) {
          const rect = section.element.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          if (rect.top <= containerRect.top + 100) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [visibleSections]);

  const scrollToSection = (sectionId: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const element = container.querySelector(`[data-section="${sectionId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(sectionId);
    }
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const accountStatus = client.account_status || "active";
  const hasSecurity = client.security_status === "suspended" || client.security_alert_level !== "none";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border pb-3 mb-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-lg truncate">
                {client.full_name || client.email}
              </h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {client.client_number && (
                  <span className="font-mono">{client.client_number}</span>
                )}
                {client.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {client.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge 
              variant="outline" 
              className={cn("border", statusColors[accountStatus])}
            >
              {statusLabels[accountStatus] || accountStatus}
            </Badge>
            {hasSecurity && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {client.security_alert_level === "fraud" ? "Fraude" : "Risque"}
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Navigation Bar */}
        <div className="mt-3 -mx-2 px-2 overflow-x-auto scrollbar-none">
          <div className="flex gap-1 min-w-max">
            {visibleSections.map((section) => (
              <Button
                key={section.id}
                variant={activeSection === section.id ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "flex-shrink-0 text-xs h-8 px-3 gap-1.5",
                  activeSection === section.id && "bg-primary/10 text-primary"
                )}
                onClick={() => scrollToSection(section.id)}
              >
                {section.icon}
                <span className="hidden sm:inline">{section.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto min-h-0 pr-2 scroll-smooth"
      >
        {children}
      </div>

      {/* Back to Top Button */}
      {showBackToTop && (
        <Button
          variant="secondary"
          size="icon"
          className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg animate-fade-in h-10 w-10"
          onClick={scrollToTop}
        >
          <ChevronUp className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
};

// Section wrapper component for anchor navigation
interface ProfileSectionProps {
  id: string;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const ProfileSection = ({
  id,
  title,
  icon,
  children,
  className,
}: ProfileSectionProps) => {
  return (
    <section data-section={id} className={cn("scroll-mt-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>
      {children}
    </section>
  );
};

export default ClientProfileScrollContainer;
