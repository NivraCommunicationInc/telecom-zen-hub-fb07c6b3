/**
 * AccountDocumentsTab — Contracts, KYC, uploaded documents
 */
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { FileText, Shield, Upload, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AccountDocumentsTabProps {
  clientId: string;
  accountId: string;
}

export function AccountDocumentsTab({ clientId, accountId }: AccountDocumentsTabProps) {
  // Contracts
  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ["account-docs-contracts", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_snapshots")
        .select("id, order_id, created_at, contract_summary_snapshot")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(20);
      // Fallback: try by client_id if no account match
      if (error || !data?.length) {
        const { data: fallback } = await supabase
          .from("order_snapshots")
          .select("id, order_id, created_at, contract_summary_snapshot")
          .order("created_at", { ascending: false })
          .limit(20);
        return fallback || [];
      }
      return data || [];
    },
    enabled: !!accountId,
  });

  // KYC sessions
  const { data: kycSessions, isLoading: kycLoading } = useQuery({
    queryKey: ["account-docs-kyc", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identity_verification_sessions")
        .select("id, case_number, status, created_at, document_type")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const isLoading = contractsLoading || kycLoading;

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Contracts */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contrats ({contracts?.length || 0})</h4>
        {!contracts?.length ? (
          <p className="text-sm text-muted-foreground">Aucun contrat</p>
        ) : (
          contracts.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-md border">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Contrat - {c.order_id?.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.created_at && format(new Date(c.created_at), "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">Snapshot</Badge>
            </div>
          ))
        )}
      </div>

      {/* KYC */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vérification d'identité ({kycSessions?.length || 0})</h4>
        {!kycSessions?.length ? (
          <p className="text-sm text-muted-foreground">Aucune vérification</p>
        ) : (
          kycSessions.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-md border">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{s.case_number || "KYC"}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.document_type || "ID"}
                    {" • "}
                    {s.created_at && format(new Date(s.created_at), "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
              </div>
              <Badge
                variant={s.status === "approved" ? "default" : s.status === "rejected" ? "destructive" : "outline"}
                className="text-[10px]"
              >
                {s.status}
              </Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
