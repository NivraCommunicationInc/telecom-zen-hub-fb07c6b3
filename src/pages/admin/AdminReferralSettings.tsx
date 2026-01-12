import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Settings, DollarSign, Shield, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminReferralSettings = () => {
  const queryClient = useQueryClient();

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["referral-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_program_settings")
        .select("*")
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const [formData, setFormData] = useState({
    discount_percent_first_invoice_monthly: 50,
    discount_stacks: false,
    commission_model_default: "fixed_bounty",
    commission_value_default: 25,
    cooldown_days: 14,
    min_cashout_amount: 50,
    allow_self_referrals: false,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        discount_percent_first_invoice_monthly: settings.discount_percent_first_invoice_monthly,
        discount_stacks: settings.discount_stacks,
        commission_model_default: settings.commission_model_default,
        commission_value_default: Number(settings.commission_value_default),
        cooldown_days: settings.cooldown_days,
        min_cashout_amount: Number(settings.min_cashout_amount),
        allow_self_referrals: settings.allow_self_referrals,
      });
    }
  }, [settings]);

  // Save settings mutation
  const saveSettings = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("referral_program_settings")
        .update({
          discount_percent_first_invoice_monthly: data.discount_percent_first_invoice_monthly,
          discount_stacks: data.discount_stacks,
          commission_model_default: data.commission_model_default as any,
          commission_value_default: data.commission_value_default,
          cooldown_days: data.cooldown_days,
          min_cashout_amount: data.min_cashout_amount,
          allow_self_referrals: data.allow_self_referrals,
        })
        .eq("id", settings?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-settings"] });
      toast.success("Paramètres enregistrés");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/referrals">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Paramètres du Programme</h1>
            <p className="text-muted-foreground">Configurez les règles du programme de parrainage</p>
          </div>
          <Button onClick={() => saveSettings.mutate(formData)} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Enregistrer
          </Button>
        </div>

        {/* Discount Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Rabais Client
            </CardTitle>
            <CardDescription>
              Configurez le rabais offert aux clients qui utilisent un code de parrainage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="discount_percent">Pourcentage de rabais (%)</Label>
                <Input
                  id="discount_percent"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.discount_percent_first_invoice_monthly}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discount_percent_first_invoice_monthly: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Appliqué sur le sous-total mensuel de la première facture uniquement
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div>
                <Label>Autoriser le cumul des rabais</Label>
                <p className="text-sm text-muted-foreground">
                  Permet de combiner le rabais parrainage avec d'autres promotions
                </p>
              </div>
              <Switch
                checked={formData.discount_stacks}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, discount_stacks: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Commission Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Commissions Influenceurs
            </CardTitle>
            <CardDescription>
              Configurez le modèle de commission par défaut pour les nouveaux influenceurs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Modèle de commission</Label>
                <Select
                  value={formData.commission_model_default}
                  onValueChange={(value) =>
                    setFormData({ ...formData, commission_model_default: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed_bounty">Prime fixe par client</SelectItem>
                    <SelectItem value="activation_fee">100% des frais d'activation</SelectItem>
                    <SelectItem value="percent_first_invoice">% de la première facture</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="commission_value">
                  {formData.commission_model_default === "percent_first_invoice"
                    ? "Pourcentage (%)"
                    : "Montant ($)"}
                </Label>
                <Input
                  id="commission_value"
                  type="number"
                  min="0"
                  step={formData.commission_model_default === "percent_first_invoice" ? "1" : "0.01"}
                  value={formData.commission_value_default}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      commission_value_default: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timing Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Délais et Seuils
            </CardTitle>
            <CardDescription>
              Configurez les périodes d'attente et les seuils minimums
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="cooldown_days">Période de rétention (jours)</Label>
                <Input
                  id="cooldown_days"
                  type="number"
                  min="0"
                  max="90"
                  value={formData.cooldown_days}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cooldown_days: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Délai avant qu'une commission en attente devienne disponible
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_cashout">Retrait minimum ($)</Label>
                <Input
                  id="min_cashout"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.min_cashout_amount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      min_cashout_amount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Solde minimum requis pour demander un retrait
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Sécurité et Anti-fraude
            </CardTitle>
            <CardDescription>
              Configurez les règles de détection de fraude
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div>
                <Label className="text-red-400">Autoriser l'auto-parrainage</Label>
                <p className="text-sm text-muted-foreground">
                  Permet aux influenceurs d'utiliser leur propre code. <strong>Non recommandé.</strong>
                </p>
              </div>
              <Switch
                checked={formData.allow_self_referrals}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, allow_self_referrals: checked })
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminReferralSettings;
