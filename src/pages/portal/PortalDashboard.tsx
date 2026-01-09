/**
 * Client Portal Dashboard
 * 
 * Main dashboard for clients to view their account, orders, and services.
 */

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ShoppingCart, 
  FileText, 
  CreditCard, 
  HelpCircle,
  LogOut,
  User,
  Package
} from "lucide-react";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { purgeAllStoredTokens } from "@/lib/inMemoryStorage";

interface ClientInfo {
  email: string;
  full_name?: string;
  account_number?: string;
}

const PortalDashboard = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isFrench = language === "fr";
  
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await portalSupabase.auth.getSession();
      
      if (!session) {
        navigate("/portal/auth", { replace: true });
        return;
      }

      // Fetch profile info
      const { data: profileData } = await portalSupabase
        .from("profiles")
        .select("email, full_name, client_number")
        .eq("user_id", session.user.id)
        .single();

      if (profileData) {
        setClientInfo({
          email: profileData.email || session.user.email || "",
          full_name: profileData.full_name || undefined,
          account_number: profileData.client_number || undefined,
        });
      } else {
        setClientInfo({
          email: session.user.email || "",
        });
      }

      setIsLoading(false);
    };

    checkSession();
  }, [navigate]);

  const handleLogout = async () => {
    await portalSupabase.auth.signOut();
    purgeAllStoredTokens();
    navigate("/portal/auth", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  const menuItems = [
    {
      title: isFrench ? "Nouvelle commande" : "New Order",
      description: isFrench ? "Commander un nouveau service" : "Order a new service",
      icon: ShoppingCart,
      href: "/portal/new-order",
      variant: "default" as const,
    },
    {
      title: isFrench ? "Mes commandes" : "My Orders",
      description: isFrench ? "Voir l'historique des commandes" : "View order history",
      icon: Package,
      href: "/portal/orders",
      variant: "outline" as const,
    },
    {
      title: isFrench ? "Mes contrats" : "My Contracts",
      description: isFrench ? "Consulter vos contrats" : "View your contracts",
      icon: FileText,
      href: "/portal/contracts",
      variant: "outline" as const,
    },
    {
      title: isFrench ? "Paiements" : "Payments",
      description: isFrench ? "Gérer vos paiements" : "Manage payments",
      icon: CreditCard,
      href: "/portal/payments",
      variant: "outline" as const,
    },
    {
      title: isFrench ? "Support" : "Support",
      description: isFrench ? "Obtenir de l'aide" : "Get help",
      icon: HelpCircle,
      href: "/portal/support",
      variant: "outline" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">
                {clientInfo?.full_name || (isFrench ? "Client" : "Client")}
              </p>
              <p className="text-sm text-muted-foreground">
                {clientInfo?.account_number && `#${clientInfo.account_number} · `}
                {clientInfo?.email}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            {isFrench ? "Déconnexion" : "Logout"}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">
          {isFrench ? "Tableau de bord" : "Dashboard"}
        </h1>

        <div className="grid gap-4 md:grid-cols-2">
          {menuItems.map((item) => (
            <Link key={item.href} to={item.href}>
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{item.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default PortalDashboard;
