/**
 * FieldBadgePage — Field agent's digital badge.
 * Self-contained (does not use the shared EmployeeBadgePreview) so the
 * redesign stays scoped to the Field portal.
 *
 * Features:
 *  - Profile photo upload (JPG/PNG, max 2MB, center-cropped to circle, stored in `agent-photos`)
 *  - Work city selector (saved to profiles.work_city)
 *  - Badge preview with photo, name, role, city, badge number, QR code
 *  - Download PDF, set as wallpaper (PNG), send by email
 */
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Printer, Mail, Smartphone, Loader2, IdCard, Upload, User2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadBadgePdf, type BadgeData } from "@/lib/employeeBadgePdf";

const WORK_CITIES = [
  "Montréal", "Laval", "Terrebonne", "Repentigny", "Mascouche",
  "Blainville", "Saint-Jérôme", "Longueuil", "Saint-Hubert", "Brossard",
  "Châteauguay", "LaSalle", "Vaudreuil-Dorion", "Québec", "Trois-Rivières",
];

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
}

export default function FieldBadgePage() {
  const [payload, setPayload] = useState<BadgePayload | null>(null);
  const [qrSrc, setQrSrc] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [emailing, setEmailing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [workCity, setWorkCity] = useState<string>("");
  const [savingCity, setSavingCity] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: au } = await supabase.auth.getUser();
      const uid = au.user?.id ?? "";
      if (!alive) return;
      setUserId(uid);

      const [{ data: prof }, badgeRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("avatar_url, work_city")
          .eq("user_id", uid)
          .maybeSingle(),
        supabase.functions.invoke("generate-employee-badge", { body: {} }),
      ]);

      if (!alive) return;

      if (prof) {
        setAvatarUrl((prof as any).avatar_url ?? "");
        setWorkCity((prof as any).work_city ?? "");
      }

      if (badgeRes.error) {
        toast.error(`Erreur badge: ${badgeRes.error.message}`);
      } else {
        const p = badgeRes.data as BadgePayload;
        setPayload(p);
        try {
          const qr = await QRCode.toDataURL(p.badge.qr_payload, { width: 220, margin: 1 });
          if (alive) setQrSrc(qr);
        } catch { /* non-fatal */ }
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const badge = payload?.badge;
  const colorStyle = useMemo(
    () => ({ background: badge?.color ?? "#7C3AED" }),
    [badge],
  );

  /* ------------------------------------------------------------------ */
  /* Photo upload                                                       */
  /* ------------------------------------------------------------------ */

  async function handlePhotoSelected(file: File) {
    if (!userId) { toast.error("Non authentifié"); return; }
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Format invalide. JPG ou PNG uniquement.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 2 Mo).");
      return;
    }
    setUploading(true);
    try {
      // Center-crop to a square then resize to 512x512 PNG
      const bmp = await createImageBitmap(file);
      const size = Math.min(bmp.width, bmp.height);
      const sx = (bmp.width - size) / 2;
      const sy = (bmp.height - size) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bmp, sx, sy, size, size, 0, 0, 512, 512);
      const blob: Blob = await new Promise((res) =>
        canvas.toBlob((b) => res(b!), "image/png", 0.92),
      );

      const path = `${userId}/avatar.png`;
      const { error: upErr } = await supabase.storage
        .from("agent-photos")
        .upload(path, blob, { upsert: true, contentType: "image/png", cacheControl: "3600" });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("agent-photos").getPublicUrl(path);
      const newUrl = `${pub.publicUrl}?v=${Date.now()}`;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: newUrl })
        .eq("user_id", userId);
      if (profErr) throw profErr;

      setAvatarUrl(newUrl);
      toast.success("Photo mise à jour");
    } catch (e: any) {
      toast.error(`Erreur upload: ${e.message ?? e}`);
    } finally {
      setUploading(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /* City save                                                          */
  /* ------------------------------------------------------------------ */

  async function handleCityChange(city: string) {
    setWorkCity(city);
    if (!userId) return;
    setSavingCity(true);
    const { error } = await supabase
      .from("profiles")
      .update({ work_city: city })
      .eq("user_id", userId);
    setSavingCity(false);
    if (error) toast.error(`Erreur: ${error.message}`);
    else toast.success("Ville enregistrée");
  }

  /* ------------------------------------------------------------------ */
  /* Wallpaper generation (1080x1920 PNG)                               */
  /* ------------------------------------------------------------------ */

  async function handleWallpaper() {
    if (!badge) return;
    try {
      const W = 1080, H = 1920;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // Dark gradient background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0F0F1E");
      bg.addColorStop(1, "#1A1A2E");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Card
      const cx = 90, cy = 360, cw = W - 180, ch = 1200;
      const r = 48;
      ctx.fillStyle = badge.color || "#7C3AED";
      roundRect(ctx, cx, cy, cw, ch, r);
      ctx.fill();

      // Header
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 42px system-ui, sans-serif";
      ctx.fillText("NIVRA TELECOM", cx + 60, cy + 90);

      // Photo (circle, top center of card)
      const photoR = 150;
      const photoCx = cx + cw / 2;
      const photoCy = cy + 290;
      if (avatarUrl) {
        try {
          const img = await loadImage(avatarUrl);
          ctx.save();
          ctx.beginPath();
          ctx.arc(photoCx, photoCy, photoR, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, photoCx - photoR, photoCy - photoR, photoR * 2, photoR * 2);
          ctx.restore();
        } catch { /* skip */ }
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.beginPath();
        ctx.arc(photoCx, photoCy, photoR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(photoCx, photoCy, photoR, 0, Math.PI * 2);
      ctx.stroke();

      // Name + role + city
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "bold 64px system-ui, sans-serif";
      ctx.fillText(badge.full_name, photoCx, photoCy + photoR + 110);
      ctx.font = "36px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(badge.role_title_fr, photoCx, photoCy + photoR + 170);
      if (workCity) {
        ctx.font = "32px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillText(workCity, photoCx, photoCy + photoR + 220);
      }
      ctx.textAlign = "left";

      // Badge number
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "28px system-ui, sans-serif";
      ctx.fillText("BADGE", cx + 60, cy + ch - 220);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 56px ui-monospace, monospace";
      ctx.fillText(badge.agent_number, cx + 60, cy + ch - 160);

      // QR code (bottom right of card)
      if (qrSrc) {
        const qrImg = await loadImage(qrSrc);
        const qs = 220;
        ctx.fillStyle = "#fff";
        roundRect(ctx, cx + cw - qs - 70, cy + ch - qs - 90, qs + 30, qs + 30, 16);
        ctx.fill();
        ctx.drawImage(qrImg, cx + cw - qs - 55, cy + ch - qs - 75, qs, qs);
      }

      // Footer text
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "28px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("nivra-telecom.ca", W / 2, H - 120);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `nivra-badge-fond-ecran-${badge.agent_number}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Fond d'écran téléchargé");
      }, "image/png");
    } catch (e: any) {
      toast.error(`Erreur fond d'écran: ${e.message ?? e}`);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Email                                                              */
  /* ------------------------------------------------------------------ */

  async function handleEmail() {
    setEmailing(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-employee-badge", {
        body: { send_email: true },
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
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-[#B8B8D0]">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement du badge…
      </div>
    );
  }

  if (!badge) {
    return <div className="p-6 text-destructive">Impossible de générer le badge.</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Mon Badge</h1>
        <p className="text-sm text-[#B8B8D0]">
          Votre badge employé numérique Nivra. Personnalisez-le, téléchargez-le ou envoyez-le par courriel.
        </p>
      </div>

      {/* Photo + city customization */}
      <Card className="p-5 bg-[#1A1A2E] border-[#2D2D4E] text-white space-y-5">
        <div>
          <h2 className="text-sm font-semibold mb-3">Ma photo de profil</h2>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 ring-2 ring-[#7C3AED]">
              <AvatarImage src={avatarUrl} alt="Photo de profil" />
              <AvatarFallback className="bg-[#16213E] text-white">
                <User2 className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePhotoSelected(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                className="gap-2"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Upload className="h-4 w-4" />}
                Téléverser ma photo
              </Button>
              <p className="text-xs text-[#B8B8D0] mt-1">JPG ou PNG, max 2 Mo. Recadrée en cercle.</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-3">Ma ville de travail</h2>
          <div className="flex items-center gap-3">
            <Select value={workCity} onValueChange={handleCityChange}>
              <SelectTrigger className="w-[260px] bg-[#16213E] border-[#2D2D4E] text-white">
                <SelectValue placeholder="Sélectionner une ville" />
              </SelectTrigger>
              <SelectContent>
                {WORK_CITIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savingCity && <Loader2 className="h-4 w-4 animate-spin text-[#B8B8D0]" />}
          </div>
        </div>
      </Card>

      {/* Badge preview */}
      <div className="flex flex-col items-center gap-4">
        <Card className="overflow-hidden border-0 shadow-xl" style={{ width: 360 }}>
          <div className="p-6 text-white relative" style={colorStyle}>
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider opacity-90">
              <IdCard className="h-4 w-4" /> NIVRA TELECOM
            </div>

            <div className="flex flex-col items-center mt-4">
              <Avatar className="h-24 w-24 ring-2 ring-white/90">
                <AvatarImage src={avatarUrl} alt="" />
                <AvatarFallback className="bg-white/15 text-white">
                  <User2 className="h-10 w-10" />
                </AvatarFallback>
              </Avatar>
              <div className="text-lg font-bold leading-tight mt-3 text-center">{badge.full_name}</div>
              <div className="text-sm opacity-90">{badge.role_title_fr}</div>
              {workCity && <div className="text-xs opacity-80 mt-0.5">{workCity}</div>}
            </div>

            <div className="mt-5 flex items-end justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase opacity-75 tracking-wider">Badge</div>
                <div className="text-lg font-mono font-bold">{badge.agent_number}</div>
                <div className="text-[10px] opacity-75 mt-2">{badge.support_email}</div>
              </div>
              {qrSrc && (
                <div className="bg-gray-800 p-1.5 rounded">
                  <img src={qrSrc} alt="QR" className="w-20 h-20" />
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-[540px]">
          <Button variant="outline" className="gap-2" onClick={() => downloadBadgePdf(badge)}>
            <Printer className="h-4 w-4" /> Télécharger PDF
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleWallpaper}>
            <Smartphone className="h-4 w-4" /> Fond d'écran
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleEmail} disabled={emailing}>
            {emailing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Envoyer par email
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* Helpers                                                              */
/* -------------------------------------------------------------------- */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
