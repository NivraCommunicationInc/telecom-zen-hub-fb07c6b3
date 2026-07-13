/**
 * ClientAccountAccessDialog — Manage online account access for a client.
 * Used in Core Account 360 and OneView CS (Employee) Client 360.
 *
 * Actions: send invite to set password, send password reset email,
 * confirm email manually, change email, force logout, set temporary password.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Mail, KeyRound, ShieldCheck, AtSign, LogOut, Lock, Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId?: string | null;
  clientEmail?: string | null;
  clientName?: string;
}

type ActionKey =
  | "send_invite"
  | "send_password_reset"
  | "force_confirm_email"
  | "change_email"
  | "force_logout"
  | "set_temporary_password"
  | "resend_welcome";

export function ClientAccountAccessDialog({ open, onClose, clientUserId, clientEmail, clientName }: Props) {
  const [busy, setBusy] = useState<ActionKey | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [tempReason, setTempReason] = useState("");
  const [logoutReason, setLogoutReason] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const CONFIRM_MESSAGES: Partial<Record<ActionKey, string>> = {
    force_logout: "Révoquer toutes les sessions actives du client (web + mobile) ?",
    set_temporary_password: "Générer un nouveau mot de passe temporaire ? Le client sera déconnecté et devra se reconnecter avec ce mot de passe.",
    change_email: "Changer l'adresse courriel de connexion du client ? L'ancienne adresse sera notifiée.",
  };

  const run = async (action: ActionKey, extra: Record<string, any> = {}) => {
    if (!clientEmail && action !== "force_logout") {
      toast.error("Aucun courriel client connu");
      return;
    }
    const confirmMsg = CONFIRM_MESSAGES[action];
    if (confirmMsg && !window.confirm(confirmMsg)) return;

    setBusy(action);
    setTempPassword(null);
    try {
      const { data, error } = await supabase.functions.invoke("client-account-admin", {
        body: {
          action,
          client_user_id: clientUserId,
          client_email: clientEmail,
          redirect_origin: window.location.origin,
          ...extra,
        },
      });
      // Try to extract server error message even when SDK returns a generic FunctionsHttpError
      let serverError: string | null = null;
      if (error) {
        try {
          // supabase-js v2: FunctionsHttpError.context is a Response
          const resp: any = (error as any)?.context?.response ?? (error as any)?.context;
          if (resp && typeof resp.clone === "function") {
            const parsed = await resp.clone().json().catch(() => null);
            serverError = parsed?.error || parsed?.message || null;
          }
        } catch (_e) { /* ignore */ }
      }
      if (serverError) throw new Error(serverError);
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success((data as any)?.message || "Action complétée");
      if (action === "set_temporary_password" && (data as any)?.temporary_password) {
        setTempPassword((data as any).temporary_password);
      }
      if (action === "change_email") {
        setNewEmail("");
        setChangeReason("");
      }
    } catch (e: any) {
      const msg = e?.message || "Échec de l'action";
      if (msg.includes("Motif obligatoire")) {
        toast.error("Motif obligatoire pour changer le courriel.");
      } else if (msg.includes("Seul un admin")) {
        toast.error("Seul un admin Core peut changer le courriel.");
      } else if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("invalide")) {
        toast.error("Nouveau courriel invalide.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(null);
    }
  };

  const Row = ({ icon: Icon, title, desc, action, danger, children }: any) => (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 mt-0.5 ${danger ? "text-destructive" : "text-primary"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Accès au compte en ligne</DialogTitle>
          <DialogDescription>
            {clientName ? `${clientName} · ` : ""}{clientEmail || "Aucun courriel"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Row
            icon={Mail}
            title="Envoyer invitation compte en ligne"
            desc="Crée le compte au besoin et envoie un courriel pour définir le mot de passe."
            action={
              <Button size="sm" disabled={busy !== null} onClick={() => run("send_invite")}>
                {busy === "send_invite" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Envoyer"}
              </Button>
            }
          />

          <Row
            icon={KeyRound}
            title="Réinitialiser le mot de passe"
            desc="Envoie un lien sécurisé de réinitialisation au courriel du client."
            action={
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => run("send_password_reset")}>
                {busy === "send_password_reset" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Envoyer"}
              </Button>
            }
          />

          <Row
            icon={Send}
            title="Renvoyer le courriel de bienvenue"
            desc="Renvoie le message de bienvenue Nivra (modèle officiel du site)."
            action={
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => run("resend_welcome")}>
                {busy === "resend_welcome" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Renvoyer"}
              </Button>
            }
          />

          <Row
            icon={ShieldCheck}
            title="Confirmer le courriel manuellement"
            desc="Marque l'adresse comme vérifiée (utile si le client n'a jamais cliqué le lien)."
            action={
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => run("force_confirm_email")}>
                {busy === "force_confirm_email" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmer"}
              </Button>
            }
          />

          <Row
            icon={AtSign}
            title="Changer le courriel du compte"
            desc="Remplace l'adresse de connexion. L'ancienne adresse et la nouvelle reçoivent une notification. Motif obligatoire."
          >
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="nouveau@courriel.ca"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <Textarea
                placeholder="Motif du changement (obligatoire, audité)"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                rows={2}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={busy !== null || !newEmail || !changeReason.trim()}
                  onClick={() => run("change_email", { new_email: newEmail, reason: changeReason.trim() })}
                >
                  {busy === "change_email" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Changer"}
                </Button>
              </div>
            </div>
          </Row>

          <Row
            icon={Lock}
            title="Définir un mot de passe temporaire"
            desc="Génère un mot de passe sécurisé à communiquer verbalement au client."
            action={
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => run("set_temporary_password")}>
                {busy === "set_temporary_password" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Générer"}
              </Button>
            }
          >
            {tempPassword && (
              <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5">
                <code className="text-xs flex-1 break-all">{tempPassword}</code>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success("Copié"); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
          </Row>

          <Separator />

          <Row
            icon={LogOut}
            title="Forcer la déconnexion"
            desc="Révoque toutes les sessions actives du client (web + mobile)."
            danger
            action={
              <Button size="sm" variant="destructive" disabled={busy !== null} onClick={() => run("force_logout")}>
                {busy === "force_logout" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Déconnecter"}
              </Button>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
