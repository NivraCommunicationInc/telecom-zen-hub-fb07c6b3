import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useClientAuth } from "@/hooks/useClientAuth";
import { CreditCard, Banknote, Mail, Copy, Check, Info, ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ETRANSFER_CONFIG } from "@/config/company";
import { PaymentHistoryV2 } from "@/components/client/PaymentHistoryV2";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";

const ClientPayments = () => {
  const { user } = useClientAuth();
  const [copied, setCopied] = useState(false);
  const { data: canonicalData } = useCanonicalClientData(user?.id);

  const squareCardId = (canonicalData?.billingCustomer as any)?.square_card_id;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(ETRANSFER_CONFIG.email);
    setCopied(true);
    toast.success("Courriel copié!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Moyens de paiement</h1>
          <p className="text-muted-foreground mt-1">Gérez vos options de paiement</p>
        </div>

        {/* Interac E-Transfer */}
        <Card className="bg-card border-emerald-500/30 border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-500" />
                Virement Interac
              </CardTitle>
              <Badge className="bg-emerald-500/20 text-emerald-500 border-0">Actif</Badge>
            </div>
            <CardDescription>
              Méthode de paiement principale pour vos factures et recharges.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <p className="text-sm font-medium text-foreground mb-3">Envoyez vos paiements à :</p>
              <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                <Mail className="w-5 h-5 text-emerald-500" />
                <span className="font-mono text-lg flex-1">{ETRANSFER_CONFIG.emailDisplay}</span>
                <Button variant="outline" size="sm" onClick={handleCopyEmail} className="gap-2">
                  {copied ? (
                    <><Check className="w-4 h-4 text-emerald-500" />Copié!</>
                  ) : (
                    <><Copy className="w-4 h-4" />Copier</>
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

        {/* Square Card (Auto-Pay) */}
        <Card className={`bg-card border-2 ${squareCardId ? "border-primary/50" : "border-border"}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Carte de crédit — Paiement automatique
              </CardTitle>
              <Badge className={squareCardId ? "bg-primary/20 text-primary border-0" : "bg-muted text-muted-foreground border-0"}>
                {squareCardId ? "Enregistrée" : "Non configurée"}
              </Badge>
            </div>
            <CardDescription>
              Enregistrez votre carte pour les renouvellements automatiques et économisez 5 $/mois.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {squareCardId ? (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Carte enregistrée</p>
                  <p className="text-xs text-muted-foreground">Vos renouvellements sont débités automatiquement.</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-muted/50 border border-border rounded-lg">
                <p className="text-sm text-muted-foreground mb-3">
                  Aucune carte enregistrée. Ajoutez votre carte pour activer le paiement automatique.
                </p>
              </div>
            )}
            <Button asChild className="w-full" variant={squareCardId ? "outline" : "default"}>
              <Link to="/portal/paiement">
                <CreditCard className="w-4 h-4 mr-2" />
                {squareCardId ? "Gérer ma carte" : "Enregistrer ma carte"}
              </Link>
            </Button>
            <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Paiement sécurisé via Square — PCI-DSS compliant
            </p>
          </CardContent>
        </Card>

        {/* Payment History */}
        {user?.id && <PaymentHistoryV2 userId={user.id} />}

        {/* Help Section */}
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <h3 className="font-medium text-foreground">Besoin d'aide avec un paiement?</h3>
                <p className="text-sm text-muted-foreground mt-1">Notre équipe est disponible pour vous assister.</p>
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
