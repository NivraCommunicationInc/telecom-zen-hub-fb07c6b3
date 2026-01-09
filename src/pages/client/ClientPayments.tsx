import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { 
  Wallet, 
  Plus, 
  Copy, 
  Check, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  Bitcoin,
  ArrowRightLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PaymentRequest {
  id: string;
  method: "interac" | "crypto";
  amount: number;
  currency: string;
  reference_code: string;
  client_reference: string | null;
  crypto_currency: string | null;
  crypto_txid: string | null;
  status: "pending_verification" | "verified" | "rejected" | "cancelled";
  verified_at: string | null;
  verification_note: string | null;
  rejection_reason: string | null;
  created_at: string;
}

interface PaymentSettings {
  interac_instructions?: {
    email: string;
    security_question: string;
    instructions_fr: string;
  };
  crypto_instructions?: {
    btc_address: string;
    eth_address: string;
    supported_currencies: string[];
    instructions_fr: string;
  };
}

const ClientPayments = () => {
  const { user } = useClientAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"interac" | "crypto">("interac");
  const [copied, setCopied] = useState<string | null>(null);
  const [newPayment, setNewPayment] = useState({
    amount: "",
    clientReference: "",
    cryptoCurrency: "BTC",
    cryptoTxid: "",
    invoiceNumber: "",
  });

  // Fetch payment requests
  const { data: paymentRequests, isLoading } = useQuery({
    queryKey: ["payment-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("payment_requests")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PaymentRequest[];
    },
    enabled: !!user?.id,
  });

  // Fetch payment settings
  const { data: settings } = useQuery({
    queryKey: ["payment-settings"],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("payment_settings")
        .select("*");
      if (error) throw error;
      
      const settingsMap: PaymentSettings = {};
      data?.forEach((s: any) => {
        settingsMap[s.setting_key as keyof PaymentSettings] = s.setting_value;
      });
      return settingsMap;
    },
  });

  // Create payment request mutation
  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      const referenceCode = `PAY-${Date.now().toString(36).toUpperCase()}`;
      
      const { data, error } = await portalSupabase
        .from("payment_requests")
        .insert({
          user_id: user?.id,
          method: paymentMethod,
          amount: parseFloat(newPayment.amount),
          currency: "CAD",
          reference_code: referenceCode,
          client_reference: paymentMethod === "interac" 
            ? newPayment.clientReference 
            : newPayment.cryptoTxid,
          crypto_currency: paymentMethod === "crypto" ? newPayment.cryptoCurrency : null,
          crypto_txid: paymentMethod === "crypto" ? newPayment.cryptoTxid : null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-requests"] });
      toast({ title: "Demande de paiement créée", description: "En attente de vérification par notre équipe." });
      setDialogOpen(false);
      setNewPayment({ amount: "", clientReference: "", cryptoCurrency: "BTC", cryptoTxid: "", invoiceNumber: "" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer la demande de paiement.", variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: "Copié!", description: `${label} copié dans le presse-papier.` });
    setTimeout(() => setCopied(null), 2000);
  };

  const getStatusBadge = (status: PaymentRequest["status"]) => {
    switch (status) {
      case "pending_verification":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500"><Clock className="w-3 h-3 mr-1" /> En attente</Badge>;
      case "verified":
        return <Badge variant="outline" className="border-green-500 text-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Vérifié</Badge>;
      case "rejected":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Rejeté</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Annulé</Badge>;
    }
  };

  const interacSettings = settings?.interac_instructions;
  const cryptoSettings = settings?.crypto_instructions;

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Paiements</h1>
            <p className="text-muted-foreground mt-1">Effectuez vos paiements par virement Interac ou crypto-monnaie</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau paiement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Soumettre un paiement</DialogTitle>
              </DialogHeader>
              
              <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "interac" | "crypto")} className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="interac" className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4" />
                    Interac
                  </TabsTrigger>
                  <TabsTrigger value="crypto" className="flex items-center gap-2">
                    <Bitcoin className="w-4 h-4" />
                    Crypto
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="interac" className="space-y-4 mt-4">
                  {interacSettings && (
                    <Card className="bg-accent/50 border-primary/20">
                      <CardContent className="pt-4 space-y-3">
                        <p className="text-sm text-muted-foreground">{interacSettings.instructions_fr}</p>
                        <div className="flex items-center justify-between p-2 bg-background rounded">
                          <span className="text-sm font-mono">{interacSettings.email}</span>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => copyToClipboard(interacSettings.email, "Email")}
                          >
                            {copied === "Email" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Question de sécurité: <strong>{interacSettings.security_question}</strong>
                        </p>
                      </CardContent>
                    </Card>
                  )}
                  
                  <div>
                    <Label>Montant ($CAD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="100.00"
                      value={newPayment.amount}
                      onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <Label>Numéro de facture ou commande (référence)</Label>
                    <Input
                      placeholder="INV-12345 ou CMD-67890"
                      value={newPayment.invoiceNumber}
                      onChange={(e) => setNewPayment({ ...newPayment, invoiceNumber: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Utilisez ce numéro comme réponse à la question de sécurité
                    </p>
                  </div>
                  
                  <div>
                    <Label>Confirmation Interac (optionnel)</Label>
                    <Input
                      placeholder="Numéro de confirmation reçu"
                      value={newPayment.clientReference}
                      onChange={(e) => setNewPayment({ ...newPayment, clientReference: e.target.value })}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="crypto" className="space-y-4 mt-4">
                  {cryptoSettings && (
                    <Card className="bg-accent/50 border-primary/20">
                      <CardContent className="pt-4 space-y-3">
                        <p className="text-sm text-muted-foreground">{cryptoSettings.instructions_fr}</p>
                        
                        <div className="space-y-2">
                          <Label className="text-xs">Adresse BTC</Label>
                          <div className="flex items-center justify-between p-2 bg-background rounded">
                            <span className="text-xs font-mono truncate">{cryptoSettings.btc_address}</span>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => copyToClipboard(cryptoSettings.btc_address, "BTC")}
                            >
                              {copied === "BTC" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-xs">Adresse ETH/USDT</Label>
                          <div className="flex items-center justify-between p-2 bg-background rounded">
                            <span className="text-xs font-mono truncate">{cryptoSettings.eth_address}</span>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => copyToClipboard(cryptoSettings.eth_address, "ETH")}
                            >
                              {copied === "ETH" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  <div>
                    <Label>Montant ($CAD équivalent)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="100.00"
                      value={newPayment.amount}
                      onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                    />
                  </div>
                  
                  <div>
                    <Label>Crypto-monnaie utilisée</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                      value={newPayment.cryptoCurrency}
                      onChange={(e) => setNewPayment({ ...newPayment, cryptoCurrency: e.target.value })}
                    >
                      <option value="BTC">Bitcoin (BTC)</option>
                      <option value="ETH">Ethereum (ETH)</option>
                      <option value="USDT">Tether (USDT)</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label>Transaction ID (TXID)</Label>
                    <Textarea
                      placeholder="Hash de la transaction blockchain"
                      value={newPayment.cryptoTxid}
                      onChange={(e) => setNewPayment({ ...newPayment, cryptoTxid: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Trouvez ce numéro dans votre portefeuille ou explorateur blockchain
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
              
              <Button
                className="w-full mt-4"
                variant="hero"
                onClick={() => createPaymentMutation.mutate()}
                disabled={!newPayment.amount || createPaymentMutation.isPending}
              >
                {createPaymentMutation.isPending ? "Envoi..." : "Soumettre le paiement"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        {/* Payment History */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Historique des paiements
            </CardTitle>
            <CardDescription>
              Vos demandes de paiement et leur statut de vérification
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : paymentRequests && paymentRequests.length > 0 ? (
              <div className="space-y-4">
                {paymentRequests.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 bg-accent/50 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        payment.method === "interac" 
                          ? "bg-primary/20 text-primary" 
                          : "bg-orange-500/20 text-orange-500"
                      }`}>
                        {payment.method === "interac" 
                          ? <ArrowRightLeft className="w-5 h-5" /> 
                          : <Bitcoin className="w-5 h-5" />
                        }
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {payment.amount.toFixed(2)} {payment.currency}
                          </p>
                          {getStatusBadge(payment.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {payment.method === "interac" ? "Virement Interac" : `${payment.crypto_currency || "Crypto"}`}
                          {" • "}
                          Réf: {payment.reference_code}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(payment.created_at).toLocaleDateString("fr-CA", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </p>
                        {payment.rejection_reason && (
                          <p className="text-xs text-red-500 mt-1">
                            Raison: {payment.rejection_reason}
                          </p>
                        )}
                        {payment.verification_note && payment.status === "verified" && (
                          <p className="text-xs text-green-500 mt-1">
                            Note: {payment.verification_note}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">Aucun paiement enregistré</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Payez par virement Interac ou crypto-monnaie
                </p>
                <Button variant="hero" onClick={() => setDialogOpen(true)}>
                  Effectuer un paiement
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Instructions Card */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Instructions de paiement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Interac Instructions */}
              <div className="p-4 rounded-lg bg-accent/50 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRightLeft className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Virement Interac</h3>
                </div>
                {interacSettings ? (
                  <div className="space-y-2 text-sm">
                    <p><strong>Email:</strong> {interacSettings.email}</p>
                    <p><strong>Question:</strong> {interacSettings.security_question}</p>
                    <p className="text-muted-foreground">{interacSettings.instructions_fr}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Chargement...</p>
                )}
              </div>
              
              {/* Crypto Instructions */}
              <div className="p-4 rounded-lg bg-accent/50 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Bitcoin className="w-5 h-5 text-orange-500" />
                  <h3 className="font-semibold">Crypto-monnaie</h3>
                </div>
                {cryptoSettings ? (
                  <div className="space-y-2 text-sm">
                    <p><strong>Monnaies acceptées:</strong> {cryptoSettings.supported_currencies?.join(", ")}</p>
                    <p className="text-muted-foreground">{cryptoSettings.instructions_fr}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Chargement...</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientPayments;
