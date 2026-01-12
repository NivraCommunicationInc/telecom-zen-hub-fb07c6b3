import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import InfluencerLayout from "@/components/influencer/InfluencerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Loader2, Copy, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInfluencerAuth } from "@/hooks/useInfluencerAuth";
import { toast } from "sonner";
import PartnerHelpFooter from "@/components/influencer/PartnerHelpFooter";

const InfluencerSettings = () => {
  const { influencer, refreshInfluencer } = useInfluencerAuth();
  const queryClient = useQueryClient();

  const [payoutMethod, setPayoutMethod] = useState(influencer?.payout_method || "etransfer");
  const [payoutEmail, setPayoutEmail] = useState(influencer?.payout_email || "");
  const [phone, setPhone] = useState(influencer?.phone || "");

  // Fetch codes
  const { data: codes } = useQuery({
    queryKey: ["influencer-codes", influencer?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("influencer_id", influencer?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!influencer?.id,
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("influencers")
        .update({
          payout_method: payoutMethod,
          payout_email: payoutEmail,
          phone: phone || null,
        })
        .eq("id", influencer?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      refreshInfluencer();
      toast.success("Paramètres enregistrés");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié!");
  };

  return (
    <InfluencerLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paramètres</h1>
          <p className="text-muted-foreground">
            Gérez vos informations de paiement
          </p>
        </div>

        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informations du compte</CardTitle>
            <CardDescription>Vos informations de partenaire</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Nom</Label>
                <p className="font-medium">{influencer?.first_name} {influencer?.last_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium">{influencer?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral Codes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Vos codes de parrainage
            </CardTitle>
            <CardDescription>Codes attribués à votre compte</CardDescription>
          </CardHeader>
          <CardContent>
            {codes?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Aucun code</p>
            ) : (
              <div className="space-y-2">
                {codes?.map((code) => (
                  <div
                    key={code.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <code className="px-2 py-1 bg-primary/10 rounded font-mono text-primary">
                        {code.code}
                      </code>
                      <span className={`text-xs ${code.status === "active" ? "text-green-500" : "text-red-500"}`}>
                        {code.status === "active" ? "Actif" : "Désactivé"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {code.usage_count} utilisations
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => copyToClipboard(code.code)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payout Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Paramètres de paiement</CardTitle>
            <CardDescription>
              Configurez comment vous souhaitez recevoir vos commissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Méthode de paiement</Label>
              <Select value={payoutMethod} onValueChange={setPayoutMethod}>
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
              <Label htmlFor="payoutEmail">
                {payoutMethod === "etransfer" ? "Email pour e-Transfer" : "Email de contact"}
              </Label>
              <Input
                id="payoutEmail"
                type="email"
                value={payoutEmail}
                onChange={(e) => setPayoutEmail(e.target.value)}
                placeholder="votre@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone (optionnel)</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 514 555 1234"
              />
            </div>

            <Button
              onClick={() => updateSettings.mutate()}
              disabled={updateSettings.isPending}
              className="w-full"
            >
              {updateSettings.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Enregistrer les modifications
            </Button>
          </CardContent>
        </Card>
        
        {/* Help Footer */}
        <PartnerHelpFooter />
      </div>
    </InfluencerLayout>
  );
};

export default InfluencerSettings;
