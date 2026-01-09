/**
 * Client Portal - New Order Page
 * 
 * Allows clients to start a new order for services.
 */

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Wifi, Tv, Smartphone, Film } from "lucide-react";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import { useLanguage } from "@/contexts/LanguageContext";

const PortalNewOrder = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isFrench = language === "fr";
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await portalSupabase.auth.getSession();
      
      if (!session) {
        navigate("/portal/auth", { 
          state: { redirectTo: "/portal/new-order" },
          replace: true 
        });
        return;
      }
      setIsAuthenticated(true);
    };

    checkSession();
  }, [navigate]);

  if (!isAuthenticated) {
    return null;
  }

  const services = [
    {
      title: "Internet",
      description: isFrench ? "Internet haute vitesse résidentiel" : "Residential high-speed internet",
      icon: Wifi,
      href: "/portal/internet",
    },
    {
      title: isFrench ? "Télévision" : "Television",
      description: isFrench ? "TV en continu avec chaînes premium" : "Streaming TV with premium channels",
      icon: Tv,
      href: "/portal/tv-order",
    },
    {
      title: "Mobile",
      description: isFrench ? "Forfaits mobiles prépayés" : "Prepaid mobile plans",
      icon: Smartphone,
      href: "/portal/mobile-order",
    },
    {
      title: "Streaming",
      description: isFrench ? "Services de streaming populaires" : "Popular streaming services",
      icon: Film,
      href: "/portal/streaming-order",
    },
  ];

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
        <h1 className="text-2xl font-bold mb-2">
          {isFrench ? "Nouvelle commande" : "New Order"}
        </h1>
        <p className="text-muted-foreground mb-6">
          {isFrench 
            ? "Sélectionnez le type de service que vous souhaitez commander"
            : "Select the type of service you want to order"
          }
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <Link key={service.href} to={service.href}>
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <service.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{service.title}</CardTitle>
                      <CardDescription>{service.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default PortalNewOrder;
