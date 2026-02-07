import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Bell,
  Mail,
  MessageSquare,
  CreditCard,
  Package,
  Ticket,
  Users,
  AlertTriangle,
  Save,
  Loader2,
  RefreshCcw,
  Plus,
  X,
  Info,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { useToast } from "@/hooks/use-toast";

interface NotificationSetting {
  id: string;
  setting_key: string;
  setting_label: string;
  category: string;
  is_enabled: boolean;
  email_recipients: string[] | null;
  rate_limit_per_hour: number | null;
  use_digest: boolean | null;
  digest_interval_minutes: number | null;
}

const categoryConfig: Record<string, { label: string; icon: any; color: string }> = {
  tickets: { label: "Tickets de support", icon: Ticket, color: "text-cyan-500" },
  orders: { label: "Commandes", icon: Package, color: "text-blue-500" },
  billing: { label: "Facturation", icon: CreditCard, color: "text-green-500" },
  channels: { label: "Chaînes TV", icon: MessageSquare, color: "text-purple-500" },
  clients: { label: "Clients", icon: Users, color: "text-orange-500" },
  system: { label: "Système", icon: AlertTriangle, color: "text-red-500" },
};

const defaultSettings: Omit<NotificationSetting, "id">[] = [
  // Tickets
  { setting_key: "new_ticket", setting_label: "Nouveau ticket client", category: "tickets", is_enabled: true, email_recipients: null, rate_limit_per_hour: 50, use_digest: false, digest_interval_minutes: null },
  { setting_key: "ticket_reply", setting_label: "Réponse client sur ticket", category: "tickets", is_enabled: true, email_recipients: null, rate_limit_per_hour: 50, use_digest: false, digest_interval_minutes: null },
  { setting_key: "ticket_escalation", setting_label: "Escalade de ticket", category: "tickets", is_enabled: true, email_recipients: null, rate_limit_per_hour: 20, use_digest: false, digest_interval_minutes: null },
  // Orders
  { setting_key: "new_order", setting_label: "Nouvelle commande", category: "orders", is_enabled: true, email_recipients: null, rate_limit_per_hour: 100, use_digest: false, digest_interval_minutes: null },
  { setting_key: "order_status_change", setting_label: "Changement statut commande", category: "orders", is_enabled: false, email_recipients: null, rate_limit_per_hour: 100, use_digest: true, digest_interval_minutes: 30 },
  // Billing - PREPAID TERMINOLOGY (no debt language)
  { setting_key: "invoice_overdue", setting_label: "Renouvellement non confirmé", category: "billing", is_enabled: true, email_recipients: null, rate_limit_per_hour: 20, use_digest: true, digest_interval_minutes: 60 },
  { setting_key: "payment_failed", setting_label: "Paiement échoué", category: "billing", is_enabled: true, email_recipients: null, rate_limit_per_hour: 30, use_digest: false, digest_interval_minutes: null },
  { setting_key: "payment_received", setting_label: "Paiement reçu", category: "billing", is_enabled: false, email_recipients: null, rate_limit_per_hour: 100, use_digest: true, digest_interval_minutes: 60 },
  // Channels
  { setting_key: "channel_change_request", setting_label: "Demande modification chaînes", category: "channels", is_enabled: true, email_recipients: null, rate_limit_per_hour: 30, use_digest: false, digest_interval_minutes: null },
  // Clients
  { setting_key: "new_client", setting_label: "Nouveau client inscrit", category: "clients", is_enabled: false, email_recipients: null, rate_limit_per_hour: 50, use_digest: true, digest_interval_minutes: 60 },
  // System
  { setting_key: "employee_blocked", setting_label: "Employé bloqué", category: "system", is_enabled: true, email_recipients: null, rate_limit_per_hour: 10, use_digest: false, digest_interval_minutes: null },
  { setting_key: "partner_cashout", setting_label: "Demande retrait partenaire", category: "system", is_enabled: true, email_recipients: null, rate_limit_per_hour: 20, use_digest: false, digest_interval_minutes: null },
];

const AdminNotificationsSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newRecipient, setNewRecipient] = useState<Record<string, string>>({});

  // Fetch notification settings
  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ["admin-notification-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_notification_settings")
        .select("*")
        .order("category", { ascending: true });

      if (error) throw error;

      // If no settings exist, initialize with defaults
      if (!data || data.length === 0) {
        const { data: inserted, error: insertError } = await supabase
          .from("admin_notification_settings")
          .insert(defaultSettings)
          .select();

        if (insertError) throw insertError;
        return inserted as NotificationSetting[];
      }

      return data as NotificationSetting[];
    },
  });

  // Update setting mutation
  const updateSettingMutation = useMutation({
    mutationFn: async (update: { id: string; [key: string]: any }) => {
      const { id, ...updateData } = update;
      updateData.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("admin_notification_settings")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notification-settings"] });
      toast({ title: "Paramètre mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour", variant: "destructive" });
    },
  });

  const handleToggle = (setting: NotificationSetting) => {
    updateSettingMutation.mutate({
      id: setting.id,
      is_enabled: !setting.is_enabled,
    });
  };

  const handleDigestToggle = (setting: NotificationSetting) => {
    updateSettingMutation.mutate({
      id: setting.id,
      use_digest: !setting.use_digest,
      digest_interval_minutes: !setting.use_digest ? 30 : null,
    });
  };

  const handleRateLimitChange = (setting: NotificationSetting, value: string) => {
    const rate = parseInt(value) || 50;
    updateSettingMutation.mutate({
      id: setting.id,
      rate_limit_per_hour: rate,
    });
  };

  const handleDigestIntervalChange = (setting: NotificationSetting, value: string) => {
    const interval = parseInt(value) || 30;
    updateSettingMutation.mutate({
      id: setting.id,
      digest_interval_minutes: interval,
    });
  };

  const handleAddRecipient = (setting: NotificationSetting) => {
    const email = newRecipient[setting.id]?.trim();
    if (!email || !email.includes("@")) {
      toast({ title: "Email invalide", variant: "destructive" });
      return;
    }

    const currentRecipients = setting.email_recipients || [];
    if (currentRecipients.includes(email)) {
      toast({ title: "Email déjà ajouté", variant: "destructive" });
      return;
    }

    updateSettingMutation.mutate({
      id: setting.id,
      email_recipients: [...currentRecipients, email],
    });

    setNewRecipient((prev) => ({ ...prev, [setting.id]: "" }));
  };

  const handleRemoveRecipient = (setting: NotificationSetting, email: string) => {
    const newRecipients = (setting.email_recipients || []).filter((r) => r !== email);
    updateSettingMutation.mutate({
      id: setting.id,
      email_recipients: newRecipients.length > 0 ? newRecipients : null,
    });
  };

  // Group settings by category
  const groupedSettings = settings?.reduce((acc, setting) => {
    const category = setting.category || "system";
    if (!acc[category]) acc[category] = [];
    acc[category].push(setting);
    return acc;
  }, {} as Record<string, NotificationSetting[]>) || {};

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-2">
              <Bell className="w-8 h-8 text-primary" />
              Paramètres des notifications
            </h1>
            <p className="text-muted-foreground mt-1">
              Configurez les alertes email pour les événements importants
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* Info Banner */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Comment ça fonctionne
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Les emails de notification sont envoyés à tous les destinataires configurés. 
                Utilisez le mode "digest" pour regrouper les alertes et éviter la surcharge.
                La limite de fréquence empêche l'envoi excessif d'emails par heure.
              </p>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={Object.keys(categoryConfig)} className="space-y-4">
            {Object.entries(categoryConfig).map(([categoryKey, categoryInfo]) => {
              const CategoryIcon = categoryInfo.icon;
              const categorySettings = groupedSettings[categoryKey] || [];

              if (categorySettings.length === 0) return null;

              const enabledCount = categorySettings.filter((s) => s.is_enabled).length;

              return (
                <AccordionItem
                  key={categoryKey}
                  value={categoryKey}
                  className="border rounded-lg bg-card"
                >
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <CategoryIcon className={`w-5 h-5 ${categoryInfo.color}`} />
                      <span className="font-medium">{categoryInfo.label}</span>
                      <Badge variant="outline" className="ml-2">
                        {enabledCount}/{categorySettings.length} actifs
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4">
                      {categorySettings.map((setting) => (
                        <Card key={setting.id} className="bg-muted/30">
                          <CardContent className="p-4 space-y-4">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Switch
                                  checked={setting.is_enabled}
                                  onCheckedChange={() => handleToggle(setting)}
                                />
                                <div>
                                  <p className="font-medium text-foreground">
                                    {setting.setting_label}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {setting.setting_key}
                                  </p>
                                </div>
                              </div>
                              {setting.is_enabled && (
                                <Badge className="bg-green-500/20 text-green-500">Actif</Badge>
                              )}
                            </div>

                            {setting.is_enabled && (
                              <>
                                <Separator />

                                {/* Recipients */}
                                <div className="space-y-2">
                                  <Label className="text-sm">Destinataires email</Label>
                                  <div className="flex flex-wrap gap-2">
                                    {(setting.email_recipients || []).map((email) => (
                                      <Badge
                                        key={email}
                                        variant="secondary"
                                        className="flex items-center gap-1"
                                      >
                                        <Mail className="w-3 h-3" />
                                        {email}
                                        <button
                                          onClick={() => handleRemoveRecipient(setting, email)}
                                          className="ml-1 hover:text-destructive"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </Badge>
                                    ))}
                                  </div>
                                  <div className="flex gap-2">
                                    <Input
                                      type="email"
                                      placeholder="admin@nivra.ca"
                                      value={newRecipient[setting.id] || ""}
                                      onChange={(e) =>
                                        setNewRecipient((prev) => ({
                                          ...prev,
                                          [setting.id]: e.target.value,
                                        }))
                                      }
                                      className="flex-1"
                                    />
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => handleAddRecipient(setting)}
                                    >
                                      <Plus className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Laissez vide pour utiliser les emails par défaut
                                  </p>
                                </div>

                                {/* Rate Limit & Digest */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-sm">Limite par heure</Label>
                                    <Select
                                      value={String(setting.rate_limit_per_hour || 50)}
                                      onValueChange={(v) => handleRateLimitChange(setting, v)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="10">10 emails/h</SelectItem>
                                        <SelectItem value="20">20 emails/h</SelectItem>
                                        <SelectItem value="50">50 emails/h</SelectItem>
                                        <SelectItem value="100">100 emails/h</SelectItem>
                                        <SelectItem value="200">200 emails/h (illimité)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-sm">Mode digest</Label>
                                      <Switch
                                        checked={setting.use_digest || false}
                                        onCheckedChange={() => handleDigestToggle(setting)}
                                      />
                                    </div>
                                    {setting.use_digest && (
                                      <Select
                                        value={String(setting.digest_interval_minutes || 30)}
                                        onValueChange={(v) =>
                                          handleDigestIntervalChange(setting, v)
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="15">Toutes les 15 min</SelectItem>
                                          <SelectItem value="30">Toutes les 30 min</SelectItem>
                                          <SelectItem value="60">Toutes les heures</SelectItem>
                                          <SelectItem value="120">Toutes les 2 heures</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminNotificationsSettings;
