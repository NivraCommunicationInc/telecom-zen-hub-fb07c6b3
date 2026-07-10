import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Copy,
  Plus,
  Mail,
  UserX,
  UserCheck,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  Loader2,
  Edit,
  Ban,
  Play,
  Wallet,
  Settings,
  AlertTriangle,
} from "lucide-react";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { toast } from "sonner";

const AdminReferralInfluencerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [addCodeDialogOpen, setAddCodeDialogOpen] = useState(false);
  const [editCodeDialogOpen, setEditCodeDialogOpen] = useState(false);
  const [editProfileDialogOpen, setEditProfileDialogOpen] = useState(false);
  const [holdDialogOpen, setHoldDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newCodeLimit, setNewCodeLimit] = useState<string>("");
  const [selectedCode, setSelectedCode] = useState<any>(null);
  const [editCodeData, setEditCodeData] = useState({
    usage_limit_total: "",
    usage_limit_monthly: "",
  });
  const [holdReason, setHoldReason] = useState("");
  const [profileData, setProfileData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    payout_email: "",
    payout_method: "etransfer",
    notes: "",
  });

  // Fetch influencer with all related data
  const { data: influencer, isLoading } = useQuery({
    queryKey: ["influencer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencers")
        .select(`
          *,
          commission_plans(id, name, model, value)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch commission plans for dropdown
  const { data: commissionPlans } = useQuery({
    queryKey: ["commission-plans-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_plans")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch codes
  const { data: codes } = useQuery({
    queryKey: ["influencer-codes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_codes")
        .select("*")
        .eq("influencer_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch attributions
  const { data: attributions } = useQuery({
    queryKey: ["influencer-attributions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_attributions")
        .select("*")
        .eq("influencer_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch ledger entries
  const { data: ledgerEntries } = useQuery({
    queryKey: ["influencer-ledger", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_ledger_entries")
        .select("*")
        .eq("influencer_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch payouts
  const { data: payouts } = useQuery({
    queryKey: ["influencer-payouts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencer_payouts")
        .select(`
          *,
          cashout_requests(request_number, status, admin_note)
        `)
        .eq("influencer_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch cashout requests for this influencer
  const { data: cashoutRequests } = useQuery({
    queryKey: ["influencer-cashouts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashout_requests")
        .select("*")
        .eq("influencer_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Calculate balances from ledger
  const balances = ledgerEntries?.reduce(
    (acc, entry) => {
      const amount = Number(entry.amount);
      if (entry.type === "pending_credit" && entry.status === "pending") {
        acc.pending += amount;
      } else if (entry.type === "approved_credit" || (entry.type === "pending_credit" && entry.status === "approved")) {
        acc.approved += amount;
      } else if (entry.type === "reversal") {
        acc.approved += amount; // reversals are negative
      } else if (entry.type === "payout_debit") {
        acc.paid += Math.abs(amount);
      }
      return acc;
    },
    { pending: 0, approved: 0, paid: 0 }
  ) || { pending: 0, approved: 0, paid: 0 };

  const available = balances.approved - balances.paid;

  // Add code — routed via admin-referrals-manage (F33-1)
  const addCode = useMutation({
    mutationFn: async ({ code, usageLimit }: { code: string; usageLimit?: number }) => {
      const { error } = await supabase.functions.invoke("admin-referrals-manage", {
        body: {
          action: "code.create",
          influencer_id: id,
          code: code.toUpperCase(),
          usage_limit_total: usageLimit || null,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["influencer-codes", id] });
      setAddCodeDialogOpen(false);
      setNewCode("");
      setNewCodeLimit("");
      toast.success("Code ajouté");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Update code — routed via admin-referrals-manage
  const updateCode = useMutation({
    mutationFn: async ({
      codeId,
      updates,
    }: {
      codeId: string;
      updates: { status?: string; usage_limit_total?: number | null; usage_limit_monthly?: number | null };
    }) => {
      // Toggle status action goes through code.toggle; limits go through code.update
      if (updates.status && (updates.status === "active" || updates.status === "disabled")) {
        const { error } = await supabase.functions.invoke("admin-referrals-manage", {
          body: { action: "code.toggle", code_id: codeId, status: updates.status },
        });
        if (error) throw error;
      }
      if (updates.usage_limit_total !== undefined || updates.usage_limit_monthly !== undefined) {
        const { error } = await supabase.functions.invoke("admin-referrals-manage", {
          body: {
            action: "code.update",
            code_id: codeId,
            usage_limit_total: updates.usage_limit_total,
            usage_limit_monthly: updates.usage_limit_monthly,
          },
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["influencer-codes", id] });
      setEditCodeDialogOpen(false);
      setSelectedCode(null);
      toast.success("Code mis à jour");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Toggle code status
  const toggleCodeStatus = useMutation({
    mutationFn: async ({ codeId, newStatus }: { codeId: string; newStatus: string }) => {
      const { error } = await supabase.functions.invoke("admin-referrals-manage", {
        body: { action: "code.toggle", code_id: codeId, status: newStatus },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["influencer-codes", id] });
      toast.success("Statut du code mis à jour");
    },
  });

  // Update influencer profile mutation
  const updateProfile = useMutation({
    mutationFn: async (data: Partial<typeof profileData> & { commission_plan_id?: string }) => {
      const { error } = await supabase
        .from("influencers")
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone || null,
          payout_email: data.payout_email,
          payout_method: data.payout_method,
          notes: data.notes || null,
          commission_plan_id: data.commission_plan_id,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["influencer", id] });
      setEditProfileDialogOpen(false);
      toast.success("Profil mis à jour");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Update influencer status — via admin-referrals-manage (cascade codes server-side)
  const updateStatus = useMutation({
    mutationFn: async ({ status, reason }: { status: "active" | "suspended"; reason?: string }) => {
      const { error } = await supabase.functions.invoke("admin-referrals-manage", {
        body: {
          action: "influencer.set_status",
          influencer_id: id,
          new_status: status,
          reason: reason || (status === "suspended" ? "Suspension admin" : undefined),
          cascade_codes: true,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["influencer", id] });
      queryClient.invalidateQueries({ queryKey: ["influencer-codes", id] });
      setHoldDialogOpen(false);
      setHoldReason("");
      toast.success("Statut mis à jour");
    },
  });

  // Send invite mutation
  const sendInvite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-partner-invite", {
        body: { influencer_id: id },
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

  // Activate pending influencer — via admin-referrals-manage
  const activateInfluencer = useMutation({
    mutationFn: async () => {
      // 1) Set active + cascade codes
      const { error: sErr } = await supabase.functions.invoke("admin-referrals-manage", {
        body: {
          action: "influencer.set_status",
          influencer_id: id,
          new_status: "active",
          cascade_codes: true,
        },
      });
      if (sErr) throw sErr;
      // 2) Generate first code server-side if none exists
      const { data: existingCodes } = await supabase
        .from("referral_codes")
        .select("id")
        .eq("influencer_id", id)
        .eq("status", "active")
        .limit(1);
      if (!existingCodes || existingCodes.length === 0) {
        const code = `${(influencer?.first_name || "REF").toUpperCase().slice(0, 3)}${Math.random()
          .toString(36).substring(2, 6).toUpperCase()}`;
        const { error: cErr } = await supabase.functions.invoke("admin-referrals-manage", {
          body: { action: "code.create", influencer_id: id, code },
        });
        if (cErr) throw cErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["influencer", id] });
      queryClient.invalidateQueries({ queryKey: ["influencer-codes", id] });
      toast.success("Partenaire activé avec succès!");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié!");
  };

  const openEditProfile = () => {
    if (influencer) {
      setProfileData({
        first_name: influencer.first_name || "",
        last_name: influencer.last_name || "",
        email: influencer.email || "",
        phone: influencer.phone || "",
        payout_email: influencer.payout_email || influencer.email || "",
        payout_method: influencer.payout_method || "etransfer",
        notes: influencer.notes || "",
      });
      setEditProfileDialogOpen(true);
    }
  };

  const openEditCode = (code: any) => {
    setSelectedCode(code);
    setEditCodeData({
      usage_limit_total: code.usage_limit_total?.toString() || "",
      usage_limit_monthly: code.usage_limit_monthly?.toString() || "",
    });
    setEditCodeDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Actif</Badge>;
      case "invited":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Invité</Badge>;
      case "pending":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">En attente</Badge>;
      case "suspended":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Suspendu</Badge>;
      case "disabled":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Désactivé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCashoutStatusBadge = (status: string) => {
    switch (status) {
      case "requested":
        return <Badge className="bg-yellow-500/20 text-yellow-400">En attente</Badge>;
      case "approved":
        return <Badge className="bg-green-500/20 text-green-400">Approuvé</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-400">Rejeté</Badge>;
      case "paid":
        return <Badge className="bg-purple-500/20 text-purple-400">Payé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLedgerTypeBadge = (type: string) => {
    switch (type) {
      case "pending_credit":
        return <Badge className="bg-yellow-500/20 text-yellow-400">En attente</Badge>;
      case "approved_credit":
        return <Badge className="bg-green-500/20 text-green-400">Approuvé</Badge>;
      case "reversal":
        return <Badge className="bg-red-500/20 text-red-400">Annulé</Badge>;
      case "payout_debit":
        return <Badge className="bg-blue-500/20 text-blue-400">Paiement</Badge>;
      case "manual_adjustment":
        return <Badge className="bg-purple-500/20 text-purple-400">Ajustement</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!influencer) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Influenceur non trouvé</p>
          <Button asChild className="mt-4">
            <Link to="/admin/referrals/influencers">Retour</Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/referrals/influencers">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-lg font-semibold text-primary">
                  {influencer.first_name?.[0] || "?"}{influencer.last_name?.[0] || "?"}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {influencer.first_name} {influencer.last_name}
                </h1>
                <p className="text-muted-foreground">{influencer.email}</p>
              </div>
              {getStatusBadge(influencer.status)}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={openEditProfile}>
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Button>
            {influencer.status === "invited" && (
              <Button 
                variant="outline"
                size="sm"
                onClick={() => sendInvite.mutate()}
                disabled={sendInvite.isPending}
              >
                {sendInvite.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Renvoyer invitation
              </Button>
            )}
            {influencer.status === "pending" && (
              <Button
                size="sm"
                onClick={() => activateInfluencer.mutate()}
                disabled={activateInfluencer.isPending}
              >
                {activateInfluencer.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Activer
              </Button>
            )}
            {influencer.status === "active" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setHoldDialogOpen(true)}
              >
                <UserX className="w-4 h-4 mr-2" />
                Suspendre
              </Button>
            )}
            {influencer.status === "suspended" && (
              <Button
                size="sm"
                onClick={() => updateStatus.mutate({ status: "active" })}
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Réactiver
              </Button>
            )}
          </div>
        </div>

        {/* Warning for suspended status */}
        {influencer.status === "suspended" && (
          <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <p className="font-medium text-red-500">Compte suspendu</p>
              <p className="text-sm text-muted-foreground">
                Les codes de cet influenceur sont désactivés. Les commissions en attente sont conservées.
              </p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">En attente</p>
                  <p className="text-xl font-bold">${balances.pending.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Disponible</p>
                  <p className="text-xl font-bold">${available.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total payé</p>
                  <p className="text-xl font-bold">${balances.paid.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Parrainages</p>
                  <p className="text-xl font-bold">{attributions?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Wallet className="w-8 h-8 text-pink-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Demandes retrait</p>
                  <p className="text-xl font-bold">{cashoutRequests?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="codes">Codes ({codes?.length || 0})</TabsTrigger>
            <TabsTrigger value="referrals">Parrainages ({attributions?.length || 0})</TabsTrigger>
            <TabsTrigger value="earnings">Gains</TabsTrigger>
            <TabsTrigger value="payouts">Paiements ({payouts?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Informations</CardTitle>
                  <Button variant="ghost" size="sm" onClick={openEditProfile}>
                    <Settings className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{influencer.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Téléphone</Label>
                    <p className="font-medium">{influencer.phone || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Plan de commission</Label>
                    <p className="font-medium">
                      {influencer.commission_plans?.name || "Standard"} (${influencer.commission_plans?.value || 25})
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Inscrit le</Label>
                    <p className="font-medium">
                      {new Date(influencer.created_at).toLocaleDateString("fr-CA")}
                    </p>
                  </div>
                  {influencer.notes && (
                    <div>
                      <Label className="text-muted-foreground">Notes internes</Label>
                      <p className="text-sm whitespace-pre-wrap bg-muted/50 p-2 rounded mt-1">
                        {influencer.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Paiement</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Méthode</Label>
                    <p className="font-medium capitalize">{influencer.payout_method || "Interac e-Transfer"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email de paiement</Label>
                    <p className="font-medium">{influencer.payout_email || influencer.email}</p>
                  </div>
                  <div className="pt-4 border-t">
                    <Label className="text-muted-foreground">Résumé financier</Label>
                    <div className="mt-2 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Commissions gagnées</span>
                        <span className="font-medium">${(balances.approved + balances.pending).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-green-500">
                        <span>Disponible pour retrait</span>
                        <span className="font-medium">${available.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-purple-500">
                        <span>Déjà versé</span>
                        <span className="font-medium">${balances.paid.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="codes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Codes de parrainage</CardTitle>
                  <CardDescription>Codes attribués à cet influenceur</CardDescription>
                </div>
                <Button onClick={() => setAddCodeDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un code
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-center">Utilisations</TableHead>
                      <TableHead>Limite totale</TableHead>
                      <TableHead>Limite mensuelle</TableHead>
                      <TableHead>Créé le</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {codes?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Aucun code
                        </TableCell>
                      </TableRow>
                    ) : (
                      codes?.map((code) => (
                        <TableRow key={code.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="px-2 py-1 bg-muted rounded font-mono">
                                {code.code}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(code.code)}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(code.status)}</TableCell>
                          <TableCell className="text-center">{code.usage_count}</TableCell>
                          <TableCell>
                            {code.usage_limit_total ? `${code.usage_limit_total} max` : "Illimité"}
                          </TableCell>
                          <TableCell>
                            {code.usage_limit_monthly ? `${code.usage_limit_monthly}/mois` : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(code.created_at).toLocaleDateString("fr-CA")}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditCode(code)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  toggleCodeStatus.mutate({
                                    codeId: code.id,
                                    newStatus: code.status === "active" ? "disabled" : "active",
                                  })
                                }
                              >
                                {code.status === "active" ? "Désactiver" : "Activer"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="referrals">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Parrainages</CardTitle>
                <CardDescription>Clients référés par cet influenceur</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Code utilisé</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Rabais appliqué</TableHead>
                      <TableHead>Fraude</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attributions?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Aucun parrainage
                        </TableCell>
                      </TableRow>
                    ) : (
                      attributions?.map((attr) => (
                        <TableRow key={attr.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{attr.customer_email}</p>
                              <p className="text-xs text-muted-foreground">ID: {attr.customer_id}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="px-2 py-0.5 bg-muted rounded text-xs">
                              {attr.referral_code_id ? attr.referral_code_id.slice(0, 8) : "—"}
                            </code>
                          </TableCell>
                          <TableCell>{getStatusBadge(attr.status)}</TableCell>
                          <TableCell>${Number(attr.customer_discount_amount).toFixed(2)}</TableCell>
                          <TableCell>
                            {attr.fraud_flag_level !== "none" ? (
                              <Badge className="bg-red-500/20 text-red-400">
                                {attr.fraud_flag_level}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(attr.created_at).toLocaleDateString("fr-CA")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="earnings">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Historique des gains</CardTitle>
                <CardDescription>Toutes les entrées du ledger</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerEntries?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Aucune entrée
                        </TableCell>
                      </TableRow>
                    ) : (
                      ledgerEntries?.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{getLedgerTypeBadge(entry.type)}</TableCell>
                          <TableCell className={`font-medium ${Number(entry.amount) < 0 ? "text-red-400" : "text-green-400"}`}>
                            {Number(entry.amount) >= 0 ? "+" : ""}${Number(entry.amount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{entry.status}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {entry.notes || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(entry.created_at).toLocaleDateString("fr-CA")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payouts">
            <div className="space-y-6">
              {/* Cashout Requests */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Demandes de retrait</CardTitle>
                  <CardDescription>Historique des demandes de paiement</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numéro</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Méthode</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Note admin</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashoutRequests?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Aucune demande de retrait
                          </TableCell>
                        </TableRow>
                      ) : (
                        cashoutRequests?.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell className="font-mono text-sm">{req.request_number}</TableCell>
                            <TableCell className="font-bold">${Number(req.amount).toFixed(2)}</TableCell>
                            <TableCell className="capitalize">{req.method}</TableCell>
                            <TableCell className="text-sm max-w-[150px] truncate">{req.destination}</TableCell>
                            <TableCell>{getCashoutStatusBadge(req.status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                              {req.admin_note || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(req.created_at).toLocaleDateString("fr-CA")}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Actual Payouts */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Paiements effectués</CardTitle>
                  <CardDescription>Versements confirmés</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Demande liée</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Méthode</TableHead>
                        <TableHead>Référence</TableHead>
                        <TableHead>Date de paiement</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payouts?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Aucun paiement effectué
                          </TableCell>
                        </TableRow>
                      ) : (
                        payouts?.map((payout) => (
                          <TableRow key={payout.id}>
                            <TableCell className="font-mono text-sm">
                              {payout.cashout_requests?.request_number || "—"}
                            </TableCell>
                            <TableCell className="font-bold text-green-400">
                              ${Number(payout.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="capitalize">{payout.method}</TableCell>
                            <TableCell className="text-sm">{payout.reference_id || "—"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(payout.paid_at).toLocaleDateString("fr-CA")}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Code Dialog */}
      <Dialog open={addCodeDialogOpen} onOpenChange={setAddCodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un code</DialogTitle>
            <DialogDescription>
              Créez un nouveau code de parrainage pour cet influenceur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="MONCODE"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Le code sera automatiquement converti en majuscules.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Limite d'utilisation (optionnel)</Label>
              <Input
                type="number"
                value={newCodeLimit}
                onChange={(e) => setNewCodeLimit(e.target.value)}
                placeholder="Illimité"
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Nombre maximum d'utilisations. Laissez vide pour illimité.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCodeDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => addCode.mutate({ 
                code: newCode, 
                usageLimit: newCodeLimit ? parseInt(newCodeLimit) : undefined 
              })}
              disabled={!newCode || addCode.isPending}
            >
              {addCode.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Code Dialog */}
      <Dialog open={editCodeDialogOpen} onOpenChange={setEditCodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le code</DialogTitle>
            <DialogDescription>
              Modifiez les limites d'utilisation pour le code: {selectedCode?.code}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Limite totale d'utilisation</Label>
              <Input
                type="number"
                value={editCodeData.usage_limit_total}
                onChange={(e) => setEditCodeData(prev => ({ ...prev, usage_limit_total: e.target.value }))}
                placeholder="Illimité"
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Limite mensuelle</Label>
              <Input
                type="number"
                value={editCodeData.usage_limit_monthly}
                onChange={(e) => setEditCodeData(prev => ({ ...prev, usage_limit_monthly: e.target.value }))}
                placeholder="Pas de limite"
                min="1"
              />
            </div>
            <div className="p-3 bg-muted/50 rounded text-sm">
              <p>Utilisations actuelles: {selectedCode?.usage_count || 0}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCodeDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => updateCode.mutate({
                codeId: selectedCode.id,
                updates: {
                  usage_limit_total: editCodeData.usage_limit_total ? parseInt(editCodeData.usage_limit_total) : null,
                  usage_limit_monthly: editCodeData.usage_limit_monthly ? parseInt(editCodeData.usage_limit_monthly) : null,
                },
              })}
              disabled={updateCode.isPending}
            >
              {updateCode.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={editProfileDialogOpen} onOpenChange={setEditProfileDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le profil</DialogTitle>
            <DialogDescription>
              Mettez à jour les informations de l'influenceur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prénom</Label>
                <Input
                  value={profileData.first_name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input
                  value={profileData.last_name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input
                value={profileData.phone}
                onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Optionnel"
              />
            </div>
            <div className="space-y-2">
              <Label>Plan de commission</Label>
              <Select
                value={influencer.commission_plan_id || ""}
                onValueChange={(value) => {
                  // Store plan ID for update
                  (profileData as any).commission_plan_id = value;
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un plan" />
                </SelectTrigger>
                <SelectContent>
                  {commissionPlans?.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} (${plan.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Informations de paiement</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Méthode de paiement</Label>
                  <Select
                    value={profileData.payout_method}
                    onValueChange={(value) => setProfileData(prev => ({ ...prev, payout_method: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="etransfer">Interac e-Transfer</SelectItem>
                      <SelectItem value="cheque">Chèque</SelectItem>
                      <SelectItem value="direct_deposit">Dépôt direct</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Email de paiement</Label>
                  <Input
                    type="email"
                    value={profileData.payout_email}
                    onChange={(e) => setProfileData(prev => ({ ...prev, payout_email: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes internes</Label>
              <Textarea
                value={profileData.notes}
                onChange={(e) => setProfileData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes visibles uniquement par les admins..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProfileDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => updateProfile.mutate({
                ...profileData,
                commission_plan_id: (profileData as any).commission_plan_id,
              })}
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Account Dialog */}
      <Dialog open={holdDialogOpen} onOpenChange={setHoldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspendre le compte</DialogTitle>
            <DialogDescription>
              Les codes seront désactivés. Les commissions en attente seront conservées.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Raison de suspension (optionnel)</Label>
              <Textarea
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder="Raison de la suspension..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => updateStatus.mutate({ status: "suspended", reason: holdReason })}
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Suspendre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminReferralInfluencerDetail;
