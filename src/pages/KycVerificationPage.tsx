/**
 * KycVerificationPage — Public 3-step KYC wizard accessed via secure token email link.
 * URL: /verification/:token
 *
 * Phase 2 rebuild: large-card document picker → 3-photo capture (recto / verso / selfie)
 * → confirmation. Submits all three files in one multipart POST to the
 * `kyc-public-upload` edge function which writes them to the `id-documents`
 * bucket and updates `identity_verification_sessions` (document_front_path,
 * document_back_path, selfie_path, document_type, status='submitted').
 *
 * Mobile-first, Nivra branding (purple #7c3aed primary), no auth required.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, ShieldCheck, Upload, CheckCircle2, AlertCircle, Lock,
  Plane, Car, IdCard, FileBadge, FileText, ArrowLeft, ArrowRight,
  X, Camera, User as UserIcon,
} from "lucide-react";

type State = "loading" | "ready" | "uploading" | "done" | "error" | "expired" | "already";
type Step = 1 | 2 | 3;
type DocType = "passport" | "driver_license" | "provincial_id" | "permanent_resident" | "other_government";
type Slot = "front" | "back" | "selfie";

const DOC_OPTIONS: { id: DocType; label: string; sub: string; Icon: any }[] = [
  { id: "passport",            label: "Passeport canadien",            sub: "Document fédéral d'identité",          Icon: Plane },
  { id: "driver_license",      label: "Permis de conduire",            sub: "Émis par votre province (SAAQ, etc.)", Icon: Car },
  { id: "provincial_id",       label: "Carte d'identité provinciale",  sub: "Carte avec photo",                     Icon: IdCard },
  { id: "permanent_resident",  label: "Carte de résidence permanente", sub: "Carte RP du Canada",                   Icon: FileBadge },
  { id: "other_government",    label: "Autre document gouvernemental", sub: "Document officiel avec photo",         Icon: FileText },
];

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPT = "image/*";

export default function KycVerificationPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>("loading");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<{ orderNumber?: string; planName?: string; expiresAt?: string } | null>(null);

  // Wizard state
  const [step, setStep] = useState<Step>(1);
  const [docType, setDocType] = useState<DocType | null>(null);
  const [files, setFiles] = useState<Record<Slot, File | null>>({ front: null, back: null, selfie: null });
  const [previews, setPreviews] = useState<Record<Slot, string | null>>({ front: null, back: null, selfie: null });
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    document.title = "Vérification d'identité · Nivra Telecom";
  }, []);

  // Revoke object URLs when they change / on unmount
  useEffect(() => {
    return () => {
      Object.values(previews).forEach((u) => u && URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) { setState("error"); setErr("Lien invalide."); return; }
      const { data, error } = await supabase.rpc("get_kyc_request_by_token", { p_token: token });
      if (!active) return;
      if (error) { setState("error"); setErr(error.message); return; }
      const row = (data as any[])?.[0];
      if (!row) { setState("error"); setErr("Ce lien est introuvable ou a été révoqué."); return; }
      setInfo({ orderNumber: row.order_number, planName: row.plan_name, expiresAt: row.expires_at });
      if (new Date(row.expires_at).getTime() < Date.now()) { setState("expired"); return; }
      if (row.status === "completed" || row.status === "approved") { setState("already"); return; }
      if (row.status === "rejected") { setState("error"); setErr("Cette demande a été refusée. Contactez-nous pour une nouvelle vérification."); return; }
      setState("ready");
    })();
    return () => { active = false; };
  }, [token]);

  const expiresLabel = useMemo(() => {
    if (!info?.expiresAt) return null;
    try {
      return new Date(info.expiresAt).toLocaleString("fr-CA", { dateStyle: "long", timeStyle: "short" });
    } catch { return null; }
  }, [info]);

  function setSlotFile(slot: Slot, file: File | null) {
    if (file && !file.type.startsWith("image/")) { setErr("Seules les photos sont acceptées."); return; }
    if (file && file.size > MAX_SIZE) { setErr("Photo trop volumineuse (max 10 Mo)."); return; }
    setErr(null);
    setFiles((prev) => ({ ...prev, [slot]: file }));
    setPreviews((prev) => {
      if (prev[slot]) URL.revokeObjectURL(prev[slot]!);
      return { ...prev, [slot]: file ? URL.createObjectURL(file) : null };
    });
  }

  const allUploaded = !!files.front && !!files.back && !!files.selfie;

  async function handleSubmit() {
    if (!token || !docType || !allUploaded || !confirmed) return;
    setState("uploading");
    setErr(null);
    try {
      const form = new FormData();
      form.append("token", token);
      form.append("document_type", docType);
      form.append("front", files.front!);
      form.append("back", files.back!);
      form.append("selfie", files.selfie!);

      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/kyc-public-upload`;
      const res = await fetch(url, {
        method: "POST",
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || `Échec (${res.status})`);
      setState("done");
    } catch (e: any) {
      setErr(e?.message || "Une erreur est survenue.");
      setState("ready");
    }
  }

  // Render terminal states inside a single shell
  if (state === "loading" || state === "expired" || state === "already" || state === "error" || state === "done") {
    return <Shell info={info}>{renderTerminal(state, err)}</Shell>;
  }

  // Wizard
  return (
    <Shell info={info}>
      <ProgressBar step={step} />

      {step === 1 && (
        <StepOne
          docType={docType}
          onPick={(t) => { setDocType(t); setStep(2); }}
        />
      )}

      {step === 2 && (
        <StepTwo
          files={files}
          previews={previews}
          onSet={setSlotFile}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          canNext={allUploaded}
          err={err}
        />
      )}

      {step === 3 && (
        <StepThree
          docType={docType}
          previews={previews}
          confirmed={confirmed}
          setConfirmed={setConfirmed}
          onBack={() => setStep(2)}
          onSubmit={handleSubmit}
          submitting={state === "uploading"}
          err={err}
        />
      )}

      {expiresLabel && (
        <p className="text-xs text-center text-slate-500 mt-6">Lien valide jusqu'au {expiresLabel}</p>
      )}
    </Shell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*                                  SUB-VIEWS                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

function Shell({ info, children }: { info: { orderNumber?: string; planName?: string } | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-start justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#7c3aed] text-white mb-3 shadow-lg shadow-[#7c3aed]/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Vérification d'identité</h1>
          {info?.orderNumber && (
            <p className="text-sm text-slate-500 mt-1">Commande #{info.orderNumber}{info?.planName ? ` · ${info.planName}` : ""}</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-7">
          {children}
        </div>

        <div className="mt-6 flex items-start gap-2 text-xs text-slate-500 px-2">
          <Lock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <p>Vos documents d'identité sont supprimés automatiquement après vérification. Nivra Telecom ne conserve aucune copie de vos pièces d'identité une fois la vérification terminée.</p>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ step }: { step: Step }) {
  const items = [
    { n: 1, label: "Document" },
    { n: 2, label: "Photos" },
    { n: 3, label: "Confirmation" },
  ];
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        {items.map((it, i) => (
          <div key={it.n} className="flex-1 flex items-center">
            <div className={`flex items-center gap-2 ${step >= it.n ? "text-[#7c3aed]" : "text-slate-400"}`}>
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${step >= it.n ? "bg-[#7c3aed] border-[#7c3aed] text-white" : "border-slate-300 bg-white"}`}>
                {step > it.n ? <CheckCircle2 className="h-4 w-4" /> : it.n}
              </div>
              <span className="text-xs sm:text-sm font-medium hidden sm:inline">{it.label}</span>
            </div>
            {i < items.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${step > it.n ? "bg-[#7c3aed]" : "bg-slate-200"}`} />
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 text-center sm:hidden">Étape {step} sur 3</p>
    </div>
  );
}

function StepOne({ docType, onPick }: { docType: DocType | null; onPick: (t: DocType) => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Quel type de document allez-vous utiliser ?</h2>
      <p className="text-sm text-slate-500 mb-5">Choisissez une pièce d'identité gouvernementale valide avec photo.</p>

      <div className="space-y-3">
        {DOC_OPTIONS.map(({ id, label, sub, Icon }) => {
          const active = docType === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                active
                  ? "border-[#7c3aed] bg-[#7c3aed]/5 shadow-sm"
                  : "border-slate-200 bg-white hover:border-[#7c3aed]/40 hover:bg-slate-50"
              }`}
            >
              <div className={`h-11 w-11 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? "bg-[#7c3aed] text-white" : "bg-slate-100 text-slate-600"}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepTwo({
  files, previews, onSet, onBack, onNext, canNext, err,
}: {
  files: Record<Slot, File | null>;
  previews: Record<Slot, string | null>;
  onSet: (slot: Slot, file: File | null) => void;
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
  err: string | null;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Téléversez 3 photos</h2>
      <p className="text-sm text-slate-500 mb-5">Assurez-vous que les photos sont nettes, bien éclairées et que tout le texte est lisible.</p>

      <div className="space-y-4">
        <UploadSlot
          slot="front"
          label="Photo du recto de votre document"
          help="Côté avec votre photo et nom"
          icon={<IdCard className="h-5 w-5" />}
          file={files.front}
          preview={previews.front}
          onChange={(f) => onSet("front", f)}
        />
        <UploadSlot
          slot="back"
          label="Photo du verso de votre document"
          help="Côté arrière (signature, code-barres, etc.)"
          icon={<IdCard className="h-5 w-5 rotate-180" />}
          file={files.back}
          preview={previews.back}
          onChange={(f) => onSet("back", f)}
        />
        <UploadSlot
          slot="selfie"
          label="Selfie en tenant votre document visible"
          help="Votre visage et le document doivent être visibles dans la même photo"
          icon={<UserIcon className="h-5 w-5" />}
          file={files.selfie}
          preview={previews.selfie}
          onChange={(f) => onSet("selfie", f)}
        />
      </div>

      {err && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 mt-4">{err}</div>
      )}

      <div className="flex items-center justify-between gap-3 mt-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-lg bg-[#7c3aed] text-white font-semibold px-5 py-2.5 text-sm hover:bg-[#6d28d9] disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          Continuer <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function UploadSlot({
  label, help, icon, file, preview, onChange,
}: {
  slot: Slot;
  label: string;
  help: string;
  icon: React.ReactNode;
  file: File | null;
  preview: string | null;
  onChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasFile = !!file && !!preview;

  return (
    <div className={`rounded-xl border-2 transition-all ${hasFile ? "border-emerald-300 bg-emerald-50/30" : "border-dashed border-slate-300 bg-slate-50 hover:border-[#7c3aed]/40 hover:bg-slate-100"}`}>
      {hasFile ? (
        <div className="flex items-center gap-3 p-3">
          <img src={preview!} alt={label} className="h-20 w-20 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{label}</p>
            <p className="text-xs text-slate-500 truncate">{file!.name} · {(file!.size / 1024).toFixed(0)} Ko</p>
            <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium mt-0.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Téléversé
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="h-8 w-8 rounded-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0"
            aria-label="Retirer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center gap-3 p-4 text-left"
        >
          <div className="h-11 w-11 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#7c3aed] flex-shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">{label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{help}</p>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[#7c3aed] text-white text-xs font-semibold px-3 py-1.5">
            <Upload className="h-3.5 w-3.5" /> Choisir
          </div>
          <Camera className="h-5 w-5 text-slate-400 sm:hidden flex-shrink-0" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function StepThree({
  docType, previews, confirmed, setConfirmed, onBack, onSubmit, submitting, err,
}: {
  docType: DocType | null;
  previews: Record<Slot, string | null>;
  confirmed: boolean;
  setConfirmed: (v: boolean) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  err: string | null;
}) {
  const docLabel = DOC_OPTIONS.find((d) => d.id === docType)?.label || "Document";
  const thumbs: { slot: Slot; label: string }[] = [
    { slot: "front",  label: "Recto" },
    { slot: "back",   label: "Verso" },
    { slot: "selfie", label: "Selfie" },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Confirmez votre soumission</h2>
      <p className="text-sm text-slate-500 mb-5">Vérifiez que les 3 photos sont nettes et lisibles avant de soumettre.</p>

      <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 mb-4 text-sm">
        <span className="text-slate-500">Type de document :</span>{" "}
        <span className="font-semibold text-slate-900">{docLabel}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        {thumbs.map(({ slot, label }) => (
          <div key={slot} className="space-y-1.5">
            <div className="aspect-[3/4] rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
              {previews[slot] ? (
                <img src={previews[slot]!} alt={label} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <AlertCircle className="h-5 w-5" />
                </div>
              )}
            </div>
            <p className="text-xs text-center font-medium text-slate-600">{label}</p>
          </div>
        ))}
      </div>

      <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-200 bg-white hover:bg-slate-50 p-3 transition-colors">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#7c3aed] focus:ring-[#7c3aed]"
        />
        <span className="text-sm text-slate-700">
          Je confirme que ces documents sont les miens et sont valides.
        </span>
      </label>

      {err && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 mt-4">{err}</div>
      )}

      <div className="flex items-center justify-between gap-3 mt-6">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!confirmed || submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-[#7c3aed] text-white font-semibold px-5 py-2.5 text-sm hover:bg-[#6d28d9] disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</>
          ) : (
            <>Soumettre <ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}

function renderTerminal(state: State, err: string | null) {
  if (state === "loading") {
    return (
      <div className="flex items-center justify-center py-10 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }
  if (state === "expired") {
    return (
      <div className="text-center py-6">
        <AlertCircle className="h-10 w-10 mx-auto text-red-500 mb-3" />
        <h2 className="text-lg font-semibold text-slate-900">Lien expiré</h2>
        <p className="text-sm text-slate-500 mt-2">
          Ce lien de vérification n'est plus valide. Contactez notre équipe à{" "}
          <a className="text-[#7c3aed] underline" href="mailto:support@nivra-telecom.ca">support@nivra-telecom.ca</a>{" "}
          pour recevoir un nouveau lien.
        </p>
      </div>
    );
  }
  if (state === "already") {
    return (
      <div className="text-center py-6">
        <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
        <h2 className="text-lg font-semibold text-slate-900">Vérification déjà reçue</h2>
        <p className="text-sm text-slate-500 mt-2">Votre pièce d'identité a déjà été soumise. Vous recevrez une confirmation par courriel une fois validée.</p>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="text-center py-6">
        <AlertCircle className="h-10 w-10 mx-auto text-red-500 mb-3" />
        <h2 className="text-lg font-semibold text-slate-900">Lien invalide</h2>
        <p className="text-sm text-slate-500 mt-2">{err}</p>
      </div>
    );
  }
  // done
  return (
    <div className="text-center py-6">
      <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
      <h2 className="text-lg font-semibold text-slate-900">Documents reçus ✓</h2>
      <p className="text-sm text-slate-500 mt-2">
        Merci. Notre équipe vérifiera votre identité dans les meilleurs délais et vous recevrez une confirmation par courriel.
      </p>
    </div>
  );
}
