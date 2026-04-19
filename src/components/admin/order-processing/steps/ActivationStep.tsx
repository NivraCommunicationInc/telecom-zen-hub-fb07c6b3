/**
 * ActivationStep — Step 7: Activation / Provisioning (Admin variant)
 * Calls canonical provision_services_for_order RPC, creates subscription,
 * updates account billing cycle, and marks order as activated.
 *
 * Also exposes an Equipment Replacement panel that calls
 * proc.replaceEquipment({ old_serial_number, reason, new_equipment_id }).
 *
 * GATED: Uses safe state machine transitions via hook.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, RefreshCw, CheckCircle2, AlertTriangle, Replace, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props { proc: any; }

const TERMINAL_STATES = ["active", "activated", "completed"];

const REPLACEMENT_REASONS = [
  "Défectueux",
  "Mise à niveau",
  "Perte ou vol",
  "Upgrade client",
  "Autre",
] as const;

interface InventoryHit {
  id: string;
  serial_number: string | null;
  sku: string | null;
  catalog_name: string | null;
  status: string | null;
}

export function ActivationStep({ proc }: Props) {
  const { order, account, invoice } = proc;
  const serviceType = (order.service_type || "").toLowerCase();
  const [providerRef, setProviderRef] = useState("");
  const [activationNotes, setActivationNotes] = useState("");
  const [isActivating, setIsActivating] = useState(false);

  // ── Equipment replacement state ──
  const orderId: string | undefined = order?.id;
  const assignedSerial: string = order?.serial_number || "";
  const [oldSerial, setOldSerial] = useState<string>(assignedSerial);
  const [replaceReason, setReplaceReason] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedTerm, setDebouncedTerm] = useState<string>("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<InventoryHit[]>([]);
  const [selectedNew, setSelectedNew] = useState<InventoryHit | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);

  // Sync local "old serial" with order if it changes
  useEffect(() => {
    if (assignedSerial && !oldSerial) setOldSerial(assignedSerial);
  }, [assignedSerial, oldSerial]);

  // Debounce search input (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Query equipment_inventory when debounced term has 2+ chars
  useEffect(() => {
    let cancelled = false;
    const term = debouncedTerm;
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    (async () => {
      const like = `%${term}%`;
      const { data, error } = await supabase
        .from("equipment_inventory")
        .select("id, serial_number, sku, catalog_name, status")
        .eq("status", "in_stock")
        .or(
          `serial_number.ilike.${like},sku.ilike.${like},catalog_name.ilike.${like}`
        )
        .limit(8);
      if (cancelled) return;
      if (error) {
        console.error("[ActivationStep] equipment search failed:", error.message);
        setResults([]);
      } else {
        setResults((data || []) as InventoryHit[]);
      }
      setSearching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedTerm]);

  const canReplace = useMemo(
    () => !!oldSerial.trim() && !!replaceReason && !isReplacing,
    [oldSerial, replaceReason, isReplacing]
  );

  const handleReplace = async () => {
    if (!proc.replaceEquipment) {
      toast.error("Action de remplacement indisponible");
      return;
    }
    setIsReplacing(true);
    try {
      await proc.replaceEquipment({
        old_serial_number: oldSerial.trim(),
        reason: replaceReason,
        new_equipment_id: selectedNew?.id || undefined,
      });
      // Reset selection on success; keep the (now updated) old serial visible
      setSelectedNew(null);
      setSearchTerm("");
      setResults([]);
      setReplaceReason("");
    } catch {
      // toast handled in hook
    } finally {
      setIsReplacing(false);
    }
  };

  const currentStatus = order.status || "";
  const isActivated = TERMINAL_STATES.includes(currentStatus);
  const invoicePaid = ["paid", "partially_paid", "paid_by_promo"].includes(invoice?.status || "");
  const canActivate = invoicePaid && !isActivated;

  const handleActivate = async () => {
    if (!proc.activateService) {
      toast.error("Méthode d'activation non disponible");
      return;
    }
    setIsActivating(true);
    try {
      await proc.activateService({
        providerRef: providerRef || undefined,
        activationNotes: activationNotes || undefined,
      });
    } catch (err: any) {
      console.error("[ActivationStep] Activation failed:", err);
      toast.error(err?.message || "Erreur lors de l'activation");
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div>
      <h3 className="text-base font-bold text-foreground mb-4">Activation / Provisionnement</h3>

      {isActivated && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Service activé — abonnement créé
          </p>
        </div>
      )}

      {!invoicePaid && !isActivated && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-amber-800 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" /> La facture doit être payée avant l'activation du service.
          </p>
        </div>
      )}

      {!isActivated && invoicePaid && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-blue-800 font-medium">État actuel: <span className="font-bold">{currentStatus}</span></p>
          <p className="text-xs text-blue-700 mt-0.5">
            L'activation transitera automatiquement par les états opérationnels requis.
          </p>
        </div>
      )}

      <div className="bg-muted/50 rounded-lg border border-border p-4 mb-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Détails du service</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Type:</span> <span className="font-medium text-foreground">{order.service_type}</span></div>
          <div><span className="text-muted-foreground">Statut:</span> <span className="font-medium text-foreground">{order.status}</span></div>
          <div><span className="text-muted-foreground">Compte:</span> <span className="font-mono text-foreground">{account?.account_number || "—"}</span></div>
          <div><span className="text-muted-foreground">Cycle:</span> <span className="text-foreground">{account?.billing_cycle_day ? `${account.billing_cycle_day} du mois` : "À définir"}</span></div>
          {serviceType.includes("mobile") && (
            <>
              <div><span className="text-muted-foreground">SIM:</span> <span className="font-mono text-foreground">{order.sim_number || "—"}</span></div>
              <div><span className="text-muted-foreground">IMEI:</span> <span className="font-mono text-foreground">{order.imei_number || "—"}</span></div>
            </>
          )}
          {(serviceType.includes("internet") || serviceType.includes("tv")) && (
            <>
              <div><span className="text-muted-foreground">Équipement:</span> <span className="text-foreground">{order.serial_number || "—"}</span></div>
              <div><span className="text-muted-foreground">Installation:</span> <span className="text-foreground">{order.installation_type || "—"}</span></div>
            </>
          )}
          {order.confirmation_number && (
            <div><span className="text-muted-foreground">Réf. fournisseur:</span> <span className="font-mono text-foreground">{order.confirmation_number}</span></div>
          )}
          {invoice && (
            <div><span className="text-muted-foreground">Facture:</span> <span className="font-mono text-foreground">{invoice.invoice_number} ({invoice.status})</span></div>
          )}
        </div>
      </div>

      {!isActivated && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-xs text-muted-foreground">Référence fournisseur</Label>
              <Input value={providerRef} onChange={(e) => setProviderRef(e.target.value)} placeholder="Numéro de confirmation…" className="h-9 text-sm font-mono" />
            </div>
          </div>
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground">Notes d'activation</Label>
            <Textarea value={activationNotes} onChange={(e) => setActivationNotes(e.target.value)} placeholder="Notes techniques…" className="min-h-[60px] text-sm" />
          </div>
        </>
      )}

      {canActivate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-blue-800 font-medium mb-1">L'activation va :</p>
          <ul className="text-xs text-blue-700 list-disc ml-4 space-y-0.5">
            <li>Créer l'abonnement récurrent lié au compte</li>
            <li>Provisionner les services (Internet, TV, Mobile…)</li>
            <li>Ancrer le cycle de facturation à aujourd'hui</li>
            <li>Générer la prochaine date de facture</li>
            <li>Marquer la commande comme activée</li>
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
        <Button
          size="sm"
          onClick={handleActivate}
          disabled={isActivating || proc.isUpdating || !canActivate}
          className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Zap className="w-3 h-3 mr-1" />
          {isActivating ? "Activation en cours…" : "Activer le service"}
        </Button>
        {!isActivated && (
          <Button size="sm" variant="outline" onClick={() => proc.changeStatus("provisioning", "Réessai")} disabled={proc.isUpdating} className="text-xs h-8">
            <RefreshCw className="w-3 h-3 mr-1" /> Réessayer
          </Button>
        )}
      </div>
    </div>
  );
}
