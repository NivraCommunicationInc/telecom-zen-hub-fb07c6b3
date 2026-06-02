/**
 * Public Onboarding Form for hired employees.
 * Route: /onboarding/:token (no auth)
 * Multi-step submission to onboarding-form-submit edge function.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, ShieldCheck, CheckCircle2, AlertTriangle, Upload, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const PROVINCES = ["QC", "ON", "BC", "AB", "MB", "SK", "NS", "NB", "NL", "PE", "YT", "NT", "NU"];
const POSTAL_RE = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[0-9+()\-.\s]{7,}$/;

type Step = 1 | 2 | 3 | 4 | 5;

export default function OnboardingForm() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState<any | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // form state
  const [fullLegalName, setFullLegalName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrProv, setAddrProv] = useState("QC");
  const [addrPostal, setAddrPostal] = useState("");
  const [residential, setResidential] = useState("");
  const [residentialOther, setResidentialOther] = useState("");
  const [idDocType, setIdDocType] = useState("passport");
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [permitFile, setPermitFile] = useState<File | null>(null);
  const [chequeFile, setChequeFile] = useState<File | null>(null);
  const [bankAccountName, setBankAccountName] = useState("");
  const [confirmCheck, setConfirmCheck] = useState(false);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sigDrawn, setSigDrawn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { setErrorMsg("Lien invalide."); setLoading(false); return; }
      const { data, error } = await supabase.rpc("get_onboarding_form_by_token", { p_token: token });
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setErrorMsg("Ce lien est invalide ou introuvable.");
        setLoading(false);
        return;
      }
      const row = (data as any[])[0];
      if (new Date(row.token_expires_at).getTime() < Date.now()) {
        setErrorMsg("Ce lien a expiré. Contactez support@nivra-telecom.ca");
        setLoading(false);
        return;
      }
      if (row.status === "submitted" || row.status === "reviewed") {
        setMeta(row);
        setSubmitted(true);
        setLoading(false);
        return;
      }
      setMeta(row);
      // Pre-fill from applicant
      setFullLegalName([row.applicant_first_name, row.applicant_last_name].filter(Boolean).join(" "));
      setEmail(row.applicant_email || "");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Signature pad
  useEffect(() => {
    const canvas = sigCanvasRef.current;
    if (!canvas || step !== 5) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0f172a";
    ctx.lineCap = "round";
    let drawing = false;
    let last: { x: number; y: number } | null = null;
    const rect = () => canvas.getBoundingClientRect();
    const getPos = (e: any) => {
      const r = rect();
      const x = (e.touches?.[0]?.clientX ?? e.clientX) - r.left;
      const y = (e.touches?.[0]?.clientY ?? e.clientY) - r.top;
      return { x, y };
    };
    const start = (e: any) => { e.preventDefault(); drawing = true; last = getPos(e); };
    const move = (e: any) => {
      if (!drawing) return;
      e.preventDefault();
      const p = getPos(e);
      if (last) { ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      last = p;
      setSigDrawn(true);
    };
    const end = () => { drawing = false; last = null; };
    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, [step]);

  const clearSig = () => {
    const c = sigCanvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setSigDrawn(false);
  };

  const ageOk = useMemo(() => {
    if (!dob) return false;
    const d = new Date(dob);
    const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    return age >= 18 && age < 100;
  }, [dob]);

  const step1Valid =
    fullLegalName.trim().length >= 3 && ageOk &&
    PHONE_RE.test(phone) && EMAIL_RE.test(email) &&
    addrStreet.trim() && addrCity.trim() && POSTAL_RE.test(addrPostal);

  const step2Valid =
    !!residential &&
    (residential !== "other" || residentialOther.trim().length > 0) &&
    ((residential !== "work_permit" && residential !== "study_permit") || !!permitFile);

  const step3Valid = !!idDocFile && !!chequeFile;
  const step4Valid = true; // bank name optional
  const step5Valid = confirmCheck && sigDrawn;

  const goNext = () => {
    const ok = step === 1 ? step1Valid : step === 2 ? step2Valid : step === 3 ? step3Valid : step === 4 ? step4Valid : false;
    if (!ok) { toast.error("Veuillez compléter les champs requis."); return; }
    setStep((s) => (Math.min(5, (s as number) + 1) as Step));
  };

  const goBack = () => setStep((s) => (Math.max(1, (s as number) - 1) as Step));

  const handleSubmit = async () => {
    if (!step5Valid) { toast.error("Signature et confirmation requises."); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("token", token!);
      const sigData = sigCanvasRef.current?.toDataURL("image/png") ?? "";
      const payload = {
        full_legal_name: fullLegalName.trim(),
        date_of_birth: dob,
        phone: phone.trim(),
        email: email.trim(),
        address_street: addrStreet.trim(),
        address_city: addrCity.trim(),
        address_province: addrProv,
        address_postal: addrPostal.trim().toUpperCase(),
        residential_status: residential,
        residential_status_other: residential === "other" ? residentialOther.trim() : null,
        id_document_type: idDocType,
        bank_account_name: bankAccountName.trim() || null,
        signature_data: sigData,
        language: "fr",
      };
      fd.set("payload", JSON.stringify(payload));
      if (idDocFile) fd.set("id_document", idDocFile);
      if (permitFile) fd.set("work_permit", permitFile);
      if (chequeFile) fd.set("void_cheque", chequeFile);

      const { data, error } = await supabase.functions.invoke("onboarding-form-submit", { body: fd });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      toast.error("Erreur de soumission", { description: e.message || String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ background: '#020209' }} className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={{ background: '#020209' }} className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-6 max-w-md text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <h1 className="text-lg font-bold">Lien non valide</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </Card>
      </div>
    );
  }

  if (submitted) {
    const firstName = (meta?.applicant_first_name || meta?.full_legal_name?.split(" ")[0] || "").trim();
    return (
      <div style={{ background: '#020209' }} className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 max-w-lg text-center space-y-4">
          <CheckCircle2 className="h-14 w-14 text-emerald-600 mx-auto" />
          <h1 className="text-2xl font-bold">Merci{firstName ? ` ${firstName}` : ""}!</h1>
          <p className="text-sm text-muted-foreground">
            Votre dossier d&apos;embauche a bien été soumis. Notre équipe RH va vous contacter sous 24 à 48 heures avec les prochaines étapes (formation, territoire, trousse de départ).
          </p>
          <p className="text-xs text-muted-foreground">
            Une copie de confirmation a été envoyée à votre adresse courriel.
          </p>
        </Card>
      </div>
    );
  }

  const stepLabels = [
    "Informations personnelles",
    "Statut résidentiel",
    "Documents",
    "Dépôt direct",
    "Signature & confirmation",
  ];

  return (
    <div style={{ background: '#020209' }} className="relative min-h-screen py-6 px-3 overflow-hidden">
      <div aria-hidden style={{ position: 'absolute', top: '-15%', right: '-8%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.13) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-6%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
      <div className="relative max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
            <ShieldCheck className="h-3.5 w-3.5" /> Formulaire sécurisé
          </div>
          <h1 className="text-xl font-bold">Formulaire d&apos;embauche — Nivra Telecom</h1>
          <p className="text-xs text-muted-foreground">Étape {step} sur 5 — {stepLabels[step - 1]}</p>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${(step / 5) * 100}%` }} />
        </div>

        <Card className="p-5 space-y-4">
          {step === 1 && (
            <>
              <div className="grid gap-3">
                <div>
                  <Label>Nom complet légal *</Label>
                  <Input value={fullLegalName} onChange={(e) => setFullLegalName(e.target.value)} placeholder="Tel qu'il apparait sur votre pièce d'identité" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date de naissance *</Label>
                    <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                    {dob && !ageOk && <p className="text-[11px] text-red-600 mt-1">Vous devez avoir 18 ans ou plus.</p>}
                  </div>
                  <div>
                    <Label>Téléphone *</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(514) 555-0123" />
                  </div>
                </div>
                <div>
                  <Label>Courriel personnel *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label>Adresse (rue, numéro) *</Label>
                  <Input value={addrStreet} onChange={(e) => setAddrStreet(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label>Ville *</Label>
                    <Input value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
                  </div>
                  <div>
                    <Label>Province *</Label>
                    <Select value={addrProv} onValueChange={setAddrProv}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Code postal * (format A1A 1A1)</Label>
                  <Input value={addrPostal} onChange={(e) => setAddrPostal(e.target.value.toUpperCase())} placeholder="H1A 1A1" />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Label>Statut résidentiel *</Label>
              <RadioGroup value={residential} onValueChange={setResidential}>
                {[
                  ["citizen", "Citoyen canadien"],
                  ["permanent_resident", "Résident permanent"],
                  ["work_permit", "Permis de travail"],
                  ["study_permit", "Permis d'études avec autorisation de travail"],
                  ["other", "Autre"],
                ].map(([val, lbl]) => (
                  <div key={val} className="flex items-center gap-2">
                    <RadioGroupItem id={`rs-${val}`} value={val} />
                    <Label htmlFor={`rs-${val}`} className="cursor-pointer">{lbl}</Label>
                  </div>
                ))}
              </RadioGroup>
              {residential === "other" && (
                <Input value={residentialOther} onChange={(e) => setResidentialOther(e.target.value)} placeholder="Précisez" />
              )}
              {(residential === "work_permit" || residential === "study_permit") && (
                <div className="border rounded p-3 space-y-2">
                  <Label className="flex items-center gap-2"><Upload className="h-3.5 w-3.5" /> Document de permis *</Label>
                  <Input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setPermitFile(e.target.files?.[0] ?? null)} />
                  {permitFile && <p className="text-[11px] text-emerald-600">✓ {permitFile.name} ({(permitFile.size / 1024).toFixed(0)} KB)</p>}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="border rounded p-3 space-y-2">
                <Label>Pièce d&apos;identité gouvernementale *</Label>
                <p className="text-[11px] text-muted-foreground">Passeport ou permis de conduire (recto et verso). JPG, PNG ou PDF, max 10MB.</p>
                <Select value={idDocType} onValueChange={setIdDocType}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passeport</SelectItem>
                    <SelectItem value="drivers_license">Permis de conduire</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setIdDocFile(e.target.files?.[0] ?? null)} />
                {idDocFile && <p className="text-[11px] text-emerald-600">✓ {idDocFile.name} ({(idDocFile.size / 1024).toFixed(0)} KB)</p>}
              </div>

              <div className="border rounded p-3 space-y-2">
                <Label>Spécimen de chèque annulé *</Label>
                <p className="text-[11px] text-muted-foreground">Pour le dépôt direct de vos commissions chaque vendredi. JPG, PNG ou PDF, max 10MB.</p>
                <Input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(e) => setChequeFile(e.target.files?.[0] ?? null)} />
                {chequeFile && <p className="text-[11px] text-emerald-600">✓ {chequeFile.name} ({(chequeFile.size / 1024).toFixed(0)} KB)</p>}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <Card className="p-3 bg-primary/5 border-primary/30">
                <p className="text-sm">
                  Vos commissions sont versées chaque <strong>vendredi par dépôt direct</strong>.
                  Le spécimen de chèque fourni à l&apos;étape précédente sera utilisé.
                </p>
              </Card>
              {chequeFile && (
                <p className="text-xs text-muted-foreground">Spécimen de chèque téléversé : <strong>{chequeFile.name}</strong></p>
              )}
              <div>
                <Label>Nom sur le compte bancaire (optionnel)</Label>
                <Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="Identique au spécimen" />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <Card className="p-3 bg-muted/30">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Résumé</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div><span className="text-muted-foreground">Nom :</span> {fullLegalName}</div>
                  <div><span className="text-muted-foreground">DDN :</span> {dob}</div>
                  <div><span className="text-muted-foreground">Tél :</span> {phone}</div>
                  <div><span className="text-muted-foreground">Courriel :</span> {email}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Adresse :</span> {addrStreet}, {addrCity}, {addrProv} {addrPostal}</div>
                  <div><span className="text-muted-foreground">Statut :</span> {residential}{residential === "other" ? ` — ${residentialOther}` : ""}</div>
                  <div><span className="text-muted-foreground">Pièce ID :</span> {idDocType}</div>
                </div>
              </Card>

              <div>
                <Label className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Signature électronique *</Label>
                <p className="text-[11px] text-muted-foreground mb-1">Signez ci-dessous avec votre souris ou doigt.</p>
                <canvas
                  ref={sigCanvasRef}
                  width={520}
                  height={140}
                  className="border rounded bg-white w-full touch-none"
                  style={{ maxWidth: "100%" }}
                />
                <Button type="button" variant="ghost" size="sm" onClick={clearSig} className="mt-1 text-[11px]">Effacer la signature</Button>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox id="confirm" checked={confirmCheck} onCheckedChange={(c) => setConfirmCheck(!!c)} className="mt-1" />
                <Label htmlFor="confirm" className="text-xs cursor-pointer leading-relaxed">
                  Je, <strong>{fullLegalName || "[nom complet]"}</strong>, confirme que toutes les informations fournies sont exactes et complètes. En soumettant ce formulaire, j&apos;accepte que Nivra Telecom conserve ces informations pour les besoins de mon emploi conformément à la Loi 25 sur la protection des données.
                </Label>
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="flex justify-between pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={goBack} disabled={step === 1 || submitting}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Précédent
            </Button>
            {step < 5 ? (
              <Button type="button" size="sm" onClick={goNext}>
                Suivant <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={handleSubmit} disabled={!step5Valid || submitting}>
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                Soumettre mon dossier
              </Button>
            )}
          </div>
        </Card>

        <p className="text-[10px] text-center text-muted-foreground">
          🔒 Connexion sécurisée et chiffrée. Lien personnel — ne le partagez pas.
        </p>
      </div>
    </div>
  );
}
