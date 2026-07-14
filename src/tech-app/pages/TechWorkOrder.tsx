/**
 * TechWorkOrder — Bon de travail : checklist qualité, photos, signature client, PDF.
 */
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Camera, PenLine, FileDown, Check } from "lucide-react";
import { toast } from "sonner";
import TechHeader from "../components/TechHeader";
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
      <TechHeader title="Bon de travail" subtitle={assignmentId ? `Mission ${assignmentId.slice(0, 8)}` : "Nouveau"} back />

      <section className="px-4 mt-4">
        <div className="rounded-2xl bg-zinc-900 text-white p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-black italic uppercase tracking-widest text-amber-400">Progression</span>
            <span className="text-2xl font-black italic">{progress}%</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
            <div className="h-full" style={{ width: `${progress}%`, background: "#fbbf24" }} />
          </div>
        </div>
      </section>

      <section className="px-4 mt-5">
        <h2 className="tp-italic-label text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-2">Checklist qualité</h2>
        <div className="space-y-1.5">
          {CHECKLIST.map((label, i) => {
            const on = !!checks[i];
            return (
              <button
                key={i}
                onClick={() => toggle(i)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border text-left transition-colors"
                style={{ borderColor: on ? "#fbbf24" : "#e4e4e7" }}
              >
                <span
                  className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: on ? "#fbbf24" : "#f4f4f5", color: on ? "#18181b" : "transparent" }}
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
                <span className="text-[13px] font-bold text-zinc-900">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-4 mt-5">
        <h2 className="tp-italic-label text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-2">Photos avant / après ({photos.length})</h2>
        <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" onChange={onPhoto} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full h-14 rounded-xl bg-white border border-zinc-200 flex items-center justify-center gap-2 font-black italic uppercase text-[13px] text-zinc-900"
        >
          <Camera className="h-4 w-4 text-amber-500" /> Ajouter des photos
        </button>
        {photos.length > 0 && (
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {photos.map((p, i) => (
              <img key={i} src={p} alt="" className="aspect-square w-full object-cover rounded-lg border border-zinc-200" />
            ))}
          </div>
        )}
      </section>

      <section className="px-4 mt-5">
        <h2 className="tp-italic-label text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-2">Signature client</h2>
        {signature ? (
          <div className="rounded-xl bg-white border border-zinc-200 p-2">
            <img src={signature} alt="Signature" className="w-full h-24 object-contain" />
            <button onClick={() => { setSignature(null); setShowSig(true); }} className="mt-2 text-[11px] font-black italic uppercase text-amber-600">Refaire</button>
          </div>
        ) : (
          <button
            onClick={() => setShowSig(true)}
            className="w-full h-14 rounded-xl bg-white border border-zinc-200 flex items-center justify-center gap-2 font-black italic uppercase text-[13px] text-zinc-900"
          >
            <PenLine className="h-4 w-4 text-amber-500" /> Faire signer le client
          </button>
        )}
      </section>

      {showSig && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-4">
            <h3 className="text-[15px] font-black italic uppercase mb-2">Signature du client</h3>
            <SignaturePad onConfirm={(data) => { setSignature(data); setShowSig(false); }} />
            <button onClick={() => setShowSig(false)} className="mt-2 w-full h-10 rounded-lg bg-zinc-100 text-[12px] font-black italic uppercase">Annuler</button>
          </div>
        </div>
      )}

      <section className="px-4 mt-5 mb-8">
        <button
          onClick={finalize}
          disabled={!canFinalize || saving}
          className="w-full h-14 rounded-xl font-black italic uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: "#18181b", color: "#fbbf24" }}
        >
          <FileDown className="h-5 w-5" />
          {saving ? "Enregistrement…" : "Finaliser & générer PDF"}
        </button>
        {!canFinalize && (
          <p className="mt-2 text-center text-[11px] text-zinc-500">Compléter la checklist et la signature client pour finaliser.</p>
        )}
      </section>
    </>
  );
}
