/**
 * AccountPreferencesDialog — Phase 16
 * Manage client communication preferences (email categories, SMS categories,
 * preferred contact method, language). Transactional channels (service updates,
 * billing notifications) remain ON for legal/operational reasons.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Settings2, BellOff } from "lucide-react";
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

interface Prefs {
  marketing_emails: boolean;
  promotional_emails: boolean;
  newsletter: boolean;
  service_updates: boolean;
  billing_notifications: boolean;
  sms_reminders: boolean;
  sms_invoices: boolean;
  sms_service_updates: boolean;
  preferred_contact_method: "email" | "sms" | "both";
  consent_given_at: string | null;
  consent_source: string | null;
}

interface Profile {
  preferred_language: "fr" | "en" | null;
  notification_channel: "email" | "sms" | "push" | null;
  email: string | null;
  phone: string | null;
  phone_e164: string | null;
}

const EMAIL_TOGGLES: { key: keyof Prefs; label: string; help: string }[] = [
  { key: "marketing_emails", label: "Marketing", help: "Campagnes promotionnelles générales" },
  { key: "promotional_emails", label: "Promotions ciblées", help: "Offres spéciales selon profil" },
  { key: "newsletter", label: "Infolettre", help: "Nouveautés produits et actualités Nivra" },
  { key: "service_updates", label: "Mises à jour service", help: "Transactionnel — toujours requis" },
  { key: "billing_notifications", label: "Notifications facturation", help: "Transactionnel — toujours requis" },
];

const SMS_TOGGLES: { key: keyof Prefs; label: string; help: string }[] = [
  { key: "sms_reminders", label: "SMS rappels", help: "Rappels de paiement et rendez-vous" },
  { key: "sms_invoices", label: "SMS factures", help: "Notification de nouvelle facture" },
  { key: "sms_service_updates", label: "SMS mises à jour", help: "Statut commande, maintenance, incidents" },
];

const LOCKED: Array<keyof Prefs> = ["service_updates", "billing_notifications"];

export function AccountPreferencesDialog({ open, onClose, clientUserId, clientName, accountId }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reason, setReason] = useState("");
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("communication-preferences-actions", {
        body: { action: "get", client_user_id: clientUserId },
      });
      if (error) throw new Error(error.message);
      setPrefs((data as any).preferences as Prefs);
      setProfile((data as any).profile as Profile);
      setDirty(false);
    } catch (e) {
      toast.error("Erreur de chargement", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && clientUserId) {
      setReason("");
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientUserId]);

  const setBool = (k: keyof Prefs, v: boolean) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [k]: v });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!prefs || !profile) return;
    if (!reason.trim()) {
      toast.error("Motif requis");
      return;
    }
    setSaving(true);
    try {
      const changes: Record<string, unknown> = {
        marketing_emails: prefs.marketing_emails,
        promotional_emails: prefs.promotional_emails,
        newsletter: prefs.newsletter,
        service_updates: prefs.service_updates,
        billing_notifications: prefs.billing_notifications,
        sms_reminders: prefs.sms_reminders,
        sms_invoices: prefs.sms_invoices,
        sms_service_updates: prefs.sms_service_updates,
        preferred_contact_method: prefs.preferred_contact_method,
        preferred_language: profile.preferred_language ?? "fr",
        notification_channel: profile.notification_channel ?? "email",
      };
      const { data, error } = await supabase.functions.invoke("communication-preferences-actions", {
        body: {
          action: "update",
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          reason: reason.trim(),
          changes,
        },
      });
      if (error) throw new Error(error.message);
      setPrefs((data as any).preferences as Prefs);
      setProfile((data as any).profile as Profile);
      setDirty(false);
      toast.success("Préférences mises à jour");
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleUnsubscribeAll = async () => {
    if (!reason.trim()) {
      toast.error("Motif requis pour désinscrire");
      return;
    }
    if (!confirm("Désinscrire le client de toutes les communications marketing et SMS optionnels ?")) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("communication-preferences-actions", {
        body: {
          action: "unsubscribe_all",
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          reason: reason.trim(),
        },
      });
      if (error) throw new Error(error.message);
      setPrefs((data as any).preferences as Prefs);
      setProfile((data as any).profile as Profile);
      setDirty(false);
      toast.success("Désinscription appliquée");
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Préférences de communication — {clientName}
          </DialogTitle>
          <DialogDescription>
            Gérez les canaux opt-in/opt-out, la langue et la méthode de contact préférée. Les notifications
            transactionnelles (service, facturation) restent toujours actives pour des raisons légales.
          </DialogDescription>
        </DialogHeader>

        {loading || !prefs || !profile ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-md border p-3 text-xs space-y-1 bg-muted/30">
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{profile.email ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Téléphone</span><span>{profile.phone_e164 ?? profile.phone ?? "—"}</span></div>
              {prefs.consent_given_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dernier consentement</span>
                  <span>{format(new Date(prefs.consent_given_at), "PPp", { locale: fr })} · {prefs.consent_source ?? "—"}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Langue préférée</Label>
                <Select
                  value={profile.preferred_language ?? "fr"}
                  onValueChange={(v) => { setProfile({ ...profile, preferred_language: v as "fr" | "en" }); setDirty(true); }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Méthode préférée</Label>
                <Select
                  value={prefs.preferred_contact_method}
                  onValueChange={(v) => { setPrefs({ ...prefs, preferred_contact_method: v as Prefs["preferred_contact_method"] }); setDirty(true); }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email seulement</SelectItem>
                    <SelectItem value="sms">SMS seulement</SelectItem>
                    <SelectItem value="both">Email + SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Canal de notification système</Label>
              <Select
                value={profile.notification_channel ?? "email"}
                onValueChange={(v) => { setProfile({ ...profile, notification_channel: v as Profile["notification_channel"] }); setDirty(true); }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="push">Notification push</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Communications email</h4>
              {EMAIL_TOGGLES.map((t) => {
                const locked = LOCKED.includes(t.key);
                return (
                  <div key={t.key} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Label className="cursor-pointer">{t.label}</Label>
                        {locked && <Badge variant="secondary" className="text-[10px]">Transactionnel</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.help}</p>
                    </div>
                    <Switch
                      checked={!!prefs[t.key]}
                      disabled={locked}
                      onCheckedChange={(v) => setBool(t.key, v)}
                    />
                  </div>
                );
              })}
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Communications SMS</h4>
              {SMS_TOGGLES.map((t) => (
                <div key={t.key} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Label className="cursor-pointer">{t.label}</Label>
                    <p className="text-xs text-muted-foreground">{t.help}</p>
                  </div>
                  <Switch
                    checked={!!prefs[t.key]}
                    onCheckedChange={(v) => setBool(t.key, v)}
                  />
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Motif interne (audit)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Demande client, désinscription, mise à jour profil…"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleUnsubscribeAll}
                disabled={saving}
                className="text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
              >
                <BellOff className="h-4 w-4 mr-2" />
                Désinscription complète (marketing)
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose} disabled={saving}>Fermer</Button>
                <Button onClick={handleSave} disabled={saving || !dirty}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Enregistrer
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
