import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Zap, Play, Pause, Settings, Trash2, Clock, Mail } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  delay_minutes: number;
  template_id: string | null;
  subject_override: string | null;
  segment_filters: Record<string, unknown>;
  is_active: boolean;
  priority: number;
  total_triggered: number;
  total_sent: number;
  created_at: string;
  updated_at: string;
}

interface Template {
  id: string;
  name: string;
  subject: string;
}

const TRIGGER_TYPES = [
  { value: "welcome", label: "Bienvenue", description: "Nouveau client créé", icon: "👋" },
  { value: "anniversary", label: "Anniversaire client", description: "1 an avec Nivra", icon: "🎂" },
  { value: "birthday", label: "Anniversaire", description: "Date de naissance du client", icon: "🎉" },
  { value: "payment_overdue", label: "Paiement en retard", description: "Facture non payée", icon: "⚠️" },
  { value: "payment_received", label: "Paiement reçu", description: "Confirmation de paiement", icon: "✅" },
  { value: "service_activated", label: "Service activé", description: "Nouveau service actif", icon: "🚀" },
  { value: "service_cancelled", label: "Service annulé", description: "Annulation de service", icon: "❌" },
  { value: "order_completed", label: "Commande complétée", description: "Commande livrée/installée", icon: "📦" },
  { value: "inactivity", label: "Inactivité", description: "Client inactif X jours", icon: "💤" },
  { value: "custom", label: "Personnalisé", description: "Trigger manuel", icon: "⚙️" }
];

const DELAY_OPTIONS = [
  { value: 0, label: "Immédiat" },
  { value: 60, label: "1 heure" },
  { value: 1440, label: "1 jour" },
  { value: 4320, label: "3 jours" },
  { value: 10080, label: "1 semaine" },
  { value: 43200, label: "30 jours" }
];

const MarketingAutomations = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    trigger_type: "welcome",
    delay_minutes: 0,
    template_id: "",
    subject_override: "",
    is_active: true
  });

  // Fetch automation rules
  const { data: rules, isLoading } = useQuery({
    queryKey: ["email-automation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_automation_rules")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AutomationRule[];
    }
  });

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ["email-templates-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, name, subject")
        .eq("is_active", true);
      if (error) throw error;
      return data as Template[];
    }
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        trigger_type: data.trigger_type,
        delay_minutes: data.delay_minutes,
        template_id: data.template_id || null,
        subject_override: data.subject_override || null,
        is_active: data.is_active
      };

      if (data.id) {
        const { error } = await supabase
          .from("email_automation_rules")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_automation_rules")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-automation-rules"] });
      setIsDialogOpen(false);
      resetForm();
      toast.success(selectedRule ? "Automatisation modifiée" : "Automatisation créée");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("email_automation_rules")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-automation-rules"] });
      toast.success("Statut mis à jour");
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_automation_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-automation-rules"] });
      toast.success("Automatisation supprimée");
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      trigger_type: "welcome",
      delay_minutes: 0,
      template_id: "",
      subject_override: "",
      is_active: true
    });
    setSelectedRule(null);
  };

  const openEditDialog = (rule: AutomationRule) => {
    setSelectedRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || "",
      trigger_type: rule.trigger_type,
      delay_minutes: rule.delay_minutes,
      template_id: rule.template_id || "",
      subject_override: rule.subject_override || "",
      is_active: rule.is_active
    });
    setIsDialogOpen(true);
  };

  const formatDelay = (minutes: number) => {
    if (minutes === 0) return "Immédiat";
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} heure(s)`;
    return `${Math.round(minutes / 1440)} jour(s)`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">
          Automatisez vos emails en fonction des actions de vos clients
        </p>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Automatisation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {selectedRule ? "Modifier l'automatisation" : "Nouvelle automatisation"}
              </DialogTitle>
              <DialogDescription>
                Configurez un email automatique basé sur un événement
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              saveMutation.mutate({ ...formData, id: selectedRule?.id }); 
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom de l'automatisation</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Bienvenue nouveau client"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description de cette automatisation..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Déclencheur</Label>
                  <Select 
                    value={formData.trigger_type} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, trigger_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="mr-2">{t.icon}</span>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {TRIGGER_TYPES.find(t => t.value === formData.trigger_type)?.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Délai d'envoi</Label>
                  <Select 
                    value={String(formData.delay_minutes)} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, delay_minutes: Number(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELAY_OPTIONS.map(d => (
                        <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Template email</Label>
                <Select 
                  value={formData.template_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, template_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject_override">Sujet personnalisé (optionnel)</Label>
                <Input
                  id="subject_override"
                  value={formData.subject_override}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject_override: e.target.value }))}
                  placeholder="Laissez vide pour utiliser le sujet du template"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Automatisation active</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Rules List */}
      <div className="grid gap-4 md:grid-cols-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-2/3" />
              </CardHeader>
              <CardContent>
                <div className="h-12 bg-muted rounded" />
              </CardContent>
            </Card>
          ))
        ) : rules?.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Aucune automatisation configurée
          </div>
        ) : (
          rules?.map((rule) => {
            const triggerInfo = TRIGGER_TYPES.find(t => t.value === rule.trigger_type);
            return (
              <Card key={rule.id} className={!rule.is_active ? "opacity-60" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{triggerInfo?.icon}</span>
                        <CardTitle className="text-lg">{rule.name}</CardTitle>
                      </div>
                      <CardDescription>
                        {rule.description || triggerInfo?.description}
                      </CardDescription>
                    </div>
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => 
                        toggleActiveMutation.mutate({ id: rule.id, is_active: checked })
                      }
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      <Zap className="h-3 w-3 mr-1" />
                      {triggerInfo?.label}
                    </Badge>
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDelay(rule.delay_minutes)}
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <div className="flex gap-4 text-muted-foreground">
                      <span>Déclenchés: <strong>{rule.total_triggered}</strong></span>
                      <span>Envoyés: <strong>{rule.total_sent}</strong></span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(rule)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Supprimer cette automatisation?")) {
                            deleteMutation.mutate(rule.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MarketingAutomations;
