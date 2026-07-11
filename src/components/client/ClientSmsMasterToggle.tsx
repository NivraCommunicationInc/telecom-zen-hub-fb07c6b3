/**
 * ClientSmsMasterToggle — master opt-in switch for transactional SMS.
 *
 * Module 46 (D46-C): All preference writes now go through the canonical
 * `communication-preferences-actions` Edge Function. The previous direct
 * `UPDATE profiles.sms_opt_in` bypassed audit + Loi 25 tracking and has
 * been removed.
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { MessageSquare, Loader2 } from "lucide-react";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  userId: string;
}

export default function ClientSmsMasterToggle({ userId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      setLoading(true);
      const { data } = await portalSupabase
        .from("profiles")
        .select("sms_opt_in, phone, phone_e164")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      setEnabled((data as any)?.sms_opt_in ?? true);
      setPhone((data as any)?.phone_e164 || (data as any)?.phone || null);
      setLoading(false);
    };
    void fetchProfile();
    return () => { cancelled = true; };
  }, [userId]);

  const toggle = async (value: boolean) => {
    setSaving(true);
    // D46-C: canonical gateway (audited, Loi 25 compliant).
    const { data, error } = await supabase.functions.invoke(
      "communication-preferences-actions",
      {
        body: {
          action: "client_self_sms_master",
          client_user_id: userId,
          changes: { sms_master: value },
          reason: value ? "Client opt-in (master)" : "Client opt-out (master)",
        },
      },
    );
    setSaving(false);
    if (error || (data as any)?.error) {
      toast.error("Erreur lors de l'enregistrement");
      return;
    }
    setEnabled(value);
    toast.success(value ? "SMS activés" : "SMS désactivés");
  };

  return (
    <Card className="bg-card border-border mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="w-5 h-5 text-cyan-400" />
          Recevoir des notifications par SMS
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement…
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-foreground">
                {phone
                  ? <>Votre numéro : <span className="font-medium">{phone}</span></>
                  : <span className="text-amber-600">Aucun numéro enregistré dans votre profil.</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Vous recevrez des SMS importants sur votre service Nivra (confirmation de commande,
                paiements, activation, technicien en route).
              </p>
            </div>
            <Switch
              checked={enabled}
              disabled={saving || !phone}
              onCheckedChange={toggle}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
