/**
 * Client Portal - Contracts Page
 * 
 * Displays client's contracts.
 */

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, Calendar, Download, ExternalLink } from "lucide-react";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Contract {
  id: string;
  contract_name: string;
  contract_number: string;
  contract_url: string;
  is_signed: boolean;
  created_at: string;
}

const PortalContracts = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isFrench = language === "fr";
  
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchContracts = async () => {
      const { data: { session } } = await portalSupabase.auth.getSession();
      
      if (!session) {
        navigate("/portal/auth", { 
          state: { redirectTo: "/portal/contracts" },
          replace: true 
        });
        return;
      }

      const { data } = await portalSupabase
        .from("contracts")
        .select("id, contract_name, contract_number, contract_url, is_signed, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      setContracts(data || []);
      setIsLoading(false);
    };

    fetchContracts();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-24" />
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
          {isFrench ? "Mes contrats" : "My Contracts"}
        </h1>

        {contracts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {isFrench ? "Aucun contrat trouvé" : "No contracts found"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {contracts.map((contract) => (
              <Card key={contract.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {contract.contract_name}
                    </CardTitle>
                    <Badge variant={contract.is_signed ? "default" : "secondary"}>
                      {contract.is_signed 
                        ? (isFrench ? "Signé" : "Signed")
                        : (isFrench ? "En attente" : "Pending")
                      }
                    </Badge>
                  </div>
                  <CardDescription>
                    #{contract.contract_number}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(contract.created_at), "PPP", { 
                        locale: isFrench ? fr : undefined 
                      })}
                    </div>
                    {contract.contract_url && (
                      <a 
                        href={contract.contract_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          {isFrench ? "Voir le contrat" : "View Contract"}
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PortalContracts;
