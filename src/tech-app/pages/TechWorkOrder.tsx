/**
 * TechWorkOrder v2 — Bon de travail moderne (checklist, photos, signature).
 * Design aligné Nivra Core. Logique métier inchangée.
 */
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Camera, PenLine, FileDown, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import TechPageHeader from "../components/TechPageHeader";
import SignaturePad from "../components/SignaturePad";
import { supabase } from "@/integrations/supabase/client";

const CHECKLIST = [
  "Équipements installés et testés",
  "Réseau WiFi diffusé et vitesse validée",
  "Terminal TV : chaînes accessibles",
  "Câbles bien fixés, aucun risque de trébuchement",
  "Zone de travail nettoyée",
  "Client formé à l'utilisation",
  "Documentation remise au client",
];

export default function TechWorkOrder() {
  const [sp] = useSearchParams();
  const assignmentId = sp.get("assignment") || sp.get("id");
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [showSig, setShowSig] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const progress = useMemo(() => {
    const total = CHECKLIST.length;
    const done = Object.values(checks).filter(Boolean).length;
    return Math.round((done / total) * 100);
  }, [checks]);

  const canFinalize = progress === 100 && !!signature;

  function toggle(i: number) { setChecks((s) => ({ ...s, [i]: !s[i] })); }

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => {
      const r = new FileReader();
      r.onload = () => setPhotos((p) => [...p, r.result as string]);
      r.readAsDataURL(f);
    });
  }

  async function finalize() {
    if (!canFinalize) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        assignment_id: assignmentId,
        completed_by: user?.id,
        checklist: CHECKLIST.map((label, i) => ({ label, checked: !!checks[i] })),
        signature_data: signature,
        photo_count: photos.length,
        completed_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("installation_job_logs").insert({
        installation_id: assignmentId,
        action: "work_order_completed",
        details: payload,
        created_by: user?.id,
      } as any);
      if (error) throw error;
      toast.success("Bon de travail finalisé");
    } catch (e: any) {
      toast.error(e.message || "Sauvegarde échouée");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TechPageHeader
        title="Bon de travail"
        subtitle={assignmentId ? `Mission ${assignmentId.slice(0, 8)}` : "Nouveau"}
        back
      />

      <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Progress hero */}
        <section className="tc-mission-hero animate-fade-in">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--primary-glow))" }}>
                Progression
              </p>
              <h1 className="text-[32px] font-bold tracking-tight mt-1 tc-tabular" style={{ color: "hsl(var(--foreground))" }}>
                {progress}%
              </h1>
            </div>
            <p className="text-[12.5px]" style={{ color: "hsl(var(--muted-foreground))" }}>
              {Object.values(checks).filter(Boolean).length} / {CHECKLIST.length} tâches
            </p>
          </div>
          <div className="mt-4 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: "var(--tc-gradient-primary)" }} />
          </div>
        </section>

        {/* Checklist */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
            Checklist qualité
          </h2>
          <div className="space-y-1.5">
            {CHECKLIST.map((label, i) => {
              const on = !!checks[i];
              return (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  className="w-full tc-surface tc-surface-hover flex items-center gap-3 p-3 text-left tc-focus-ring"
                  style={{ borderColor: on ? "hsl(var(--primary) / 0.5)" : "hsl(var(--border))" }}
                >
                  <span
                    className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      background: on ? "hsl(var(--primary))" : "hsl(var(--muted))",
                      color: on ? "hsl(var(--primary-foreground))" : "transparent",
                    }}
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                  <span className="text-[13.5px] font-medium" style={{ color: "hsl(var(--foreground))" }}>{label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Photos */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
            Photos avant / après <span className="tc-tabular">({photos.length})</span>
          </h2>
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" onChange={onPhoto} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-14 tc-surface tc-surface-hover flex items-center justify-center gap-2 font-semibold text-[13.5px] tc-focus-ring"
            style={{ color: "hsl(var(--foreground))" }}
          >
            <Camera className="h-4 w-4" style={{ color: "hsl(var(--primary-glow))" }} />
            Ajouter des photos
          </button>
          {photos.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <img key={i} src={p} alt={`Photo ${i + 1}`} className="aspect-square w-full object-cover rounded-lg" style={{ border: "1px solid hsl(var(--border))" }} />
              ))}
            </div>
          )}
        </section>

        {/* Signature */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
            Signature client
          </h2>
          {signature ? (
            <div className="tc-surface p-3">
              <img src={signature} alt="Signature client" className="w-full h-24 object-contain rounded-md" style={{ background: "hsl(var(--muted))" }} />
              <button
                onClick={() => { setSignature(null); setShowSig(true); }}
                className="mt-2 text-[12px] font-semibold"
                style={{ color: "hsl(var(--primary-glow))" }}
              >
                Refaire la signature
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSig(true)}
              className="w-full h-14 tc-surface tc-surface-hover flex items-center justify-center gap-2 font-semibold text-[13.5px] tc-focus-ring"
              style={{ color: "hsl(var(--foreground))" }}
            >
              <PenLine className="h-4 w-4" style={{ color: "hsl(var(--primary-glow))" }} />
              Faire signer le client
            </button>
          )}
        </section>

        {/* Signature modal */}
        {showSig && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 animate-fade-in" style={{ background: "hsl(var(--background) / 0.85)", backdropFilter: "blur(4px)" }}>
            <div className="w-full max-w-md tc-surface p-4 animate-scale-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[15px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>Signature du client</h3>
                <button onClick={() => setShowSig(false)} aria-label="Fermer" className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "hsl(var(--muted))" }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <SignaturePad onConfirm={(data) => { setSignature(data); setShowSig(false); }} />
            </div>
          </div>
        )}

        {/* Finalize */}
        <section className="pt-2">
          <button
            onClick={finalize}
            disabled={!canFinalize || saving}
            className="w-full h-14 rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all tc-focus-ring"
            style={{
              background: canFinalize ? "var(--tc-gradient-primary)" : "hsl(var(--muted))",
              color: canFinalize ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
              boxShadow: canFinalize ? "0 10px 24px hsl(var(--primary) / 0.35)" : "none",
            }}
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
            {saving ? "Enregistrement…" : "Finaliser & générer le PDF"}
          </button>
          {!canFinalize && (
            <p className="mt-2 text-center text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
              Compléter la checklist et la signature client pour finaliser.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
