import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import InfluencerLayout from "@/components/influencer/InfluencerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DollarSign, Wallet, Loader2, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInfluencerAuth } from "@/hooks/useInfluencerAuth";
import { toast } from "sonner";
import PartnerHelpFooter from "@/components/influencer/PartnerHelpFooter";

const InfluencerCashouts = () => {
  const { influencer } = useInfluencerAuth();
  const queryClient = useQueryClient();
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("etransfer");
  const [destination, setDestination] = useState("");
  const [confirmDetails, setConfirmDetails] = useState(false);

  // Fetch settings for minimum cashout
  const { data: settings, isError: settingsError } = useQuery({
    queryKey: ["referral-program-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_program_settings")
        .select("min_cashout_amount")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching settings:", error);
        // Return default if error
        return { min_cashout_amount: 50 };
      }
      return data || { min_cashout_amount: 50 };
    },
  });

  // Fetch available balance
  const { data: balance } = useQuery({
    queryKey: ["influencer-balance", influencer?.id],
    queryFn: async () => {
      if (!influencer?.id) return 0;
      
      const { data: ledger, error } = await supabase
        .from("commission_ledger_entries")
        .select("type, amount, status")
        .eq("influencer_id", influencer.id);

      if (error) {
        console.error("Error fetching ledger:", error);
        return 0;
      }

      let approved = 0;
      let paid = 0;

      ledger?.forEach((entry) => {
        const amt = Number(entry.amount);
        if (entry.type === "approved_credit" || (entry.type === "pending_credit" && entry.status === "approved")) {
          approved += amt;
        } else if (entry.type === "reversal") {
          approved += amt;
        } else if (entry.type === "payout_debit") {
          paid += Math.abs(amt);
        }
      });

      return approved - paid;
    },
    enabled: !!influencer?.id,
  });

  // Fetch cashout requests
  const { data: cashouts, isLoading } = useQuery({
    queryKey: ["influencer-cashouts", influencer?.id],
    queryFn: async () => {
      if (!influencer?.id) return [];
      
      const { data, error } = await supabase
        .from("cashout_requests")
        .select("*")
        .eq("influencer_id", influencer.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching cashouts:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!influencer?.id,
    // Keep status fresh when an admin approves/rejects a request
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  // Create cashout request mutation
  const createCashout = useMutation({
    mutationFn: async () => {
      if (!influencer?.id) {
        throw new Error("Session partenaire invalide. Veuillez vous reconnecter.");
      }

      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        throw new Error("Montant invalide.");
      }

      const destinationClean = destination.trim();
      if (!destinationClean) {
        throw new Error("Destination de paiement invalide.");
      }

      const { error } = await supabase.from("cashout_requests").insert({
        influencer_id: influencer.id,
        amount: amt,
        method,
        destination: destinationClean,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["influencer-cashouts"] });
      setRequestDialogOpen(false);
      setAmount("");
      setConfirmDetails(false);
      toast.success("Demande de retrait envoyée!");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const minCashoutRaw = settings?.min_cashout_amount;
  const minCashoutParsed = typeof minCashoutRaw === "number" ? minCashoutRaw : Number(minCashoutRaw);
  const minCashout = Number.isFinite(minCashoutParsed) ? minCashoutParsed : 50;

  const availableRaw = balance ?? 0;
  const availableParsed = typeof availableRaw === "number" ? availableRaw : Number(availableRaw);
  const available = Number.isFinite(availableParsed) ? availableParsed : 0;

  const canRequest = available >= minCashout;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "requested":
        return <Badge className="bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      case "under_review":
        return <Badge className="bg-blue-500/20 text-blue-400"><AlertCircle className="w-3 h-3 mr-1" />En révision</Badge>;
      case "approved":
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Approuvé</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" />Rejeté</Badge>;
      case "paid":
        return <Badge className="bg-purple-500/20 text-purple-400"><DollarSign className="w-3 h-3 mr-1" />Payé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <InfluencerLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Retraits</h1>
            <p className="text-muted-foreground">
              Demandez un retrait de vos commissions
            </p>
          </div>
          <Button onClick={() => {
            setDestination(influencer?.payout_email || influencer?.email || "");
            setRequestDialogOpen(true);
          }} disabled={!canRequest}>
            <Wallet className="w-4 h-4 mr-2" />
            Demander un retrait
          </Button>
        </div>

        {/* Balance Card */}
        <Card className={canRequest ? "border-green-500/30 bg-green-500/5" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Solde disponible</p>
                <p className="text-4xl font-bold">${available.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Minimum: ${minCashout.toFixed(2)}
                </p>
              </div>
              <Wallet className={`w-16 h-16 ${canRequest ? "text-green-500" : "text-muted-foreground"}`} />
            </div>
          </CardContent>
        </Card>

        {/* Cashout History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historique des demandes</CardTitle>
            <CardDescription>Toutes vos demandes de retrait</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : cashouts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Wallet className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-muted-foreground">Aucune demande de retrait</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  cashouts?.map((cashout) => (
                    <TableRow key={cashout.id}>
                      <TableCell className="font-mono text-sm">{cashout.request_number}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(cashout.created_at).toLocaleDateString("fr-CA")}
                      </TableCell>
                      <TableCell className="font-bold">${Number(cashout.amount).toFixed(2)}</TableCell>
                      <TableCell className="capitalize">{cashout.method}</TableCell>
                      <TableCell>{getStatusBadge(cashout.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {cashout.admin_note || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* Help Footer */}
        <PartnerHelpFooter />
      </div>

      {/* Request Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demander un retrait</DialogTitle>
            <DialogDescription>
              Solde disponible: ${available.toFixed(2)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Montant *</Label>
              <Input
                id="amount"
                type="number"
                min={minCashout}
                max={available}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Min: $${minCashout.toFixed(2)}`}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setAmount(available.toFixed(2))}
              >
                Retirer tout (${available.toFixed(2)})
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Méthode de paiement</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="etransfer">Interac e-Transfer</SelectItem>
                  <SelectItem value="bank">Virement bancaire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination">
                {method === "etransfer" ? "Email e-Transfer *" : "Coordonnées bancaires *"}
              </Label>
              <Input
                id="destination"
                type={method === "etransfer" ? "email" : "text"}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={method === "etransfer" ? "votre@email.com" : "Institution, transit, compte"}
              />
            </div>

            <div className="flex items-start space-x-2 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="confirm"
                checked={confirmDetails}
                onCheckedChange={(checked) => setConfirmDetails(checked as boolean)}
              />
              <Label htmlFor="confirm" className="text-sm leading-tight">
                Je confirme que les informations de paiement sont correctes et que je souhaite recevoir ${amount || "0"} via {method === "etransfer" ? "Interac e-Transfer" : "virement bancaire"}.
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => createCashout.mutate()}
              disabled={
                createCashout.isPending ||
                !confirmDetails ||
                !amount ||
                !destination ||
                parseFloat(amount) < minCashout ||
                parseFloat(amount) > available
              }
            >
              {createCashout.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </InfluencerLayout>
  );
};

export default InfluencerCashouts;
