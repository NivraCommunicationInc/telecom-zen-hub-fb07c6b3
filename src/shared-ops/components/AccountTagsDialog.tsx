/**
 * AccountTagsDialog — Phase 17
 * Manage account tags & alerts (VIP, à risque, fraude suspectée, etc.) with
 * severity levels, optional internal note, optional expiry, audited.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Tag, Trash2, Plus, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName: string;
  accountId?: string | null;
}

interface AccountTag {
  id: string;
  tag_key: string;
  tag_label: string;
  severity: "info" | "warning" | "critical";
  note: string | null;
  created_by_email: string | null;
  created_at: string;
  expires_at: string | null;
}

interface Preset {
  key: string;
  label: string;
  severity: "info" | "warning" | "critical";
}

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  critical: "bg-red-500/15 text-red-300 border-red-500/40",
};

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  info: <Info className="h-3.5 w-3.5" />,
  warning: <AlertTriangle className="h-3.5 w-3.5" />,
  critical: <AlertCircle className="h-3.5 w-3.5" />,
};

export function AccountTagsDialog({ open, onClose, clientUserId, clientName, accountId }: Props) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState<AccountTag[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetKey, setPresetKey] = useState("custom");
  const [customLabel, setCustomLabel] = useState("");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical">("info");
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("account-tags-actions", {
        body: { action: "list", client_user_id: clientUserId },
      });
      if (error) throw new Error(error.message);
      setTags(((data as any)?.tags ?? []) as AccountTag[]);
      setPresets(((data as any)?.presets ?? []) as Preset[]);
    } catch (e) {
      toast.error("Erreur de chargement", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && clientUserId) {
      setPresetKey("custom");
      setCustomLabel("");
      setSeverity("info");
      setNote("");
      setExpiresAt("");
      setReason("");
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientUserId]);

  const handlePresetChange = (key: string) => {
    setPresetKey(key);
    if (key === "custom") {
      setCustomLabel("");
      setSeverity("info");
      return;
    }
    const p = presets.find((x) => x.key === key);
    if (p) {
      setCustomLabel(p.label);
      setSeverity(p.severity);
    }
  };

  const handleAdd = async () => {
    if (!reason.trim()) return toast.error("Motif requis");
    if (!customLabel.trim()) return toast.error("Libellé requis");

    const tag_key = presetKey === "custom"
      ? customLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 64)
      : presetKey;

    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("account-tags-actions", {
        body: {
          action: "add",
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          tag_key,
          tag_label: customLabel.trim(),
          severity,
          note: note.trim(),
          expires_at: expiresAt || null,
          reason: reason.trim(),
        },
      });
      if (error) throw new Error(error.message);
      toast.success("Étiquette ajoutée");
      setNote("");
      setExpiresAt("");
      setPresetKey("custom");
      setCustomLabel("");
      setSeverity("info");
      await load();
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (tag: AccountTag) => {
    if (!reason.trim()) {
      toast.error("Saisir un motif avant de retirer");
      return;
    }
    if (!confirm(`Retirer l'étiquette "${tag.tag_label}" ?`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("account-tags-actions", {
        body: {
          action: "remove",
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          tag_id: tag.id,
          reason: reason.trim(),
        },
      });
      if (error) throw new Error(error.message);
      toast.success("Étiquette retirée");
      await load();
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Étiquettes & alertes — {clientName}
          </DialogTitle>
          <DialogDescription>
            Marquez le compte avec des étiquettes opérationnelles (VIP, à risque, fraude…). Chaque ajout
            ou retrait est audité et nécessite un motif.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Étiquettes actives</h4>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : tags.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Aucune étiquette sur ce compte.</p>
            ) : (
              <div className="space-y-2">
                {tags.map((t) => (
                  <div
                    key={t.id}
                    className={`rounded-md border p-3 flex items-start justify-between gap-3 ${SEVERITY_STYLES[t.severity]}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {SEVERITY_ICONS[t.severity]}
                        <span className="font-semibold text-sm">{t.tag_label}</span>
                        <Badge variant="outline" className="text-[10px]">{t.tag_key}</Badge>
                        {t.expires_at && (
                          <Badge variant="outline" className="text-[10px]">
                            Expire {format(new Date(t.expires_at), "P", { locale: fr })}
                          </Badge>
                        )}
                      </div>
                      {t.note && <p className="text-xs mt-1 opacity-90 whitespace-pre-wrap">{t.note}</p>}
                      <p className="text-[11px] opacity-70 mt-1">
                        Ajoutée par {t.created_by_email ?? "—"} · {format(new Date(t.created_at), "PPp", { locale: fr })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      onClick={() => handleRemove(t)}
                      aria-label="Retirer"
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Nouvelle étiquette</h4>

            <div className="space-y-2">
              <Label>Modèle</Label>
              <Select value={presetKey} onValueChange={handlePresetChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Personnalisée</SelectItem>
                  {presets.map((p) => (
                    <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Libellé</Label>
                <Input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="VIP, À surveiller…"
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label>Sévérité</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info (bleu)</SelectItem>
                    <SelectItem value="warning">Avertissement (ambre)</SelectItem>
                    <SelectItem value="critical">Critique (rouge)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Note interne (optionnel)</Label>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contexte, références ticket, dates clés…"
              />
            </div>

            <div className="space-y-2">
              <Label>Expiration (optionnel)</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Motif interne (audit) — requis</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Raison de l'ajout ou du retrait…"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={onClose} disabled={busy}>Fermer</Button>
              <Button onClick={handleAdd} disabled={busy || !customLabel.trim() || !reason.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Ajouter
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
