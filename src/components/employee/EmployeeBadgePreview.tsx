/**
 * EmployeeBadgePreview — reusable badge component used by both
 * Field and HR badge pages. Renders the visual badge + action buttons
 * (Apple Wallet, Google Wallet, PDF, Email).
 */
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Apple, Wallet, Printer, Mail, Loader2, IdCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadBadgePdf, type BadgeData } from "@/lib/employeeBadgePdf";

interface BadgePayload {
  ok: boolean;
  badge: BadgeData & {
    target_user_id: string;
    role: string;
    role_title_en: string;
    dept_en: string;
    prefix: string;
    website_url: string;
    preferred_language: string;
  };
  apple_wallet: unknown;
  google_wallet: unknown;
}

interface Props {
  /** When provided, HR/admin generates the badge for that user. */
  targetUserId?: string;
}

export default function EmployeeBadgePreview({ targetUserId }: Props) {
  const [payload, setPayload] = useState<BadgePayload | null>(null);
  const [qrSrc, setQrSrc] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [emailing, setEmailing] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPayload(null);
    setQrSrc("");

    supabase.functions
      .invoke("generate-employee-badge", {
        body: targetUserId ? { target_user_id: targetUserId } : {},
      })
      .then(async ({ data, error }) => {
        if (!alive) return;
        if (error) {
          toast.error(`Erreur badge: ${error.message}`);
          setLoading(false);
          return;
        }
        const p = data as BadgePayload;
        setPayload(p);
        try {
          const qr = await QRCode.toDataURL(p.badge.qr_payload, { width: 220, margin: 1 });
          if (alive) setQrSrc(qr);
        } catch (qrErr) {
          console.error("[EmployeeBadgePreview] QR generation failed:", qrErr);
          if (alive) toast.error("QR code indisponible — réessayez plus tard.");
        }
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [targetUserId]);

  const colorStyle = useMemo(
    () => ({ background: payload?.badge.color ?? "#7C3AED" }),
    [payload]
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Génération du badge…
      </div>
    );
  }

  if (!payload?.ok) {
    return <div className="text-destructive p-6">Impossible de générer le badge.</div>;
  }

  const { badge, apple_wallet, google_wallet } = payload;

  const downloadJson = (filename: string, obj: unknown) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEmail = async () => {
    setEmailing(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-employee-badge", {
        body: {
          ...(targetUserId ? { target_user_id: targetUserId } : {}),
          send_email: true,
        },
      });
      if (error) throw error;
      if ((data as any)?.email_queued) {
        toast.success("Email envoyé — badge prêt dans votre boîte de réception.");
      } else {
        toast.error("Aucun courriel disponible pour cet employé.");
      }
    } catch (e: any) {
      toast.error(`Erreur envoi: ${e.message ?? e}`);
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-0 shadow-lg" style={{ width: 360 }}>
        <div className="p-5 text-white relative" style={colorStyle}>
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider opacity-90">
            <IdCard className="h-4 w-4" /> NIVRA TELECOM
          </div>
          <div className="mt-5">
            <div className="text-xl font-bold leading-tight truncate">{badge.full_name}</div>
            <div className="text-sm opacity-90 mt-1">{badge.role_title_fr}</div>
            <div className="text-xs opacity-75">{badge.dept_fr}</div>
          </div>
          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase opacity-75 tracking-wider">Badge</div>
              <div className="text-lg font-mono font-bold">{badge.agent_number}</div>
              <div className="text-[10px] opacity-75 mt-2">{badge.support_email}</div>
            </div>
            {qrSrc && (
              <div className="bg-white p-1.5 rounded">
                <img src={qrSrc} alt="QR" className="w-20 h-20" />
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 max-w-[360px]">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => downloadJson(`apple-wallet-${badge.agent_number}.json`, apple_wallet)}
        >
          <Apple className="h-4 w-4" /> Apple Wallet
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => downloadJson(`google-wallet-${badge.agent_number}.json`, google_wallet)}
        >
          <Wallet className="h-4 w-4" /> Google Wallet
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => downloadBadgePdf(badge)}>
          <Printer className="h-4 w-4" /> Télécharger PDF
        </Button>
        <Button variant="outline" className="gap-2" onClick={handleEmail} disabled={emailing}>
          {emailing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Envoyer par email
        </Button>
      </div>

      <p className="text-xs text-muted-foreground max-w-[360px]">
        Les fichiers Apple Wallet et Google Wallet sont fournis sous forme JSON,
        prêts à être signés avec les certificats officiels de l'entreprise lorsque
        ceux-ci seront disponibles.
      </p>
    </div>
  );
}
