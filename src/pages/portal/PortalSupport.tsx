/**
 * Client Portal - Support Page
 * 
 * Allows clients to view and create support tickets.
 */

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, HelpCircle, MessageSquare, Plus, Phone, Mail } from "lucide-react";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { COMPANY_CONTACT } from "@/config/company";

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  created_at: string;
}

const PortalSupport = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isFrench = language === "fr";
  const { data: siteSettings } = useSiteSettings();
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supportPhone = siteSettings?.support_phone || COMPANY_CONTACT.supportPhoneDisplay;
  const supportEmail = siteSettings?.support_email || COMPANY_CONTACT.supportEmail;

  useEffect(() => {
    const fetchTickets = async () => {
      const { data: { session } } = await portalSupabase.auth.getSession();
      
      if (!session) {
        navigate("/portal/auth", { 
          state: { redirectTo: "/portal/support" },
          replace: true 
        });
        return;
      }

      const { data } = await portalSupabase
        .from("support_tickets")
        .select("id, ticket_number, subject, status, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      setTickets(data || []);
      setIsLoading(false);
    };

    fetchTickets();
  }, [navigate]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      open: "default",
      pending: "secondary",
      resolved: "outline",
      closed: "outline",
    };
    const labels: Record<string, string> = {
      open: isFrench ? "Ouvert" : "Open",
      pending: isFrench ? "En attente" : "Pending",
      resolved: isFrench ? "Résolu" : "Resolved",
      closed: isFrench ? "Fermé" : "Closed",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-32" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link to="/portal/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isFrench ? "Retour au tableau de bord" : "Back to dashboard"}
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">
          {isFrench ? "Support" : "Support"}
        </h1>

        {/* Contact Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">
              {isFrench ? "Nous contacter" : "Contact Us"}
            </CardTitle>
            <CardDescription>
              {isFrench 
                ? "Besoin d'aide? Contactez notre équipe de support."
                : "Need help? Contact our support team."
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <a href={`tel:+1${supportPhone.replace(/[^+\d]/g, '')}`}>
                <Button variant="outline">
                  <Phone className="w-4 h-4 mr-2" />
                  {supportPhone}
                </Button>
              </a>
              <a href={`mailto:${supportEmail}`}>
                <Button variant="outline">
                  <Mail className="w-4 h-4 mr-2" />
                  {supportEmail}
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Tickets */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {isFrench ? "Mes tickets" : "My Tickets"}
          </h2>
        </div>

        {tickets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {isFrench ? "Aucun ticket trouvé" : "No tickets found"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <Card key={ticket.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      #{ticket.ticket_number}
                    </CardTitle>
                    {getStatusBadge(ticket.status)}
                  </div>
                  <CardDescription>{ticket.subject}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(ticket.created_at), "PPP", { 
                      locale: isFrench ? fr : undefined 
                    })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PortalSupport;
