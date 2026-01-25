import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  UserX,
  UserCheck,
  Eye,
  Loader2,
  CheckCircle,
  Stethoscope,
  Wrench,
  Clock,
  Link2,
} from "lucide-react";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DiagnoseResult {
  email: string;
  auth_user_exists: boolean;
  auth_user_id: string | null;
  influencer_row_exists: boolean;
  influencer_id: string | null;
  influencer_user_id: string | null;
  influencer_status: string | null;
  issues: string[];
  repaired: boolean;
  repair_actions: string[];
}

const AdminReferralInfluencers = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [diagnoseDialogOpen, setDiagnoseDialogOpen] = useState(false);
  const [diagnoseEmail, setDiagnoseEmail] = useState("");
  const [diagnoseResult, setDiagnoseResult] = useState<DiagnoseResult | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [newInfluencer, setNewInfluencer] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    notes: "",
  });

  // Fetch influencers with their codes and referrals count
  const { data: influencers, isLoading } = useQuery({
    queryKey: ["influencers", searchTerm, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("influencers")
        .select(`
          *,
          commission_plans(name),
          referral_codes(id),
          referral_attributions(id)
        `)
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.or(
          `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
        );
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as "active" | "invited" | "suspended" | "pending");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Count pending approvals for badge
  const pendingCount = influencers?.filter(i => i.status === "pending").length ?? 0;

  // Fetch commission plans for dropdown
  const { data: commissionPlans } = useQuery({
    queryKey: ["commission-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_plans")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Create influencer mutation - uses Edge Function to bypass RLS
  const createInfluencer = useMutation({
    mutationFn: async (data: typeof newInfluencer) => {
      console.log("[createInfluencer] Calling admin-create-partner with:", data);
      
      const { data: result, error } = await supabase.functions.invoke("admin-create-partner", {
        body: {
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone || undefined,
          notes: data.notes || undefined,
        },
      });

      console.log("[createInfluencer] Response:", result, error);

      if (error) {
        console.error("[createInfluencer] Function error:", error);
        throw new Error(error.message || "Erreur lors de la création");
      }

      if (!result?.ok) {
        throw new Error(result?.message || "Erreur inconnue");
      }

      // Send invitation email
      const { error: emailError } = await supabase.functions.invoke("send-partner-invite", {
        body: { influencer_id: result.influencer_id },
      });

      if (emailError) {
        console.error("[createInfluencer] Email send error:", emailError);
        toast.warning("Partenaire créé, mais l'email n'a pas pu être envoyé.");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["influencers"] });
      setCreateDialogOpen(false);
      setNewInfluencer({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        notes: "",
      });
      toast.success("Partenaire créé avec succès. Email d'invitation envoyé.");
    },
    onError: (error: Error) => {
      console.error("[createInfluencer] Error:", error);
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Send invite mutation
  const sendInvite = useMutation({
    mutationFn: async (influencerId: string) => {
      const { data, error } = await supabase.functions.invoke("send-partner-invite", {
        body: { influencer_id: influencerId },
      });

      if (error) {
        console.error("Full error response:", error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Email d'invitation envoyé!");
    },
    onError: (error: Error) => {
      console.error("Send invite error:", error);
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Activate pending influencer mutation
  const activateInfluencer = useMutation({
    mutationFn: async (influencerId: string) => {
      // Update status to active
      const { error: updateError } = await supabase
        .from("influencers")
        .update({ status: "active" })
        .eq("id", influencerId);

      if (updateError) throw updateError;

      // Check if they have an active code, if not generate one
      const { data: existingCodes } = await supabase
        .from("referral_codes")
        .select("id")
        .eq("influencer_id", influencerId)
        .eq("status", "active")
        .limit(1);

      if (!existingCodes || existingCodes.length === 0) {
        // Get influencer info for code generation
        const { data: influencer } = await supabase
          .from("influencers")
          .select("first_name")
          .eq("id", influencerId)
          .single();

        const code = `${(influencer?.first_name || "REF").toUpperCase().slice(0, 3)}${Math.random()
          .toString(36)
          .substring(2, 6)
          .toUpperCase()}`;

        await supabase.from("referral_codes").insert({
          influencer_id: influencerId,
          code,
          status: "active",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["influencers"] });
      toast.success("Partenaire activé avec succès!");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "active" | "suspended";
    }) => {
      const { error } = await supabase
        .from("influencers")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      // If suspending, disable all codes
      if (status === "suspended") {
        await supabase
          .from("referral_codes")
          .update({ status: "disabled" })
          .eq("influencer_id", id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["influencers"] });
      toast.success("Statut mis à jour");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Quick repair mutation for inline use
  const quickRepairMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke("partner-account-diagnose", {
        body: { email, repair: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["influencers"] });
      if (data.repaired) {
        toast.success("Compte lié et réparé avec succès!");
      } else if (data.issues?.length === 0) {
        toast.info("Aucun problème détecté, le compte est déjà configuré.");
      } else {
        toast.warning("Réparation partielle. Voir diagnostic pour détails.");
      }
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Diagnose account
  const handleDiagnose = async () => {
    if (!diagnoseEmail) {
      toast.error("Veuillez entrer un email");
      return;
    }
    setIsDiagnosing(true);
    setDiagnoseResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("partner-account-diagnose", {
        body: { email: diagnoseEmail, repair: false },
      });
      if (error) throw error;
      setDiagnoseResult(data);
    } catch (error: any) {
      console.error("Diagnose error:", error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Repair account
  const handleRepair = async () => {
    if (!diagnoseEmail) return;
    setIsRepairing(true);
    try {
      const { data, error } = await supabase.functions.invoke("partner-account-diagnose", {
        body: { email: diagnoseEmail, repair: true },
      });
      if (error) throw error;
      setDiagnoseResult(data);
      if (data.repaired) {
        toast.success("Compte réparé avec succès!");
        queryClient.invalidateQueries({ queryKey: ["influencers"] });
      }
    } catch (error: any) {
      console.error("Repair error:", error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsRepairing(false);
    }
  };

  // Quick diagnose for a specific influencer
  const handleQuickDiagnose = (email: string) => {
    setDiagnoseEmail(email);
    setDiagnoseDialogOpen(true);
    setDiagnoseResult(null);
    // Auto-run diagnose
    setTimeout(async () => {
      setIsDiagnosing(true);
      try {
        const { data, error } = await supabase.functions.invoke("partner-account-diagnose", {
          body: { email, repair: false },
        });
        if (error) throw error;
        setDiagnoseResult(data);
      } catch (error: any) {
        console.error("Diagnose error:", error);
        toast.error(`Erreur: ${error.message}`);
      } finally {
        setIsDiagnosing(false);
      }
    }, 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            Actif
          </Badge>
        );
      case "invited":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            Invité
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            En attente
          </Badge>
        );
      case "suspended":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            Suspendu
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/referrals">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">Influenceurs</h1>
              {pendingCount > 0 && (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse">
                  <Clock className="w-3 h-3 mr-1" />
                  {pendingCount} en attente
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Gérez vos partenaires et leurs codes
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setDiagnoseDialogOpen(true);
              setDiagnoseEmail("");
              setDiagnoseResult(null);
            }}>
              <Stethoscope className="w-4 h-4 mr-2" />
              Diagnostiquer
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvel Influenceur
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              {/* Quick filter button for pending */}
              {pendingCount > 0 && statusFilter !== "pending" && (
                <Button
                  variant="outline"
                  className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                  onClick={() => setStatusFilter("pending")}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  En attente ({pendingCount})
                </Button>
              )}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="invited">Invités</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="suspended">Suspendus</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Debug info (admin only) */}
        <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded border">
          DEBUG: Total influencers: {influencers?.length ?? 0} | Pending: {pendingCount}
        </div>

        {/* Pending Approvals Section */}
        {pendingCount > 0 && (
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Demandes en attente ({pendingCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {influencers
                ?.filter((i) => i.status === "pending")
                .map((influencer) => (
                  <div
                    key={influencer.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-background border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <span className="text-sm font-semibold text-orange-500">
                          {(influencer.first_name || "?")[0]}
                          {(influencer.last_name || "?")[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {influencer.first_name || "—"} {influencer.last_name || ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {influencer.email} • Inscrit le{" "}
                          {new Date(influencer.created_at).toLocaleDateString("fr-CA")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => activateInfluencer.mutate(influencer.id)}
                        disabled={activateInfluencer.isPending}
                      >
                        {activateInfluencer.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approuver
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <Link to={`/admin/referrals/influencers/${influencer.id}`}>
                          <Eye className="w-4 h-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Influenceur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-center">Codes</TableHead>
                  <TableHead className="text-center">Parrainages</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : influencers?.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      Aucun influenceur trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  influencers?.map((influencer) => (
                    <TableRow key={influencer.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">
                              {(influencer.first_name || "?")[0]}
                              {(influencer.last_name || "?")[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">
                              {influencer.first_name || "—"} {influencer.last_name || ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {influencer.email || "—"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(influencer.status)}</TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {influencer.commission_plans?.name || "Standard"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {influencer.referral_codes?.length || 0}
                      </TableCell>
                      <TableCell className="text-center">
                        {influencer.referral_attributions?.length || 0}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(influencer.created_at).toLocaleDateString(
                          "fr-CA"
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link
                                to={`/admin/referrals/influencers/${influencer.id}`}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Voir détails
                              </Link>
                            </DropdownMenuItem>
                            {influencer.status === "invited" && (
                              <DropdownMenuItem
                                onClick={() => sendInvite.mutate(influencer.id)}
                                disabled={sendInvite.isPending}
                              >
                                <Mail className="w-4 h-4 mr-2" />
                                {sendInvite.isPending ? "Envoi..." : "Renvoyer invitation"}
                              </DropdownMenuItem>
                            )}
                            {influencer.status === "pending" && (
                              <DropdownMenuItem
                                className="text-green-500"
                                onClick={() => activateInfluencer.mutate(influencer.id)}
                                disabled={activateInfluencer.isPending}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                {activateInfluencer.isPending ? "Activation..." : "Activer"}
                              </DropdownMenuItem>
                            )}
                            {/* Link Account - for unlinked influencers */}
                            {!influencer.user_id && (
                              <DropdownMenuItem
                                onClick={() => quickRepairMutation.mutate(influencer.email)}
                                disabled={quickRepairMutation.isPending}
                                className="text-blue-500"
                              >
                                <Link2 className="w-4 h-4 mr-2" />
                                {quickRepairMutation.isPending ? "Liaison..." : "Lier le compte"}
                              </DropdownMenuItem>
                            )}
                            {/* Diagnose */}
                            <DropdownMenuItem
                              onClick={() => handleQuickDiagnose(influencer.email)}
                            >
                              <Stethoscope className="w-4 h-4 mr-2" />
                              Diagnostiquer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {influencer.status !== "suspended" ? (
                              <DropdownMenuItem
                                className="text-red-500"
                                onClick={() =>
                                  updateStatus.mutate({
                                    id: influencer.id,
                                    status: "suspended",
                                  })
                                }
                              >
                                <UserX className="w-4 h-4 mr-2" />
                                Suspendre
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-green-500"
                                onClick={() =>
                                  updateStatus.mutate({
                                    id: influencer.id,
                                    status: "active",
                                  })
                                }
                              >
                                <UserCheck className="w-4 h-4 mr-2" />
                                Réactiver
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nouvel Influenceur</DialogTitle>
            <DialogDescription>
              Créez un nouveau partenaire. Une invitation sera envoyée par email.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Prénom *</Label>
                <Input
                  id="first_name"
                  value={newInfluencer.first_name}
                  onChange={(e) =>
                    setNewInfluencer({
                      ...newInfluencer,
                      first_name: e.target.value,
                    })
                  }
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nom *</Label>
                <Input
                  id="last_name"
                  value={newInfluencer.last_name}
                  onChange={(e) =>
                    setNewInfluencer({
                      ...newInfluencer,
                      last_name: e.target.value,
                    })
                  }
                  placeholder="Dupont"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newInfluencer.email}
                onChange={(e) =>
                  setNewInfluencer({ ...newInfluencer, email: e.target.value })
                }
                placeholder="jean@exemple.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                type="tel"
                value={newInfluencer.phone}
                onChange={(e) =>
                  setNewInfluencer({ ...newInfluencer, phone: e.target.value })
                }
                placeholder="+1 514 555 1234"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes internes</Label>
              <Textarea
                id="notes"
                value={newInfluencer.notes}
                onChange={(e) =>
                  setNewInfluencer({ ...newInfluencer, notes: e.target.value })
                }
                placeholder="Notes optionnelles..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => createInfluencer.mutate(newInfluencer)}
              disabled={
                !newInfluencer.first_name ||
                !newInfluencer.last_name ||
                !newInfluencer.email ||
                createInfluencer.isPending
              }
            >
              {createInfluencer.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Créer et inviter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diagnose Dialog */}
      <Dialog open={diagnoseDialogOpen} onOpenChange={setDiagnoseDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Diagnostiquer / Réparer un compte</DialogTitle>
            <DialogDescription>
              Vérifiez si un compte partenaire existe et réparez les problèmes éventuels.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Email du partenaire..."
                value={diagnoseEmail}
                onChange={(e) => setDiagnoseEmail(e.target.value)}
              />
              <Button onClick={handleDiagnose} disabled={isDiagnosing || !diagnoseEmail}>
                {isDiagnosing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Analyser
              </Button>
            </div>

            {diagnoseResult && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Auth User:</div>
                  <div>
                    {diagnoseResult.auth_user_exists ? (
                      <Badge className="bg-green-500/20 text-green-400">Existe</Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-400">Non trouvé</Badge>
                    )}
                    {diagnoseResult.auth_user_id && (
                      <span className="ml-2 text-xs text-muted-foreground">{diagnoseResult.auth_user_id.slice(0, 8)}...</span>
                    )}
                  </div>

                  <div className="font-medium">Influencer Row:</div>
                  <div>
                    {diagnoseResult.influencer_row_exists ? (
                      <Badge className="bg-green-500/20 text-green-400">Existe</Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-400">Non trouvé</Badge>
                    )}
                    {diagnoseResult.influencer_status && (
                      <span className="ml-2">{getStatusBadge(diagnoseResult.influencer_status)}</span>
                    )}
                  </div>
                </div>

                {diagnoseResult.issues.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTitle>Problèmes détectés</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside text-sm mt-1">
                        {diagnoseResult.issues.map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {diagnoseResult.issues.length === 0 && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Aucun problème</AlertTitle>
                    <AlertDescription>Le compte est correctement configuré.</AlertDescription>
                  </Alert>
                )}

                {diagnoseResult.repair_actions.length > 0 && (
                  <Alert className="border-green-500/30">
                    <Wrench className="h-4 w-4" />
                    <AlertTitle>Actions de réparation</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside text-sm mt-1">
                        {diagnoseResult.repair_actions.map((action, i) => (
                          <li key={i}>{action}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiagnoseDialogOpen(false)}>
              Fermer
            </Button>
            {diagnoseResult && diagnoseResult.issues.length > 0 && !diagnoseResult.repaired && (
              <Button onClick={handleRepair} disabled={isRepairing}>
                {isRepairing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Wrench className="w-4 h-4 mr-2" />
                Réparer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminReferralInfluencers;
