import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Copy, Clock, Wifi, Tv, Smartphone, Package, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type PendingActivation = {
  id: string;
  order_number: string;
  created_at: string;
  service_type: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  client_phone: string;
  client_full_address: string;
  total_amount: number;
  payment_status: string;
  amount_paid: number;
  payment_method: string;
  sim_number: string | null;
  serial_number: string | null;
  imei_number: string | null;
  equipment_details: any;
  installation_type: string | null;
  requested_activation_date: string | null;
  activation_preference: string | null;
  appointment_date: string | null;
  sla_deadline: string | null;
  dispatch_priority: string | null;
  subscription_id: string | null;
  plan_name: string | null;
  plan_price: number | null;
  plan_code: string | null;
  subscription_status: string | null;
  internal_notes: string | null;
};

function serviceIcon(type: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("tv")) return <Tv className="h-4 w-4" />;
  if (t.includes("mobile") || t.includes("sim")) return <Smartphone className="h-4 w-4" />;
  if (t.includes("internet") || t.includes("giga") || t.includes("wifi")) return <Wifi className="h-4 w-4" />;
  return <Package className="h-4 w-4" />;
}

function priorityColor(p: string | null) {
  if (p === "urgent") return "destructive";
  if (p === "high") return "secondary";
  return "outline";
}

export default function CoreActivationQueuePage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<PendingActivation | null>(null);
  const [wholesaleRef, setWholesaleRef] = useState("");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: queue = [], isLoading, refetch } = useQuery({
    queryKey: ["activation-queue"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_pending_activations")
        .select("*");
      if (error) throw error;
      return data as PendingActivation[];
    },
    refetchInterval: 30_000,
  });

  function copyForWholesale(item: PendingActivation) {
    const lines = [
      `=== ACTIVATION NIVRA — ${item.order_number} ===`,
      `Nom: ${item.client_first_name} ${item.client_last_name}`,
      `Email: ${item.client_email}`,
      `Téléphone: ${item.client_phone || "—"}`,
      `Adresse: ${item.client_full_address || "—"}`,
      `Service: ${item.service_type}`,
      `Plan: ${item.plan_name || "—"}`,
      item.sim_number ? `SIM: ${item.sim_number}` : null,
      item.serial_number ? `Serial: ${item.serial_number}` : null,
      item.imei_number ? `IMEI: ${item.imei_number}` : null,
      item.installation_type ? `Installation: ${item.installation_type}` : null,
      item.requested_activation_date
        ? `Date demandée: ${format(new Date(item.requested_activation_date), "PPP", { locale: fr })}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(lines);
    toast.success("Informations copiées dans le presse-papiers");
  }

  async function handleConfirm() {
    if (!selected) return;
    setConfirming(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any).rpc("confirm_manual_activation", {
        p_order_id: selected.id,
        p_admin_id: user?.id,
        p_wholesale_ref: wholesaleRef.trim() || null,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      if (data?.reason === "already_activated") {
        toast.info("Ce service était déjà activé.");
      } else {
        toast.success(`Service activé — email envoyé à ${selected.client_email}`);
      }
      setSelected(null);
      setWholesaleRef("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["activation-queue"] });
    } catch (err: any) {
      toast.error(`Erreur: ${err.message}`);
    } finally {
      setConfirming(false);
    }
  }

  const urgent = queue.filter((q) => q.dispatch_priority === "urgent");
  const normal = queue.filter((q) => q.dispatch_priority !== "urgent");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">File d'activation</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Commandes prêtes à activer sur le portail réseau
          </p>
        </div>
        <div className="flex items-center gap-3">
          {queue.length > 0 && (
            <Badge variant="destructive" className="text-base px-3 py-1">
              {queue.length} en attente
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-16 text-muted-foreground">Chargement…</div>
      )}

      {!isLoading && queue.length === 0 && (
        <div className="text-center py-16 rounded-xl border border-dashed">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
          <p className="font-medium text-lg">Aucune activation en attente</p>
          <p className="text-muted-foreground text-sm">Toutes les commandes sont activées.</p>
        </div>
      )}

      {urgent.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" />
            URGENT ({urgent.length})
          </div>
          {urgent.map((item) => <ActivationCard key={item.id} item={item} expanded={expanded} setExpanded={setExpanded} onCopy={copyForWholesale} onActivate={setSelected} />)}
        </div>
      )}

      {normal.length > 0 && (
        <div className="space-y-2">
          {urgent.length > 0 && <div className="text-sm font-semibold text-muted-foreground">FILE NORMALE ({normal.length})</div>}
          {normal.map((item) => <ActivationCard key={item.id} item={item} expanded={expanded} setExpanded={setExpanded} onCopy={copyForWholesale} onActivate={setSelected} />)}
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer l'activation</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <div className="font-medium">{selected.client_first_name} {selected.client_last_name}</div>
                <div className="text-muted-foreground">{selected.client_email}</div>
                <div className="text-muted-foreground">{selected.service_type} — {selected.plan_name}</div>
              </div>
              <div className="space-y-2">
                <Label>Numéro de confirmation grossiste (optionnel)</Label>
                <Input
                  placeholder="ex: BELL-2026-123456"
                  value={wholesaleRef}
                  onChange={(e) => setWholesaleRef(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes internes (optionnel)</Label>
                <Textarea
                  placeholder="ex: Délai 24h, modem livré, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                En confirmant : statut → Activé, email de bienvenue envoyé au client, log enregistré.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Annuler</Button>
            <Button onClick={handleConfirm} disabled={confirming}>
              {confirming ? "Activation…" : "✅ Confirmer l'activation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActivationCard({
  item,
  expanded,
  setExpanded,
  onCopy,
  onActivate,
}: {
  item: PendingActivation;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  onCopy: (item: PendingActivation) => void;
  onActivate: (item: PendingActivation) => void;
}) {
  const isOpen = expanded === item.id;
  const age = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 3_600_000);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="flex-shrink-0 rounded-full bg-muted p-2">
          {serviceIcon(item.service_type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{item.client_first_name} {item.client_last_name}</span>
            <Badge variant={priorityColor(item.dispatch_priority)} className="text-xs">
              {item.dispatch_priority || "normal"}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {age < 1 ? "< 1h" : `${age}h`}
            </span>
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {item.service_type} — {item.plan_name || "—"} — {item.order_number}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={() => onCopy(item)}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copier
          </Button>
          <Button size="sm" onClick={() => onActivate(item)}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Activer
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setExpanded(isOpen ? null : item.id)}>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t bg-muted/30 p-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <InfoRow label="Email" value={item.client_email} />
          <InfoRow label="Téléphone" value={item.client_phone} />
          <InfoRow label="Adresse" value={item.client_full_address} />
          <InfoRow label="Plan" value={item.plan_name} />
          <InfoRow label="Prix" value={item.plan_price ? `$${item.plan_price}/mois` : null} />
          <InfoRow label="Paiement" value={item.payment_method} />
          {item.sim_number && <InfoRow label="SIM" value={item.sim_number} />}
          {item.serial_number && <InfoRow label="Serial" value={item.serial_number} />}
          {item.imei_number && <InfoRow label="IMEI" value={item.imei_number} />}
          {item.installation_type && <InfoRow label="Installation" value={item.installation_type} />}
          {item.requested_activation_date && (
            <InfoRow label="Date demandée" value={format(new Date(item.requested_activation_date), "PPP", { locale: fr })} />
          )}
          {item.appointment_date && (
            <InfoRow label="RDV" value={format(new Date(item.appointment_date), "PPP HH:mm", { locale: fr })} />
          )}
          {item.activation_preference && <InfoRow label="Préférence" value={item.activation_preference} />}
          {item.internal_notes && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Notes: </span>
              <span className="whitespace-pre-wrap">{item.internal_notes}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
