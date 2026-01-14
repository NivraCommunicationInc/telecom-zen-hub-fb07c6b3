import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Calendar, Pause, Pencil, Play, Trash2, XCircle, Plus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Json } from "@/integrations/supabase/types";

interface Campaign {
  id: string;
  name: string;
  campaign_number: string | null;
  template_id: string | null;
  subject_override: string | null;
  type: string;
  status: string;
  segment_filters: Json;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number | null;
  total_sent: number | null;
  total_opened: number | null;
  total_clicked: number | null;
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  subject: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Brouillon", variant: "secondary" },
  scheduled: { label: "Planifiée", variant: "outline" },
  sending: { label: "En cours", variant: "default" },
  sent: { label: "Envoyée", variant: "default" },
  paused: { label: "En pause", variant: "secondary" },
  cancelled: { label: "Annulée", variant: "destructive" },
};

const SERVICE_TYPES = [
  { value: "internet", label: "Internet" },
  { value: "tv", label: "Télévision" },
  { value: "mobile", label: "Mobile" },
  { value: "streaming", label: "Streaming" },
];

const CLIENT_STATUS = [
  { value: "active", label: "Actif" },
  { value: "inactive", label: "Inactif" },
  { value: "suspended", label: "Suspendu" },
];

interface SegmentFilters {
  services: string[];
  status: string[];
  created_after: string;
  created_before: string;
}

type CampaignFormData = {
  name: string;
  template_id: string;
  subject_override: string;
  type: string;
  scheduled_at: string;
  segment_filters: SegmentFilters;
};

const emptyForm: CampaignFormData = {
  name: "",
  template_id: "",
  subject_override: "",
  type: "manual",
  scheduled_at: "",
  segment_filters: {
    services: [],
    status: [],
    created_after: "",
    created_before: "",
  },
};

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  try {
    return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

function parseSegmentFilters(input: Json): SegmentFilters {
  const raw =
    input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};

  const services = Array.isArray(raw.services) ? raw.services.filter((v): v is string => typeof v === "string") : [];
  const status = Array.isArray(raw.status) ? raw.status.filter((v): v is string => typeof v === "string") : [];

  return {
    services,
    status,
    created_after: typeof raw.created_after === "string" ? raw.created_after : "",
    created_before: typeof raw.created_before === "string" ? raw.created_before : "",
  };
}

const MarketingCampaigns = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [formData, setFormData] = useState<CampaignFormData>(emptyForm);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editFormData, setEditFormData] = useState<CampaignFormData>(emptyForm);

  const editDialogTitle = useMemo(() => {
    if (!editingCampaign) return "Modifier la campagne";
    const statusLabel = STATUS_CONFIG[editingCampaign.status]?.label || editingCampaign.status;
    return `Modifier la campagne • ${statusLabel}`;
  }, [editingCampaign]);

  const resetForm = () => setFormData(emptyForm);

  const resetEditForm = () => {
    setEditingCampaign(null);
    setEditFormData(emptyForm);
  };

  const toggleSegmentValue = (
    setState: React.Dispatch<React.SetStateAction<CampaignFormData>>,
    key: "services" | "status",
    value: string
  ) => {
    setState((prev) => ({
      ...prev,
      segment_filters: {
        ...prev.segment_filters,
        [key]: prev.segment_filters[key].includes(value)
          ? prev.segment_filters[key].filter((s) => s !== value)
          : [...prev.segment_filters[key], value],
      },
    }));
  };

  const handleServiceToggle = (service: string) => toggleSegmentValue(setFormData, "services", service);
  const handleStatusToggle = (status: string) => toggleSegmentValue(setFormData, "status", status);
  const handleEditServiceToggle = (service: string) => toggleSegmentValue(setEditFormData, "services", service);
  const handleEditStatusToggle = (status: string) => toggleSegmentValue(setEditFormData, "status", status);

  const openEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setEditFormData({
      name: campaign.name ?? "",
      template_id: campaign.template_id ?? "",
      subject_override: campaign.subject_override ?? "",
      type: campaign.type ?? "manual",
      scheduled_at: toDateTimeLocal(campaign.scheduled_at),
      segment_filters: parseSegmentFilters(campaign.segment_filters),
    });
    setIsEditDialogOpen(true);
  };

  // Fetch campaigns
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["email-campaigns", statusFilter],
    queryFn: async () => {
      let query = supabase.from("email_campaigns").select("*").order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Campaign[];
    },
  });

  // Fetch templates for dropdown
  const { data: templates } = useQuery({
    queryKey: ["email-templates-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, name, subject")
        .eq("is_active", true);
      if (error) throw error;
      return data as Template[];
    },
  });

  // Create campaign mutation
  const createMutation = useMutation({
    mutationFn: async (data: CampaignFormData) => {
      if (!data.name.trim()) {
        throw new Error("Le nom de la campagne est requis");
      }

      const payload = {
        name: data.name,
        template_id: data.template_id || null,
        subject_override: data.subject_override || null,
        type: data.type,
        scheduled_at: data.scheduled_at || null,
        segment_filters: data.segment_filters as unknown as Json,
        status: data.scheduled_at ? "scheduled" : "draft",
      };

      const { error } = await supabase.from("email_campaigns").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["marketing-stats"] });
      setIsDialogOpen(false);
      resetForm();
      toast.success("Campagne créée avec succès");
    },
    onError: (error: Error) => {
      console.error("Error creating campaign:", error);
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Update campaign details mutation
  const updateCampaignMutation = useMutation({
    mutationFn: async ({
      id,
      currentStatus,
      data,
    }: {
      id: string;
      currentStatus: string;
      data: CampaignFormData;
    }) => {
      if (!data.name.trim()) {
        throw new Error("Le nom de la campagne est requis");
      }

      const scheduledAt = data.scheduled_at || null;
      const nextStatus =
        currentStatus === "draft" || currentStatus === "scheduled"
          ? scheduledAt
            ? "scheduled"
            : "draft"
          : currentStatus;

      const payload = {
        name: data.name,
        template_id: data.template_id || null,
        subject_override: data.subject_override || null,
        type: data.type,
        scheduled_at: scheduledAt,
        segment_filters: data.segment_filters as unknown as Json,
        status: nextStatus,
      };

      const { error } = await supabase.from("email_campaigns").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["marketing-stats"] });
      setIsEditDialogOpen(false);
      resetEditForm();
      toast.success("Campagne mise à jour");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "sending") {
        updates.started_at = new Date().toISOString();
      } else if (status === "sent") {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase.from("email_campaigns").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["marketing-stats"] });
      toast.success("Statut mis à jour");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["marketing-stats"] });
      toast.success("Campagne supprimée");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      template_id: "",
      subject_override: "",
      type: "manual",
      scheduled_at: "",
      segment_filters: {
        services: [],
        status: [],
        created_after: "",
        created_before: ""
      }
    });
  };

  const handleServiceToggle = (service: string) => {
    setFormData(prev => ({
      ...prev,
      segment_filters: {
        ...prev.segment_filters,
        services: prev.segment_filters.services.includes(service)
          ? prev.segment_filters.services.filter(s => s !== service)
          : [...prev.segment_filters.services, service]
      }
    }));
  };

  const handleStatusToggle = (status: string) => {
    setFormData(prev => ({
      ...prev,
      segment_filters: {
        ...prev.segment_filters,
        status: prev.segment_filters.status.includes(status)
          ? prev.segment_filters.status.filter(s => s !== status)
          : [...prev.segment_filters.status, status]
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Campagne
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouvelle campagne</DialogTitle>
              <DialogDescription>Créez une campagne email et définissez votre audience</DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(formData);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Nom de la campagne *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Promotion été 2026"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select value={formData.template_id} onValueChange={(value) => setFormData((prev) => ({ ...prev, template_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates?.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">Aucun template actif</div>
                      ) : (
                        templates?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {templates?.length === 0 && (
                    <p className="text-xs text-muted-foreground">Créez d'abord un template dans l'onglet Templates</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduled_at">Date d'envoi (optionnel)</Label>
                  <Input
                    id="scheduled_at"
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData((prev) => ({ ...prev, scheduled_at: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject_override">Sujet personnalisé (optionnel)</Label>
                <Input
                  id="subject_override"
                  value={formData.subject_override}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subject_override: e.target.value }))}
                  placeholder="Laissez vide pour utiliser le sujet du template"
                />
              </div>

              {/* Segmentation */}
              <div className="space-y-4 border rounded-lg p-4">
                <h4 className="font-medium">Segmentation de l'audience</h4>

                <div className="space-y-2">
                  <Label>Par service</Label>
                  <div className="flex flex-wrap gap-3">
                    {SERVICE_TYPES.map((service) => (
                      <div key={service.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`service-${service.value}`}
                          checked={formData.segment_filters.services.includes(service.value)}
                          onCheckedChange={() => handleServiceToggle(service.value)}
                        />
                        <Label htmlFor={`service-${service.value}`} className="text-sm font-normal">
                          {service.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Par statut client</Label>
                  <div className="flex flex-wrap gap-3">
                    {CLIENT_STATUS.map((status) => (
                      <div key={status.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${status.value}`}
                          checked={formData.segment_filters.status.includes(status.value)}
                          onCheckedChange={() => handleStatusToggle(status.value)}
                        />
                        <Label htmlFor={`status-${status.value}`} className="text-sm font-normal">
                          {status.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="created_after">Client depuis</Label>
                    <Input
                      id="created_after"
                      type="date"
                      value={formData.segment_filters.created_after}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          segment_filters: { ...prev.segment_filters, created_after: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="created_before">Client avant</Label>
                    <Input
                      id="created_before"
                      type="date"
                      value={formData.segment_filters.created_before}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          segment_filters: { ...prev.segment_filters, created_before: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Création..." : "Créer la campagne"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit dialog (opens from each campaign card) */}
        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) resetEditForm();
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editDialogTitle}</DialogTitle>
              <DialogDescription>Modifiez la campagne puis enregistrez.</DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingCampaign) return;
                updateCampaignMutation.mutate({
                  id: editingCampaign.id,
                  currentStatus: editingCampaign.status,
                  data: editFormData,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nom de la campagne *</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Promotion été 2026"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select
                    value={editFormData.template_id}
                    onValueChange={(value) => setEditFormData((prev) => ({ ...prev, template_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates?.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">Aucun template actif</div>
                      ) : (
                        templates?.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-scheduled-at">Date d'envoi (optionnel)</Label>
                  <Input
                    id="edit-scheduled-at"
                    type="datetime-local"
                    value={editFormData.scheduled_at}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, scheduled_at: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-subject">Sujet personnalisé (optionnel)</Label>
                <Input
                  id="edit-subject"
                  value={editFormData.subject_override}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, subject_override: e.target.value }))}
                  placeholder="Laissez vide pour utiliser le sujet du template"
                />
              </div>

              {/* Segmentation */}
              <div className="space-y-4 border rounded-lg p-4">
                <h4 className="font-medium">Segmentation de l'audience</h4>

                <div className="space-y-2">
                  <Label>Par service</Label>
                  <div className="flex flex-wrap gap-3">
                    {SERVICE_TYPES.map((service) => (
                      <div key={service.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-service-${service.value}`}
                          checked={editFormData.segment_filters.services.includes(service.value)}
                          onCheckedChange={() => handleEditServiceToggle(service.value)}
                        />
                        <Label htmlFor={`edit-service-${service.value}`} className="text-sm font-normal">
                          {service.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Par statut client</Label>
                  <div className="flex flex-wrap gap-3">
                    {CLIENT_STATUS.map((status) => (
                      <div key={status.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-status-${status.value}`}
                          checked={editFormData.segment_filters.status.includes(status.value)}
                          onCheckedChange={() => handleEditStatusToggle(status.value)}
                        />
                        <Label htmlFor={`edit-status-${status.value}`} className="text-sm font-normal">
                          {status.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-created-after">Client depuis</Label>
                    <Input
                      id="edit-created-after"
                      type="date"
                      value={editFormData.segment_filters.created_after}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          segment_filters: { ...prev.segment_filters, created_after: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-created-before">Client avant</Label>
                    <Input
                      id="edit-created-before"
                      type="date"
                      value={editFormData.segment_filters.created_before}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          segment_filters: { ...prev.segment_filters, created_before: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Fermer
                </Button>
                <Button type="submit" disabled={updateCampaignMutation.isPending || !editingCampaign}>
                  {updateCampaignMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-1/3" />
              </CardHeader>
              <CardContent>
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))
        ) : campaigns?.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              <p>Aucune campagne trouvée</p>
              <p className="text-sm mt-2">Créez votre première campagne en cliquant sur "Nouvelle Campagne"</p>
            </CardContent>
          </Card>
        ) : (
          campaigns?.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{campaign.name}</CardTitle>
                      <Badge variant={STATUS_CONFIG[campaign.status]?.variant || "secondary"}>
                        {STATUS_CONFIG[campaign.status]?.label || campaign.status}
                      </Badge>
                    </div>
                    <CardDescription>
                      {campaign.campaign_number && `${campaign.campaign_number} • `}
                      Créée le {format(new Date(campaign.created_at), "d MMM yyyy", { locale: fr })}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {/* Start / Pause / Resume */}
                    {campaign.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: campaign.id, status: "sending" })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Lancer
                      </Button>
                    )}

                    {campaign.status === "sending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ id: campaign.id, status: "paused" })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Pause
                      </Button>
                    )}

                    {campaign.status === "paused" && (
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: campaign.id, status: "sending" })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Reprendre
                      </Button>
                    )}

                    {/* Edit */}
                    {campaign.status !== "sending" && campaign.status !== "sent" && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(campaign)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Modifier
                      </Button>
                    )}

                    {/* Cancel (scheduled/draft/paused) */}
                    {(campaign.status === "scheduled" || campaign.status === "draft" || campaign.status === "paused") && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm("Annuler cette campagne? Elle ne sera pas envoyée.")) {
                            updateStatusMutation.mutate({ id: campaign.id, status: "cancelled" });
                          }
                        }}
                        disabled={updateStatusMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Annuler
                      </Button>
                    )}

                    {/* Delete (allowed for everything except while sending) */}
                    {campaign.status !== "sending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const message =
                            campaign.status === "sent"
                              ? "Supprimer cette campagne envoyée? (Action irréversible)"
                              : "Supprimer cette campagne?";
                          if (confirm(message)) {
                            deleteMutation.mutate(campaign.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        aria-label="Supprimer la campagne"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Destinataires</span>
                    <p className="font-medium">{campaign.total_recipients ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Envoyés</span>
                    <p className="font-medium">{campaign.total_sent ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ouverts</span>
                    <p className="font-medium">
                      {campaign.total_opened ?? 0} 
                      {(campaign.total_sent ?? 0) > 0 && (
                        <span className="text-muted-foreground ml-1">
                          ({Math.round(((campaign.total_opened ?? 0) / (campaign.total_sent ?? 1)) * 100)}%)
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Clics</span>
                    <p className="font-medium">
                      {campaign.total_clicked ?? 0}
                      {(campaign.total_sent ?? 0) > 0 && (
                        <span className="text-muted-foreground ml-1">
                          ({Math.round(((campaign.total_clicked ?? 0) / (campaign.total_sent ?? 1)) * 100)}%)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {campaign.scheduled_at && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Planifiée pour le {format(new Date(campaign.scheduled_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default MarketingCampaigns;
