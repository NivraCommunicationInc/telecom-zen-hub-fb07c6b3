/**
 * ClientPhoneOrders — Client-facing list of phone purchases.
 * Allows requesting a return when status='delivered' AND within 15 days.
 *
 * Requires the user to be authenticated (uses supabase.auth.user).
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
import { Smartphone, RefreshCw } from "lucide-react";

import { enqueueCommunication } from "@/lib/enqueueCommunication";
interface Row {
  id: string;
  status: string;
  delivered_at: string | null;
  return_reason: string | null;
  return_requested_at: string | null;
  phone_inventory: {
    brand: string;
    model: string;
    storage: string;
    color: string;
    imei: string;
  } | null;
  orders: {
    order_number: string | null;
    total_amount: number | null;
    client_email: string | null;
  } | null;
}

const RETURN_REASONS = [
  { value: "defective", label: "Défectueux" },
  { value: "not_as_described", label: "Ne correspond pas à la description" },
  { value: "changed_mind", label: "Changement d'avis" },
  { value: "other", label: "Autre" },
];

export default function ClientPhoneOrders() {
  const { user } = useClientAuth();
  const qc = useQueryClient();
  const [target, setTarget] = useState<Row | null>(null);
  const [reason, setReason] = useState("defective");
  const [details, setDetails] = useState("");
  const [confirm, setConfirm] = useState(false);

  const { data: canonical, isLoading } = useCanonicalClientData(user?.id);
  const ordersById = new Map<string, any>(((canonical?.orders || []) as any[]).map((o) => [o.id, o]));
  const data: Row[] = ((canonical?.phoneOrders || []) as any[])
    .slice()
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .map((row) => ({
      id: row.id,
      status: row.status,
      delivered_at: row.delivered_at,
      return_reason: row.return_reason,
      return_requested_at: row.return_requested_at,
      phone_inventory: row.phone_inventory ?? null,
      orders: row.order_id
        ? (() => {
            const o = ordersById.get(row.order_id);
            return o
              ? {
                  order_number: o.order_number ?? null,
                  total_amount: o.total_amount ?? null,
                  client_email: o.client_email ?? null,
                }
              : null;
          })()
        : null,
    }));

  function canReturn(row: Row) {
    if (row.status !== "delivered" || !row.delivered_at) return false;
    const days = (Date.now() - new Date(row.delivered_at).getTime()) / 86_400_000;
    return days <= 15;
  }

  async function submitReturn() {
    if (!target) return;
    if (!confirm) {
      toast.error("Veuillez confirmer l'état de l'appareil");
      return;
    }
    try {
      const { error } = await supabase
        .from("phone_orders")
        .update({
          status: "return_requested",
          return_requested_at: new Date().toISOString(),
          return_reason: `${reason}${details ? ` — ${details}` : ""}`,
        })
        .eq("id", target.id);
      if (error) throw error;

      // Best-effort acknowledgement email
      if (target.orders?.client_email) {
        await supabaseenqueueCommunication({
          channel: "email",
          templateKey: "phone_return_requested_ack",
          recipient: target.orders.client_email,
          idempotencyKey: `phone-return-requested-${target.id}`,
          templateVars: {
            order_number: target.orders.order_number ?? "",
            brand: target.phone_inventory?.brand ?? "",
            model: target.phone_inventory?.model ?? "",
          },
          subject: "Demande de retour reçue",
        });
      }

      toast.success("Demande de retour envoyée");
      setTarget(null);
      setConfirm(false);
      setDetails("");
      qc.invalidateQueries({ queryKey: ["canonical-client-data", user?.id] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error(msg);
    }
  }

  return (
    <ClientLayout>
      <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Smartphone className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Mes téléphones</h1>
            <p className="text-sm text-muted-foreground">Suivez vos achats d'appareils et demandez un retour si nécessaire.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : (data ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">Aucun achat de téléphone.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {(data ?? []).map((row) => (
              <Card key={row.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {row.phone_inventory?.brand} {row.phone_inventory?.model}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground mt-1">
                      {row.phone_inventory?.storage} · {row.phone_inventory?.color} ·{" "}
                      Commande #{row.orders?.order_number ?? row.id.slice(0, 8)}
                    </div>
                  </div>
                  <Badge variant="secondary">{row.status}</Badge>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="text-sm">
                    {(row.orders?.total_amount ?? 0).toFixed(2)} $
                  </div>
                  {canReturn(row) && (
                    <Button size="sm" variant="outline" onClick={() => setTarget(row)}>
                      <RefreshCw className="h-4 w-4 mr-2" /> Retourner
                    </Button>
                  )}
                  {row.status === "return_requested" && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                      Retour en cours
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Demande de retour</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Raison</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Détails</Label>
              <Textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} />
            </div>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} />
              <span>Je confirme que l'appareil est dans le même état qu'à la réception avec toutes ses pièces.</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Annuler</Button>
            <Button onClick={submitReturn}>Envoyer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ClientLayout>
  );
}
