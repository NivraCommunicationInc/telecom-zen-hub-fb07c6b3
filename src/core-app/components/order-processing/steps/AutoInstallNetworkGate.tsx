/**
 * AutoInstallNetworkGate — Phase 3
 *
 * For self-install (auto-installation) orders, the Core agent MUST confirm
 * that the network is available, the wiring is functional and the ordered
 * services are actually offered at the client address BEFORE the shipping
 * panel is unlocked.
 *
 * Persistence: writes an `order_internal_notes` row tagged with a stable
 * marker prefix `[NETWORK_CONFIRMED]` so we can detect prior confirmation
 * without a schema migration.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, ShieldCheck, Loader2, Cable } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const NETWORK_MARKER = "[NETWORK_CONFIRMED]";

interface Props {
  orderId: string;
  serviceAddress?: string | null;
  onConfirmed?: () => void;
}

export function AutoInstallNetworkGate({ orderId, serviceAddress, onConfirmed }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [networkOk, setNetworkOk] = useState(false);
  const [wiringOk, setWiringOk] = useState(false);
  const [serviceOk, setServiceOk] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: confirmationNote, isLoading } = useQuery({
    queryKey: ["auto-install-network-gate", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_internal_notes")
        .select("id, content, created_at, author_id")
        .eq("order_id", orderId)
        .like("content", `${NETWORK_MARKER}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const allChecked = networkOk && wiringOk && serviceOk;

  const confirmedAt = useMemo(() => {
    if (!confirmationNote?.created_at) return null;
    try { return new Date(confirmationNote.created_at).toLocaleString("fr-CA"); } catch { return null; }
  }, [confirmationNote]);

  async function handleConfirm() {
    if (!allChecked) {
      toast.error("Coche les 3 confirmations avant de continuer.");
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const authorId = auth.user?.id ?? null;

      const body = [
        NETWORK_MARKER,
        `Confirmation auto-installation à l'adresse: ${serviceAddress || "—"}.`,
        "✓ Réseau disponible",
        "✓ Fils (câblage) fonctionnels",
        "✓ Service offert à cette adresse",
        notes.trim() ? `\nNote agent: ${notes.trim()}` : "",
      ].join("\n");

      const { error } = await supabase.from("order_internal_notes").insert({
        order_id: orderId,
        author_id: authorId,
        content: body,
        is_pinned: true,
      } as any);
      if (error) throw error;
      toast.success("Réseau confirmé — expédition débloquée.");
      qc.invalidateQueries({ queryKey: ["auto-install-network-gate", orderId] });
      onConfirmed?.();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la confirmation.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return null;

  if (confirmationNote) {
    return (
      <div className="bg-emerald-950/40 border border-emerald-700/50 rounded-xl p-4 mb-4">
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-300 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-200">
              Réseau, câblage et service confirmés à l'adresse
            </p>
            <p className="text-[11px] text-emerald-300/80 mt-0.5">
              Confirmé le {confirmedAt} — l'expédition est débloquée.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-950/40 border border-amber-700/50 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-2 mb-3">
        <Cable className="w-5 h-5 text-amber-300 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-200">
            Auto-installation — Confirmation obligatoire avant expédition
          </p>
          <p className="text-[11px] text-amber-300/80 mt-0.5">
            Avant d'expédier l'équipement, confirme que tout est prêt à l'adresse
            <span className="font-mono"> {serviceAddress || "—"}</span>.
          </p>
        </div>
      </div>

      <div className="space-y-2 pl-1">
        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox checked={networkOk} onCheckedChange={(v) => setNetworkOk(!!v)} className="mt-0.5" />
          <span className="text-sm text-slate-100">
            Le <b>réseau</b> Nivra est bien disponible à cette adresse
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox checked={wiringOk} onCheckedChange={(v) => setWiringOk(!!v)} className="mt-0.5" />
          <span className="text-sm text-slate-100">
            Les <b>fils / câblage</b> sont présents et fonctionnels
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox checked={serviceOk} onCheckedChange={(v) => setServiceOk(!!v)} className="mt-0.5" />
          <span className="text-sm text-slate-100">
            Les <b>services commandés</b> sont bien offerts à cette adresse
          </span>
        </label>
      </div>

      <div className="mt-3">
        <Label className="text-[10px] uppercase tracking-wider text-amber-200/80">
          Note (optionnel — vérification faite, contacts, etc.)
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex : Vérifié via la carte de couverture + appel au client."
          className="bg-[#0d1421] border-amber-700/40 text-slate-100 text-sm rounded-lg min-h-[52px] mt-1"
        />
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <Button
          size="sm"
          disabled={!allChecked || saving}
          onClick={handleConfirm}
          className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
          Confirmer et débloquer l'expédition
        </Button>
      </div>
    </div>
  );
}
