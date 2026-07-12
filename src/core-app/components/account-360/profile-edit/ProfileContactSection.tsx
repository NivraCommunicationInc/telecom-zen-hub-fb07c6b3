/**
 * Module 52 Phase B — Contact section of the Profile Edit orchestrator.
 * Email and phone are read-only here; changes are routed through OTP dialogs
 * (email.request_change/confirm_change, phone.request_change/verify_otp)
 * exposed by the client-account-actions gateway.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Phone } from "lucide-react";
import { EmailChangeOtpDialog } from "./EmailChangeOtpDialog";
import { PhoneChangeOtpDialog } from "./PhoneChangeOtpDialog";

interface Props {
  account: any;
  profile: any;
  onSaved: () => void;
}

export function ProfileContactSection({ account, profile, onSaved }: Props) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);

  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Contact</h3>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-md border border-input p-3 space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Mail className="h-3 w-3" /> Email</div>
          <div className="font-mono text-sm break-all">{profile?.email || "—"}</div>
          <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
            Changer l'email (double opt-in)
          </Button>
        </div>

        <div className="rounded-md border border-input p-3 space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Phone className="h-3 w-3" /> Téléphone</div>
          <div className="font-mono text-sm">{profile?.phone || "—"}</div>
          <Button size="sm" variant="outline" onClick={() => setPhoneOpen(true)}>
            Changer le téléphone (OTP SMS)
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Les changements d'email et de téléphone déclenchent un flux de vérification à double étape
        (audit + timeline + correlation_id) via la gateway <code>client-account-actions</code>.
      </p>

      <EmailChangeOtpDialog open={emailOpen} onOpenChange={setEmailOpen} account={account} currentEmail={profile?.email} onSaved={onSaved} />
      <PhoneChangeOtpDialog open={phoneOpen} onOpenChange={setPhoneOpen} account={account} currentPhone={profile?.phone} onSaved={onSaved} />
    </section>
  );
}
