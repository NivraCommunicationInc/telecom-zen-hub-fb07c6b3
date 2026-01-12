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
import { Label } from "@/components/ui/label";
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
  QrCode,
  Edit,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminReferralInfluencerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [addCodeDialogOpen, setAddCodeDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState("");

  // Fetch influencer with all related data
  const { data: influencer, isLoading } = useQuery({
    queryKey: ["influencer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencers")
        .select(`
          *,
          commission_plans(name, model, value)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
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

  // Add code mutation
  const addCode = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.from("referral_codes").insert({
        influencer_id: id,
        code: code.toUpperCase(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["influencer-codes", id] });
      setAddCodeDialogOpen(false);
      setNewCode("");
      toast.success("Code ajouté");
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Toggle code status
  const toggleCodeStatus = useMutation({
    mutationFn: async ({ codeId, newStatus }: { codeId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("referral_codes")
        .update({ status: newStatus })
        .eq("id", codeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["influencer-codes", id] });
      toast.success("Statut du code mis à jour");
    },
  });

  // Update influencer status
  const updateStatus = useMutation({
    mutationFn: async (status: "active" | "suspended") => {
      const { error } = await supabase
        .from("influencers")
        .update({ status })
        .eq("id", id);
      if (error) throw error;

      if (status === "suspended") {
        await supabase
          .from("referral_codes")
          .update({ status: "disabled" })
          .eq("influencer_id", id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["influencer", id] });
      queryClient.invalidateQueries({ queryKey: ["influencer-codes", id] });
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

  // Activate pending influencer mutation
  const activateInfluencer = useMutation({
    mutationFn: async () => {
      // Update status to active
      const { error: updateError } = await supabase
        .from("influencers")
        .update({ status: "active" })
        .eq("id", id);

      if (updateError) throw updateError;

      // Check if they have an active code, if not generate one
      const { data: existingCodes } = await supabase
        .from("referral_codes")
        .select("id")
        .eq("influencer_id", id)
        .eq("status", "active")
        .limit(1);

      if (!existingCodes || existingCodes.length === 0) {
        const code = `${(influencer?.first_name || "REF").toUpperCase().slice(0, 3)}${Math.random()
          .toString(36)
          .substring(2, 6)
          .toUpperCase()}`;

        await supabase.from("referral_codes").insert({
          influencer_id: id,
          code,
          status: "active",
        });
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
                  {influencer.first_name[0]}{influencer.last_name[0]}
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
            {influencer.status === "invited" && (
              <Button 
                variant="outline"
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
                variant="default"
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
            {influencer.status !== "suspended" ? (
              <Button
                variant="destructive"
                onClick={() => updateStatus.mutate("suspended")}
              >
                <UserX className="w-4 h-4 mr-2" />
                Suspendre
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={() => updateStatus.mutate("active")}
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Réactiver
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="codes">Codes ({codes?.length || 0})</TabsTrigger>
            <TabsTrigger value="referrals">Parrainages ({attributions?.length || 0})</TabsTrigger>
            <TabsTrigger value="earnings">Gains</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informations</CardTitle>
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
                      <TableHead>Limite</TableHead>
                      <TableHead>Créé le</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {codes?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(code.created_at).toLocaleDateString("fr-CA")}
                          </TableCell>
                          <TableCell>
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
                      <TableHead>Statut</TableHead>
                      <TableHead>Rabais appliqué</TableHead>
                      <TableHead>Fraude</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attributions?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
              <Label>Code</Label>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCodeDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => addCode.mutate(newCode)}
              disabled={!newCode || addCode.isPending}
            >
              {addCode.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminReferralInfluencerDetail;
