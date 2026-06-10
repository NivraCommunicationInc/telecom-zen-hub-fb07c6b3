import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, ShieldCheck, Loader2, QrCode, KeyRound, X } from "lucide-react";
import { toast } from "sonner";

export default function CoreMfaPanel() {
  const [enrollStep, setEnrollStep] = useState<"idle" | "qr">("idle");
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const { data: factors, isLoading } = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
  });

  const verified = factors?.totp?.filter((f) => f.status === "verified") ?? [];
  const isEnrolled = verified.length > 0;

  const startEnroll = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.auth.mfa as any).enroll({
        factorType: "totp",
        issuer: "Nivra Core",
        friendlyName: "Authentificateur",
      });
      if (error || !data) throw error ?? new Error("Enrôlement impossible");
      setFactorId(data.id);
      setQrSvg(data.totp.qr_code);
      setSecret(data.totp.secret);
      const { data: ch, error: chErr } = await (supabase.auth.mfa as any).challenge({ factorId: data.id });
      if (chErr || !ch) throw chErr ?? new Error("Challenge impossible");
      setChallengeId(ch.id);
      setEnrollStep("qr");
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de démarrer l'enrôlement MFA");
    } finally {
      setLoading(false);
    }
  };

  const verifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await (supabase.auth.mfa as any).verify({
        factorId,
        challengeId,
        code: code.replace(/\s/g, ""),
      });
      if (error) throw error;
      toast.success("MFA activé — votre compte est maintenant protégé");
      setEnrollStep("idle");
      setCode("");
      qc.invalidateQueries({ queryKey: ["mfa-factors"] });
    } catch {
      toast.error("Code invalide — vérifiez votre application d'authentification");
    } finally {
      setLoading(false);
    }
  };

  const unenroll = async () => {
    if (!confirm("Désactiver le MFA ? Votre compte sera moins sécurisé.")) return;
    const factor = verified[0];
    if (!factor) return;
    setLoading(true);
    try {
      const { error } = await (supabase.auth.mfa as any).unenroll({ factorId: factor.id });
      if (error) throw error;
      toast.success("MFA désactivé");
      qc.invalidateQueries({ queryKey: ["mfa-factors"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de désactiver le MFA");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-[#64748B]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />Chargement MFA…
      </div>
    );
  }

  return (
    <div className="border-t border-[hsl(220,15%,16%)] pt-4 mt-2 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEnrolled
            ? <ShieldCheck className="h-4 w-4 text-emerald-400" />
            : <Shield className="h-4 w-4 text-[#64748B]" />}
          <span className="text-[12px] font-semibold text-[#F8FAFC]">
            Authentification à deux facteurs (MFA)
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            isEnrolled
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-[hsl(220,15%,18%)] text-[#64748B]"
          }`}>
            {isEnrolled ? "ACTIF" : "INACTIF"}
          </span>
        </div>

        {isEnrolled ? (
          <button
            onClick={unenroll}
            disabled={loading}
            className="text-[11px] text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
          >
            Désactiver
          </button>
        ) : enrollStep === "idle" ? (
          <button
            onClick={startEnroll}
            disabled={loading}
            className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors"
          >
            {loading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <QrCode className="h-3.5 w-3.5" />}
            Activer le MFA
          </button>
        ) : null}
      </div>

      {isEnrolled && (
        <p className="text-[11px] text-[#64748B] leading-relaxed">
          Un code TOTP de 6 chiffres sera demandé à chaque connexion.
        </p>
      )}

      {!isEnrolled && enrollStep === "qr" && (
        <div className="rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,8%)] p-4 space-y-4">
          <div className="flex items-start justify-between">
            <p className="text-[12px] text-[#94A3B8] leading-relaxed max-w-xs">
              Scannez avec <strong className="text-white">Google Authenticator</strong>,{" "}
              <strong className="text-white">Authy</strong>, ou toute app TOTP.
            </p>
            <button
              onClick={() => setEnrollStep("idle")}
              className="text-[#64748B] hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {qrSvg && (
            <div className="flex justify-center">
              <div
                className="rounded-xl border-4 border-white bg-white p-1"
                style={{ width: 180, height: 180 }}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            </div>
          )}

          <details className="text-[11px]">
            <summary className="cursor-pointer text-[#64748B] hover:text-[#94A3B8] flex items-center gap-1.5 transition-colors">
              <KeyRound className="h-3 w-3" /> Saisie manuelle
            </summary>
            <div className="mt-2 font-mono text-white bg-[hsl(220,20%,11%)] rounded-lg px-3 py-2 break-all select-all text-[11px]">
              {secret}
            </div>
          </details>

          <form onSubmit={verifyEnroll} className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-1.5 block">
                Code de vérification
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123 456"
                autoFocus
                autoComplete="one-time-code"
                className="w-full h-10 rounded-lg border border-[hsl(220,15%,22%)] bg-[hsl(220,20%,11%)] px-3 text-center text-xl font-mono tracking-[0.35em] text-white placeholder:text-[hsl(220,10%,35%)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={loading || code.replace(/\s/g, "").length < 6}
              className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-medium text-white flex items-center justify-center gap-2 transition-colors"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ShieldCheck className="h-4 w-4" />}
              Confirmer l'activation
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
