/**
 * Module 52 Phase B — Preferences section (language + deep-link to Module 46).
 * Only `preferred_language` is written here, via `profile.update` gateway.
 * Communications preferences (email/SMS opt-in) remain in Module 46 UI:
 * we only surface a deep-link and never duplicate the write path.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Settings2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { callCoreAction } from "@/core-app/lib/callCoreAction";
import { corePath } from "@/core-app/lib/corePaths";

interface Props {
  account: any;
  profile: any;
  onSaved: () => void;
}

export function ProfilePreferencesSection({ account, profile, onSaved }: Props) {
  const initial = useMemo(() => (profile?.preferred_language as "fr" | "en") || "fr", [profile]);
  const [lang, setLang] = useState<"fr" | "en">(initial);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setLang(initial); setReason(""); }, [initial]);

  const save = async () => {
    if (lang === initial) { toast.info("Aucune modification"); return; }
    if (reason.trim().length < 3) return toast.error("Raison obligatoire");
    setBusy(true);
    try {
      const correlationId = crypto.randomUUID();
      const res = await callCoreAction("client-account-actions", {
        action: "profile.update",
        account_id: account.id,
        payload: { preferred_language: lang },
        idempotency_key: `profile-lang:${account.id}:${lang}:${new Date().toISOString().slice(0, 10)}`,
        correlation_id: correlationId,
      }, { reason, successMessage: "Langue préférée mise à jour", errorMessage: "Échec" });
      if (!res.ok) return;
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Préférences</h3>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Langue préférée</Label>
          <Select value={lang} onValueChange={(v) => setLang(v as "fr" | "en")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Raison (obligatoire si modification)</Label>
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      <div className="flex items-center justify-between">
        <Link
          to={corePath(`/communications?account=${account?.id ?? ""}`)}
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          Gérer les préférences de communication (Module 46) <ExternalLink className="h-3 w-3" />
        </Link>
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Sauvegarde…</> : "Enregistrer préférences"}
        </Button>
      </div>
    </section>
  );
}
