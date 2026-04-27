/**
 * EmployeeKYC — Phase 2: KYC verification queue.
 * KYC data query stays employee-specific (not in shared-ops — domain-specific).
 * Note action uses addOperationalNote from shared-ops for audit consistency.
 * Approve/reject writes to order_identity_data with proper audit logging.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Loader2, CheckCircle, XCircle, AlertTriangle, FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { useNavigate } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { ActionConfirmButton } from "@/employee-app/components/ActionConfirmDialog";
import { useState } from "react";
import { addOperationalNote } from "@/shared-ops";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type KYCFilter = "pending" | "approved" | "rejected" | "all";

const ADDITIONAL_DOC_OPTIONS = [
  "Permis de conduire",
  "Passeport",
  "Carte d'identité",
  "Autre",
];

interface KYCItem {
  id: string;
  order_id: string | null;
  verification_status: string | null;
  risk_level: string | null;
  created_at: string;
  verified_by: string | null;
  verified_at: string | null;
  orderNumber?: string | null;
  clientName?: string | null;
}

export default function EmployeeKYC() {
  usePortalRealtime(["kyc_verifications", "kyc_requests"], [["employee-kyc"]]);
  const [filter, setFilter] = useState<KYCFilter>("pending");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["employee-kyc-v2", filter],
    queryFn: async () => {
      let query = supabase
        .from("order_identity_data")
        .select("id, order_id, verification_status, risk_level, created_at, verified_by, verified_at")
        .order("created_at", { ascending: true })
        .limit(50);

      if (filter !== "all") {
        query = query.eq("verification_status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) return [];

      const orderIds = [...new Set(data.map(d => d.order_id).filter(Boolean))] as string[];
      const { data: orders } = orderIds.length
        ? await supabase.from("orders").select("id, order_number, user_id").in("id", orderIds)
        : { data: [] };

      const orderMap = new Map((orders ?? []).map(o => [o.id, o]));
      const userIds = [...new Set((orders ?? []).map(o => o.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

      return data.map(item => {
        const order = item.order_id ? orderMap.get(item.order_id) : null;
        const profile = order?.user_id ? profileMap.get(order.user_id) : null;
        return {
          ...item,
          orderNumber: order?.order_number ?? null,
          clientName: profile?.full_name ?? null,
        } as KYCItem;
      });
    },
    staleTime: 1000 * 60 * 2,
  });

  const kycMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approved" | "rejected" }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Non authentifié");

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", session.user.id).maybeSingle();
      const verifierName = profile?.full_name ?? session.user.email ?? "Employé";

      const { error } = await supabase
        .from("order_identity_data")
        .update({
          verification_status: action,
          verified_by: verifierName,
          verified_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;

      // Use shared addOperationalNote for consistent audit trail
      const item = items.find(i => i.id === id);
      if (item?.order_id) {
        await addOperationalNote({
          entityId: item.order_id,
          entityType: "order",
          note: action === "approved" ? "KYC approuvé" : "KYC rejeté",
          portal: "employee",
        });
      }

      await logInternalAudit({
        action: action === "approved" ? "kyc_approve" : "kyc_reject",
        category: "security",
        portal: "employee",
        targetType: "kyc",
        targetId: id,
      });
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["employee-kyc-v2"] });
      toast.success(action === "approved" ? "KYC approuvé" : "KYC rejeté");
    },
    onError: (err: any) => toast.error(`Erreur: ${err.message}`),
  });

  // ── Additional documents request dialog state ──────────────────────────
  const [askDocsFor, setAskDocsFor] = useState<KYCItem | null>(null);
  const [docType, setDocType] = useState<string>(ADDITIONAL_DOC_OPTIONS[0]);
  const [docNote, setDocNote] = useState("");

  const askDocsMutation = useMutation({
    mutationFn: async () => {
      if (!askDocsFor) throw new Error("Aucun dossier sélectionné");
      const { data, error } = await supabase.functions.invoke("kyc-additional-docs-request", {
        body: {
          identity_record_id: askDocsFor.id,
          document_requested: docType,
          note: docNote.trim(),
        },
      });
      if (error) throw new Error(error.message ?? "Erreur lors de la demande");
      if ((data as any)?.error) throw new Error((data as any).error);
      await logInternalAudit({
        action: "kyc_additional_docs_requested",
        category: "security",
        portal: "employee",
        targetType: "kyc",
        targetId: askDocsFor.id,
        details: { document_requested: docType, note: docNote || null },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-kyc-v2"] });
      toast.success("Demande envoyée au client");
      setAskDocsFor(null);
      setDocNote("");
      setDocType(ADDITIONAL_DOC_OPTIONS[0]);
    },
    onError: (err: any) => toast.error(`Erreur: ${err.message}`),
  });

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: "text-amber-400 bg-amber-500/10",
      approved: "text-emerald-400 bg-emerald-500/10",
      rejected: "text-red-400 bg-red-500/10",
    };
    return map[s] ?? "text-muted-foreground bg-secondary";
  };

  const riskColor = (r: string) => {
    const map: Record<string, string> = {
      low: "text-emerald-400",
      medium: "text-amber-400",
      high: "text-red-400",
    };
    return map[r] ?? "text-muted-foreground";
  };

  const FILTERS: { key: KYCFilter; label: string }[] = [
    { key: "pending", label: "En attente" },
    { key: "approved", label: "Approuvés" },
    { key: "rejected", label: "Rejetés" },
    { key: "all", label: "Tous" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">KYC / Vérification</h1>
        <p className="text-sm text-muted-foreground">
          {items.length} vérification{items.length !== 1 ? "s" : ""}
          {filter !== "all" && ` · ${FILTERS.find(f => f.key === filter)?.label}`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              filter === f.key
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucune vérification dans cette catégorie.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Commande</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Risque</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Soumis</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Vérifié par</th>
                  {filter === "pending" && (
                    <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      {item.order_id ? (
                        <button
                          onClick={() => navigate(employeePath(`/orders/${item.orderNumber ?? item.order_id}`))}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {item.orderNumber ?? item.order_id!.slice(0, 8)}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.clientName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", statusColor(item.verification_status ?? ""))}>
                        {item.verification_status === "pending" ? "En attente" :
                         item.verification_status === "approved" ? "Approuvé" :
                         item.verification_status === "rejected" ? "Rejeté" :
                         item.verification_status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.risk_level ? (
                        <div className="flex items-center gap-1">
                          {item.risk_level === "high" && <AlertTriangle className="h-3 w-3 text-red-400" />}
                          <span className={cn("text-xs font-medium", riskColor(item.risk_level))}>
                            {item.risk_level === "low" ? "Faible" : item.risk_level === "medium" ? "Moyen" : item.risk_level === "high" ? "Élevé" : item.risk_level}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {format(new Date(item.created_at), "d MMM yyyy", { locale: fr })}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.verified_by ?? "—"}</td>
                    {filter === "pending" && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <ActionConfirmButton
                            label="Approuver"
                            consequence="Approuver cette vérification d'identité — le client sera marqué comme vérifié"
                            onConfirm={() => kycMutation.mutate({ id: item.id, action: "approved" })}
                            isPending={kycMutation.isPending}
                            variant="primary"
                          />
                          <ActionConfirmButton
                            label="Rejeter"
                            consequence="Rejeter cette vérification — le client devra soumettre de nouveaux documents"
                            onConfirm={() => kycMutation.mutate({ id: item.id, action: "rejected" })}
                            isPending={kycMutation.isPending}
                            variant="warning"
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
