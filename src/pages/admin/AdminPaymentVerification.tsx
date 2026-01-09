import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  ArrowRightLeft,
  Bitcoin,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PaymentRequest {
  id: string;
  user_id: string;
  method: "interac" | "crypto";
  amount: number;
  currency: string;
  reference_code: string;
  client_reference: string | null;
  crypto_currency: string | null;
  crypto_txid: string | null;
  status: "pending_verification" | "verified" | "rejected" | "cancelled";
  verified_at: string | null;
  verified_by: string | null;
  verification_note: string | null;
  rejection_reason: string | null;
  created_at: string;
  profiles?: {
    email: string;
    full_name: string;
  };
}

const AdminPaymentVerification = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending_verification");
  const [selectedPayment, setSelectedPayment] = useState<PaymentRequest | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [verificationNote, setVerificationNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // Fetch payment requests with profile info
  const { data: payments, isLoading, refetch } = useQuery({
    queryKey: ["admin-payment-requests", statusFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("payment_requests")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      if (searchTerm) {
        query = query.or(`reference_code.ilike.%${searchTerm}%,client_reference.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch profiles separately for each payment
      const paymentsWithProfiles = await Promise.all(
        (data || []).map(async (payment) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("user_id", payment.user_id)
            .single();
          return { ...payment, profiles: profile } as PaymentRequest;
        })
      );
      
      return paymentsWithProfiles;
    },
  });

  // Verify payment mutation
  const verifyMutation = useMutation({
    mutationFn: async ({ paymentId, note }: { paymentId: string; note: string }) => {
      const { error } = await supabase
        .from("payment_requests")
        .update({
          status: "verified",
          verified_at: new Date().toISOString(),
          verification_note: note,
        })
        .eq("id", paymentId);
      
      if (error) throw error;
      
      // Log the action
      await supabase.from("admin_security_audit").insert({
        admin_user_id: (await supabase.from("admin_users").select("id").single()).data?.id,
        action: "payment_verified",
        target_type: "payment_request",
        target_id: paymentId,
        details: { note },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payment-requests"] });
      toast({ title: "Paiement vérifié", description: "Le paiement a été marqué comme vérifié." });
      setVerifyDialogOpen(false);
      setSelectedPayment(null);
      setVerificationNote("");
    },
    onError: (error) => {
      toast({ title: "Erreur", description: "Impossible de vérifier le paiement.", variant: "destructive" });
      console.error(error);
    },
  });

  // Reject payment mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const { error } = await supabase
        .from("payment_requests")
        .update({
          status: "rejected",
          rejection_reason: reason,
        })
        .eq("id", paymentId);
      
      if (error) throw error;
      
      // Log the action
      await supabase.from("admin_security_audit").insert({
        admin_user_id: (await supabase.from("admin_users").select("id").single()).data?.id,
        action: "payment_rejected",
        target_type: "payment_request",
        target_id: paymentId,
        details: { reason },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payment-requests"] });
      toast({ title: "Paiement rejeté", description: "Le paiement a été marqué comme rejeté." });
      setRejectDialogOpen(false);
      setSelectedPayment(null);
      setRejectionReason("");
    },
    onError: (error) => {
      toast({ title: "Erreur", description: "Impossible de rejeter le paiement.", variant: "destructive" });
      console.error(error);
    },
  });

  const getStatusBadge = (status: PaymentRequest["status"]) => {
    switch (status) {
      case "pending_verification":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500"><Clock className="w-3 h-3 mr-1" /> En attente</Badge>;
      case "verified":
        return <Badge variant="outline" className="border-green-500 text-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Vérifié</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rejeté</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Annulé</Badge>;
    }
  };

  const pendingCount = payments?.filter(p => p.status === "pending_verification").length || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Vérification des paiements</h1>
            <p className="text-muted-foreground">
              Vérifiez les paiements Interac et crypto-monnaie
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2">{pendingCount} en attente</Badge>
              )}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Rechercher par référence..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList>
                  <TabsTrigger value="pending_verification">En attente</TabsTrigger>
                  <TabsTrigger value="verified">Vérifiés</TabsTrigger>
                  <TabsTrigger value="rejected">Rejetés</TabsTrigger>
                  <TabsTrigger value="all">Tous</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Demandes de paiement</CardTitle>
            <CardDescription>
              {payments?.length || 0} paiement(s) trouvé(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : payments && payments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{payment.profiles?.full_name || "N/A"}</p>
                          <p className="text-sm text-muted-foreground">{payment.profiles?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {payment.method === "interac" ? (
                            <ArrowRightLeft className="w-4 h-4 text-primary" />
                          ) : (
                            <Bitcoin className="w-4 h-4 text-orange-500" />
                          )}
                          <span>
                            {payment.method === "interac" ? "Interac" : payment.crypto_currency || "Crypto"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono font-semibold">
                        {payment.amount.toFixed(2)} {payment.currency}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm">{payment.reference_code}</p>
                          {payment.client_reference && (
                            <p className="text-xs text-muted-foreground">
                              Client: {payment.client_reference}
                            </p>
                          )}
                          {payment.crypto_txid && (
                            <a 
                              href={`https://blockchair.com/search?q=${payment.crypto_txid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              TXID <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(payment.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell className="text-right">
                        {payment.status === "pending_verification" && (
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-500 text-green-500 hover:bg-green-500/10"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setVerifyDialogOpen(true);
                              }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-500 text-red-500 hover:bg-red-500/10"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setRejectDialogOpen(true);
                              }}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                        {payment.status === "verified" && payment.verification_note && (
                          <p className="text-xs text-green-600">{payment.verification_note}</p>
                        )}
                        {payment.status === "rejected" && payment.rejection_reason && (
                          <p className="text-xs text-red-600">{payment.rejection_reason}</p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun paiement à vérifier</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Verify Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la vérification</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 bg-accent/50 rounded-lg">
                <p><strong>Montant:</strong> {selectedPayment.amount.toFixed(2)} {selectedPayment.currency}</p>
                <p><strong>Méthode:</strong> {selectedPayment.method === "interac" ? "Interac" : selectedPayment.crypto_currency}</p>
                <p><strong>Référence:</strong> {selectedPayment.reference_code}</p>
                {selectedPayment.client_reference && (
                  <p><strong>Réf. client:</strong> {selectedPayment.client_reference}</p>
                )}
              </div>
              <div>
                <Label>Note de vérification (optionnel)</Label>
                <Textarea
                  placeholder="Ex: Confirmation Interac #12345 reçue"
                  value={verificationNote}
                  onChange={(e) => setVerificationNote(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="hero"
              onClick={() => selectedPayment && verifyMutation.mutate({
                paymentId: selectedPayment.id,
                note: verificationNote
              })}
              disabled={verifyMutation.isPending}
            >
              {verifyMutation.isPending ? "Vérification..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter le paiement</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="p-4 bg-accent/50 rounded-lg">
                <p><strong>Montant:</strong> {selectedPayment.amount.toFixed(2)} {selectedPayment.currency}</p>
                <p><strong>Référence:</strong> {selectedPayment.reference_code}</p>
              </div>
              <div>
                <Label>Raison du rejet *</Label>
                <Textarea
                  placeholder="Ex: Montant incorrect, référence introuvable..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedPayment && rejectMutation.mutate({
                paymentId: selectedPayment.id,
                reason: rejectionReason
              })}
              disabled={!rejectionReason || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejet..." : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminPaymentVerification;
