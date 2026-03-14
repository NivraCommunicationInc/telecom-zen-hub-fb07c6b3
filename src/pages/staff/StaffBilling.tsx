/**
 * StaffBilling - Employee portal billing view
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, Search, Loader2, RefreshCw, Clock, 
  CheckCircle, AlertTriangle, User, Calendar, ArrowLeft, Eye
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";

export default function StaffBilling() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: billing, isLoading, refetch } = useQuery({
    queryKey: ["staff-billing", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("billing_invoices")
        .select("*, customer:billing_customers(email, first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      // Map canonical fields to legacy shape used by template
      return (data || []).map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        client_email: inv.customer?.email || "",
        related_order_number: inv.order_id || "",
        amount: inv.total,
        balance_due: inv.balance_due,
        status: inv.status,
        due_date: inv.due_date,
        created_at: inv.created_at,
      }));
    },
  });

  const filteredBilling = billing?.filter(bill => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      bill.invoice_number?.toLowerCase().includes(q) ||
      bill.client_email?.toLowerCase().includes(q) ||
      bill.related_order_number?.toLowerCase().includes(q)
    );
  });

  // PREPAID TERMINOLOGY - V2.5 Compliant (no debt language)
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      pending: { label: "En attente", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
      paid: { label: "Payé", className: "bg-green-500/20 text-green-400 border-green-500/30" },
      overdue: { label: "Renouvellement requis", className: "bg-red-500/20 text-red-400 border-red-500/30" },
      void: { label: "Annulé (non-renouvellement)", className: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
      expired: { label: "Expiré", className: "bg-red-600/20 text-red-400 border-red-600/30" },
      cancelled: { label: "Annulé", className: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
      partial: { label: "Paiement partiel", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    };
    return configs[status] || { label: status, className: "bg-slate-500/20 text-slate-400" };
  };

  return (
    <div className="min-h-screen relative">
      <StaffBackground />
      
      <div className="relative z-10 p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/staff/dashboard")}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 shadow-lg">
              <DollarSign className="h-6 w-6 text-slate-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Facturation</h1>
              <p className="text-slate-400">Gérer les factures et paiements</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par numéro de facture, email ou commande..."
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48 bg-slate-800/50 border-slate-700 text-white">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="paid">Payé</SelectItem>
                  <SelectItem value="overdue">Renouvellement requis</SelectItem>
                  <SelectItem value="partial">Paiement partiel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Billing List */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Factures ({filteredBilling?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
              </div>
            ) : !filteredBilling?.length ? (
              <p className="text-slate-400 text-center py-8">Aucune facture trouvée</p>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-3">
                  {filteredBilling.map((bill) => {
                    const status = getStatusConfig(bill.status);
                    const isOverdue = bill.due_date && new Date(bill.due_date) < new Date() && bill.status === "pending";
                    
                    return (
                      <Link
                        key={bill.id}
                        to={`/staff/billing/${bill.id}`}
                        className={`block p-4 rounded-lg border bg-slate-800/30 hover:bg-slate-800/50 transition-all group ${
                          isOverdue ? "border-red-500/50 hover:border-red-400/70" : "border-slate-700 hover:border-teal-500/50"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-semibold text-white group-hover:text-teal-400 transition-colors">
                                {bill.invoice_number || "Facture"}
                              </span>
                              <Badge className={isOverdue ? "bg-red-500/20 text-red-400" : status.className}>
                                {isOverdue ? "Renouvellement requis" : status.label}
                              </Badge>
                            </div>
                            {bill.related_order_number && (
                              <p className="text-sm text-slate-400">
                                Commande: {bill.related_order_number}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex items-start gap-3">
                            <div>
                              <p className="text-xl font-bold text-teal-400">
                                {bill.amount?.toFixed(2)} $
                              </p>
                              {bill.balance_due && bill.balance_due > 0 && (
                                <p className="text-sm text-amber-400">
                                  Solde: {bill.balance_due.toFixed(2)} $
                                </p>
                              )}
                            </div>
                            <Eye className="h-4 w-4 text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {bill.client_email || "Client"}
                          </span>
                          <div className="flex items-center gap-4">
                            {bill.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Éch: {format(new Date(bill.due_date), "d MMM yyyy", { locale: fr })}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(bill.created_at), "d MMM yyyy", { locale: fr })}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
