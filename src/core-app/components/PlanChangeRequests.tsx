/**
 * PlanChangeRequests — Core admin panel for client plan-change requests.
 * Lists pending requests for a client and lets admins approve/reject.
 * On approve: updates billing_subscriptions, marks request approved,
 * enqueues the bilingual confirmation email.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, ArrowRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PlanChangeRequestsProps {
  clientId: string;
  accountId?: string;
}

type Row = {
  id: string;
  account_id: string;
  client_id: string;
  subscription_id: string | null;
  current_plan_name: string | null;
  requested_plan_id: string | null;
  requested_plan_name: string;
  change_type: string;
  status: string;
  created_at: string;
};

export default function PlanChangeRequests({ clientId, accountId }: PlanChangeRequestsProps) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["plan-change-requests", clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("service_change_requests")
        .select("id, account_id, client_id, subscription_id, current_plan_name, requested_plan_id, requested_plan_name, change_type, status, created_at")
        .eq("client_id", clientId)
        .in("status", ["pending", "approved", "rejected"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Row[]) || [];
    },
  });

  const handleApprove = async (req: Row) => {
    setBusyId(req.id);
    try {
      // Resolve new plan price
      let newPrice: number | null = null;
      if (req.requested_plan_id) {
        const { data: svc } = await supabase
          .from("services")
          .select("price")
          .eq("id", req.requested_plan_id)
          .maybeSingle();
        newPrice = (svc?.price as number) ?? null;
      }

      // Update subscription
      if (req.subscription_id) {
        const update: any = { plan_name: req.requested_plan_name };
        if (newPrice !== null) update.plan_price = newPrice;
        const { error: subErr } = await supabase
          .from("billing_subscriptions")
          .update(update)
          .eq("id", req.subscription_id);
        if (subErr) throw subErr;
      }

      // Mark request approved
      const { error: updErr } = await supabase
        .from("service_change_requests")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", req.id);
      if (updErr) throw updErr;

      // Fetch client email + next renewal for email
      const { data: client } = await supabase
        .from("profiles")
        .select("email, first_name")
        .eq("user_id", req.client_id)
        .maybeSingle();

      let effectiveDate = "votre prochain renouvellement";
      if (req.subscription_id) {
        const { data: sub } = await supabase
          .from("billing_subscriptions")
          .select("next_renewal_at")
          .eq("id", req.subscription_id)
          .maybeSingle();
        if (sub?.next_renewal_at) {
          effectiveDate = format(new Date(sub.next_renewal_at), "d MMMM yyyy", { locale: fr });
        }
      }

      if (client?.email) {
        await supabase.from("email_queue").insert({
          to_email: client.email,
          template_key: "plan_change_approved",
          event_key: "plan_change_approved",
          message_type: "transactional",
          template_vars: {
            client_name: client.first_name || client.email,
            current_plan_name: req.current_plan_name || "—",
            requested_plan_name: req.requested_plan_name,
            effective_date: effectiveDate,
          },
        });
      }

      toast.success("Changement de forfait approuvé");
      qc.invalidateQueries({ queryKey: ["plan-change-requests", clientId] });
    } catch (e: any) {
      console.error("[PlanChangeRequests.approve]", e);
      toast.error(e?.message || "Erreur lors de l'approbation");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (req: Row) => {
    setBusyId(req.id);
    try {
      const { error } = await supabase
        .from("service_change_requests")
        .update({ status: "rejected", approved_at: new Date().toISOString() })
        .eq("id", req.id);
      if (error) throw error;
      toast.success("Demande rejetée");
      qc.invalidateQueries({ queryKey: ["plan-change-requests", clientId] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!requests || requests.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demandes de changement de forfait</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((r) => (
          <div
            key={r.id}
            className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 border border-border rounded-lg"
          >
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{r.current_plan_name || "—"}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{r.requested_plan_name}</span>
                <Badge
                  variant={
                    r.status === "pending"
                      ? "secondary"
                      : r.status === "approved"
                        ? "default"
                        : "destructive"
                  }
                >
                  {r.status}
                </Badge>
                <Badge variant="outline">{r.change_type}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: fr })}
              </div>
            </div>
            {r.status === "pending" && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleApprove(r)}
                  disabled={busyId === r.id}
                  className="flex items-center gap-1"
                >
                  {busyId === r.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Approuver
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReject(r)}
                  disabled={busyId === r.id}
                  className="flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Rejeter
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
