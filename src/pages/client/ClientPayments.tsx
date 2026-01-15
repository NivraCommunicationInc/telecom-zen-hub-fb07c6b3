import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { CreditCard, Banknote, Wrench, Mail, Copy, Check, Info, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { ETRANSFER_CONFIG } from "@/config/company";

const ClientPayments = () => {
  const { user } = useClientAuth();
  const [copied, setCopied] = useState(false);

  // Fetch only active cards (deleted_at IS NULL)
  const { data: paymentMethods, isLoading } = useQuery({
    queryKey: ["client-payment-methods", user?.id],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("payment_methods")
        .select("*")
        .eq("user_id", user?.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(ETRANSFER_CONFIG.email);
    setCopied(true);
    toast.success("Courriel copié!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Credit card is in maintenance mode
  const isCreditCardMaintenance = true;

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Moyens de paiement</h1>
          <p className="text-muted-foreground mt-1">Gérez vos options de paiement</p>
        </div>

        {/* Interac E-Transfer - Primary Method */}
        <Card className="bg-card border-emerald-500/30 border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-500" />
                Virement Interac
              </CardTitle>
              <Badge className="bg-emerald-500/20 text-emerald-500 border-0">
                Actif
              </Badge>
            </div>
            <CardDescription>
              Méthode de paiement principale pour vos factures et recharges.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <p className="text-sm font-medium text-foreground mb-3">
                Envoyez vos paiements à :
              </p>
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                <Mail className="w-5 h-5 text-emerald-500" />
                <span className="font-mono text-lg flex-1">{ETRANSFER_CONFIG.emailDisplay}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyEmail}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      Copié!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copier
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Question de sécurité</p>
                <p className="text-sm font-medium">{ETRANSFER_CONFIG.securityQuestion}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Réponse</p>
                <p className="text-sm font-medium">{ETRANSFER_CONFIG.securityAnswer}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Les paiements sont traités automatiquement dès réception. Un courriel de confirmation vous sera envoyé.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Credit Card Section - Maintenance Mode */}
        <Card className="bg-card border-border opacity-75">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-muted-foreground">
                <CreditCard className="w-5 h-5" />
                Cartes de crédit
              </CardTitle>
              <Badge variant="outline" className="gap-1 text-amber-600 border-amber-600/50 bg-amber-500/10">
                <Wrench className="w-3 h-3" />
                Maintenance
              </Badge>
            </div>
            <CardDescription>
              Le paiement par carte est temporairement indisponible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Wrench className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Nous travaillons à améliorer notre système de paiement par carte.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    En attendant, veuillez utiliser le virement Interac pour effectuer vos paiements. Nous vous remercions de votre compréhension.
                  </p>
                </div>
              </div>
            </div>

            {/* Show saved cards but disabled */}
            {!isLoading && paymentMethods && paymentMethods.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">Cartes enregistrées (inactives):</p>
                {paymentMethods.map((card: any) => (
                  <div
                    key={card.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-6 bg-gradient-to-br from-gray-400 to-gray-500 rounded flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">
                          {card.card_type} •••• {card.last_four}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Expire {card.expiry_month.toString().padStart(2, "0")}/{card.expiry_year}
                        </p>
                      </div>
                    </div>
                    {card.is_default && (
                      <Badge variant="outline" className="text-xs opacity-50">
                        Par défaut
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <h3 className="font-medium text-foreground">Besoin d'aide avec un paiement?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Notre équipe est disponible pour vous assister.
                </p>
              </div>
              <Button variant="outline" className="gap-2" asChild>
                <a href="/contact">
                  Nous contacter
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientPayments;
