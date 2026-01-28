/**
 * StaffClientFinancialSection - Add credits and fees to client accounts
 * Complete financial adjustment tools with audit trail
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { 
  DollarSign, Plus, Minus, CreditCard, Receipt,
  Loader2, RefreshCw, Gift, AlertCircle, TrendingUp,
  TrendingDown, History
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { createAuditNote } from "@/lib/clientAuditNotes";

interface StaffClientFinancialSectionProps {
  clientId: string;
  staffUserId: string;
  staffUserName?: string;
}

const creditReasons = [
  { value: "service_issue", label: "Problème de service" },
  { value: "billing_error", label: "Erreur de facturation" },
  { value: "customer_retention", label: "Rétention client" },
  { value: "goodwill", label: "Geste commercial" },
  { value: "promotion", label: "Promotion" },
  { value: "referral", label: "Parrainage" },
  { value: "other", label: "Autre" },
];

const feeReasons = [
  { value: "late_payment", label: "Frais de retard" },
  { value: "equipment_damage", label: "Dommage équipement" },
  { value: "early_termination", label: "Résiliation anticipée" },
  { value: "reconnection", label: "Frais de reconnexion" },
  { value: "installation", label: "Frais d'installation" },
  { value: "service_call", label: "Appel de service" },
  { value: "admin_fee", label: "Frais administratifs" },
  { value: "other", label: "Autre" },
];

export default function StaffClientFinancialSection({
  clientId,
  staffUserId,
  staffUserName,
}: StaffClientFinancialSectionProps) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<"credit" | "fee">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  // Fetch recent ledger entries
  const { data: recentEntries, isLoading, refetch } = useQuery({
    queryKey: ["staff-client-ledger", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Calculate balance
  const { data: balance } = useQuery({
    queryKey: ["staff-client-balance", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("entry_type, amount")
        .eq("client_id", clientId);

      if (error) throw error;

      let total = 0;
      data?.forEach((entry: any) => {
        if (entry.entry_type === "credit" || entry.entry_type === "payment") {
          total += Number(entry.amount) || 0;
        } else {
          total -= Number(entry.amount) || 0;
        }
      });

      return total;
    },
    enabled: !!clientId,
  });

  // Add adjustment mutation
  const addAdjustmentMutation = useMutation({
    mutationFn: async () => {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error("Montant invalide");
      }

      const reasonLabel =
        adjustmentType === "credit"
          ? creditReasons.find((r) => r.value === reason)?.label
          : feeReasons.find((r) => r.value === reason)?.label;

      // Get account_id
      const { data: account } = await supabase
        .from("accounts")
        .select("id")
        .eq("client_id", clientId)
        .maybeSingle();

      // Insert ledger entry - cast entry_type to the expected enum
      const { error } = await supabase.from("ledger_entries").insert({
        client_id: clientId,
        account_id: account?.id || null,
        entry_type: adjustmentType as any, // Cast to enum type
        amount: amountNum,
        description: `${reasonLabel}: ${description || "Ajustement manuel"}`,
        reference_type: "adjustment",
        payment_method: "adjustment",
        payment_status: "completed",
        created_by_id: staffUserId,
        created_by_name: staffUserName || "Personnel",
        created_by_role: "employee",
        metadata: {
          reason_code: reason,
          reason_label: reasonLabel,
          staff_notes: description,
        },
      } as any);

      if (error) throw error;

      // Create audit note
      await createAuditNote({
        clientId,
        eventType: adjustmentType === "credit" ? "payment_recorded" : "payment_recorded",
        message:
          adjustmentType === "credit"
            ? `Crédit ajouté: ${amountNum.toFixed(2)} $ - ${reasonLabel}${description ? ` (${description})` : ""}`
            : `Frais ajouté: ${amountNum.toFixed(2)} $ - ${reasonLabel}${description ? ` (${description})` : ""}`,
        metadata: {
          amount: amountNum,
          type: adjustmentType,
          reason_code: reason,
          reason_label: reasonLabel,
          description,
        },
        actorId: staffUserId,
        actorRole: "employee",
        actorName: staffUserName,
      });

      return { success: true };
    },
    onSuccess: () => {
      toast.success(
        adjustmentType === "credit" ? "Crédit ajouté avec succès" : "Frais ajouté avec succès"
      );
      queryClient.invalidateQueries({ queryKey: ["staff-client-ledger", clientId] });
      queryClient.invalidateQueries({ queryKey: ["staff-client-balance", clientId] });
      queryClient.invalidateQueries({ queryKey: ["staff-client-internal-notes", clientId] });
      closeDialog();
    },
    onError: (error: any) => {
      toast.error("Erreur: " + (error.message || "Impossible d'ajouter"));
    },
  });

  const closeDialog = () => {
    setShowAddDialog(false);
    setAdjustmentType("credit");
    setAmount("");
    setReason("");
    setDescription("");
  };

  const handleSubmit = () => {
    if (!amount || !reason) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    addAdjustmentMutation.mutate();
  };

  const getEntryTypeInfo = (type: string) => {
    switch (type) {
      case "credit":
        return { label: "Crédit", className: "bg-green-500/20 text-green-400", icon: TrendingUp };
      case "fee":
      case "charge":
        return { label: "Frais", className: "bg-red-500/20 text-red-400", icon: TrendingDown };
      case "payment":
        return { label: "Paiement", className: "bg-blue-500/20 text-blue-400", icon: CreditCard };
      case "invoice":
        return { label: "Facture", className: "bg-amber-500/20 text-amber-400", icon: Receipt };
      default:
        return { label: type, className: "bg-slate-500/20 text-slate-400", icon: DollarSign };
    }
  };

  return (
    <>
      <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-teal-400" />
              Ajustements financiers
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                className="text-slate-400 hover:text-white"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAdjustmentType("credit");
                  setShowAddDialog(true);
                }}
                className="border-green-500/50 text-green-400 hover:bg-green-500/10"
              >
                <Plus className="h-4 w-4 mr-1" />
                Crédit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAdjustmentType("fee");
                  setShowAddDialog(true);
                }}
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                <Minus className="h-4 w-4 mr-1" />
                Frais
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Balance Summary */}
          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Solde du compte</p>
                <p
                  className={`text-2xl font-bold ${
                    (balance || 0) >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {(balance || 0).toFixed(2)} $
                </p>
              </div>
              {(balance || 0) < 0 && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Solde négatif
                </Badge>
              )}
            </div>
          </div>

          {/* Recent Entries */}
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
            </div>
          ) : !recentEntries?.length ? (
            <div className="text-center py-6">
              <History className="h-10 w-10 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Aucune transaction récente</p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-400 mb-2">Transactions récentes</p>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {recentEntries.map((entry: any) => {
                    const info = getEntryTypeInfo(entry.entry_type);
                    const IconComponent = info.icon;

                    return (
                      <div
                        key={entry.id}
                        className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded bg-slate-700/50">
                            <IconComponent className="h-4 w-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm text-white">{entry.description}</p>
                            <p className="text-xs text-slate-500">
                              {format(new Date(entry.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                              {entry.created_by_name && ` • ${entry.created_by_name}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={info.className}>{info.label}</Badge>
                          <p
                            className={`text-sm font-medium mt-1 ${
                              entry.entry_type === "credit" || entry.entry_type === "payment"
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {entry.entry_type === "credit" || entry.entry_type === "payment"
                              ? "+"
                              : "-"}
                            {Number(entry.amount || 0).toFixed(2)} $
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Adjustment Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {adjustmentType === "credit" ? (
                <>
                  <Gift className="h-5 w-5 text-green-400" />
                  Ajouter un crédit
                </>
              ) : (
                <>
                  <Receipt className="h-5 w-5 text-red-400" />
                  Ajouter des frais
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {adjustmentType === "credit"
                ? "Le crédit sera ajouté au solde du client"
                : "Les frais seront débités du compte client"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Amount */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Montant ($) *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-slate-800/50 border-slate-600 text-white pl-9"
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Raison *</label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
                  <SelectValue placeholder="Sélectionner la raison" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {(adjustmentType === "credit" ? creditReasons : feeReasons).map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Description / Notes</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Détails additionnels..."
                className="bg-slate-800/50 border-slate-600 text-white resize-none"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} className="text-slate-400">
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!amount || !reason || addAdjustmentMutation.isPending}
              className={
                adjustmentType === "credit"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {addAdjustmentMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {adjustmentType === "credit" ? "Ajouter le crédit" : "Ajouter les frais"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
