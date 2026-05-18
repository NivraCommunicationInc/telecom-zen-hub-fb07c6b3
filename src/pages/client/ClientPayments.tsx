import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { CreditCard, Banknote, Wrench, Mail, Copy, Check, Info, ExternalLink, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { ETRANSFER_CONFIG } from "@/config/company";
import { PaymentHistoryV2 } from "@/components/client/PaymentHistoryV2";

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

  // Credit card is handled via PayPal hosted card flow (no separate processor)
  const isCreditCardMaintenance = false;

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

        {/* Payment History - V2 canonical source */}
        {user?.id && <PaymentHistoryV2 userId={user.id} />}

        {/* PayPal Section */}
        <Card className="bg-card border-blue-500/30 border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.554 9.488c.121.563.106 1.246-.04 2.017-.582 2.464-2.477 3.88-5.336 3.88h-.71c-.323 0-.6.216-.665.524l-.513 3.292-.146.935c-.033.211.127.403.34.403h2.398c.283 0 .526-.19.581-.468l.024-.123.46-2.922.03-.163c.055-.278.298-.468.58-.468h.367c2.369 0 4.221-1.042 4.762-4.057.226-1.261.11-2.314-.488-3.054a2.57 2.57 0 0 0-.644-.563c.138.244.252.505.34.78z" fill="#179BD7"/>
                  <path d="M18.474 9.081a5.97 5.97 0 0 0-.74-.195 9.456 9.456 0 0 0-1.505-.11h-4.562c-.283 0-.526.19-.581.467l-.973 6.17-.028.18c.065-.308.342-.524.665-.524h1.386c2.84 0 5.062-1.155 5.713-4.495.019-.099.036-.195.05-.289a3.09 3.09 0 0 0-.425-.204z" fill="#222D65"/>
                  <path d="M10.663 9.243a.595.595 0 0 1 .58-.467h4.563c.541 0 1.047.037 1.505.11.129.02.254.045.375.073.128.03.25.063.365.1.058.018.113.038.168.058a3.1 3.1 0 0 1 .257.103c.086-.55.085-1.106-.027-1.648-.376-1.822-1.667-2.573-3.612-2.573h-5.8c-.323 0-.6.216-.665.524L6.67 17.403c-.04.253.152.48.408.48h2.972l.746-4.733.867-3.907z" fill="#253B80"/>
                </svg>
                PayPal
              </CardTitle>
              <Badge className="bg-blue-500/20 text-blue-500 border-0">
                Actif
              </Badge>
            </div>
            <CardDescription>
              Payez directement avec votre compte PayPal ou carte de crédit/débit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm font-medium text-foreground mb-3">
                Paiement sécurisé PayPal
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Payez avec votre solde PayPal, compte bancaire ou carte</p>
                <p>• Protection acheteur incluse</p>
                <p>• Paiement instantané et confirmation immédiate</p>
              </div>
            </div>
            
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                L'option PayPal apparaît automatiquement lors du paiement de vos factures et commandes.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Credit Card Section — handled via PayPal hosted card flow */}
        <Card className="bg-card border-border opacity-60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-muted-foreground" />
                Cartes de crédit / débit
              </CardTitle>
              <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">
                Via PayPal
              </Badge>
            </div>
            <CardDescription>
              Payez par carte de crédit ou débit directement via PayPal — aucun compte PayPal requis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Sélectionnez PayPal ci-dessus pour payer par carte — c'est rapide, sécurisé et sans frais supplémentaires.
              </p>
            </div>
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
