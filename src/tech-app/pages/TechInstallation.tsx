/**
 * TechInstallation — Step-by-step wizard for a single installation.
 * Mobile-first, large touch targets, supports notes, coaxial state, network test results.
 */
import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Camera, ScanLine, Gauge, CheckCircle2, AlertTriangle, Loader2, PackageCheck, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TechTopBar from "../components/TechTopBar";
import { Textarea } from "@/components/ui/textarea";
import { useTechAssignment, useInstallationSteps } from "../lib/useTechAssignments";

const COAX_OPTIONS = [
  { v: "good", label: "✅ Bon état", c: "bg-emerald-600/20 border-emerald-600/50 text-emerald-300" },
  { v: "degraded", label: "⚠️ Dégradé", c: "bg-yellow-600/20 border-yellow-600/50 text-yellow-300" },
  { v: "damaged", label: "❌ Endommagé", c: "bg-red-600/20 border-red-600/50 text-red-300" },
  { v: "absent", label: "➖ Absent / N/A", c: "bg-slate-700/40 border-slate-600 text-slate-300" },
];

export default function TechInstallation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: assignment, isLoading } = useTechAssignment(id);
  const { data: steps = [] } = useInstallationSteps(assignment?.service_type);
  const [stepIdx, setStepIdx] = useState(0);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [coax, setCoax] = useState<string>(assignment?.coaxial_status ?? "");
  const [coaxNotes, setCoaxNotes] = useState<string>(assignment?.coaxial_notes ?? "");
  const [notes, setNotes] = useState<string>(assignment?.technician_notes ?? "");
  const [download, setDownload] = useState("");
  const [upload, setUpload] = useState("");
  const [ping, setPing] = useState("");
  const [signal, setSignal] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [scannedEquipment, setScannedEquipment] = useState<any[]>([]);

  const totalSteps = steps.length;
  const progress = totalSteps ? Math.round(((stepIdx + 1) / totalSteps) * 100) : 0;

  const mandatoryCount = useMemo(
    () => steps.filter((s: any) => s.is_mandatory).length,
    [steps],
  );
  const doneMandatory = useMemo(
    () =>
      Array.from(doneSteps).filter((i) => steps[i]?.is_mandatory).length,
    [doneSteps, steps],
  );

  const existingScanned = useMemo(
    () => Array.isArray(assignment?.equipment_scanned) ? assignment.equipment_scanned : [],
    [assignment?.equipment_scanned],
  );

  const allScannedEquipment = useMemo(
    () => [...existingScanned, ...scannedEquipment],
    [existingScanned, scannedEquipment],
  );

  const scanEquipment = async () => {
    const code = scanCode.trim();
    if (!code) return;
    if (allScannedEquipment.some((e: any) => e.serial_number === code || e.mac_address === code)) {
      toast.info("Équipement déjà scanné");
      setScanCode("");
      return;
    }
    const { data, error } = await supabase
      .from("equipment_inventory")
      .select("id, catalog_name, category, serial_number, mac_address, status")
      .or(`serial_number.eq.${code},mac_address.eq.${code}`)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data) {
      toast.error("Équipement introuvable dans l'inventaire");
      return;
    }
    setScannedEquipment((items) => [
      ...items,
      { ...data, scanned_at: new Date().toISOString(), source: "installation" },
    ]);
    setScanCode("");
    toast.success("Équipement ajouté à l'installation");
  };

  const complete = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("ID manquant");
      const payload: any = {
        status: "completed",
        technician_notes: notes || null,
        coaxial_status: coax || null,
        coaxial_notes: coaxNotes || null,
        installation_steps: Array.from(doneSteps).map((i) => ({
          step_order: steps[i]?.step_order,
          title: steps[i]?.title_fr,
        })),
        equipment_scanned: allScannedEquipment,
      };
      if (download) payload.download_speed = parseFloat(download);
      if (upload) payload.upload_speed = parseFloat(upload);
      if (ping) payload.ping_ms = parseInt(ping, 10);
      if (signal) payload.signal_strength = parseInt(signal, 10);
      if (download || upload || ping) {
        payload.network_test_results = {
          download_mbps: download ? parseFloat(download) : null,
          upload_mbps: upload ? parseFloat(upload) : null,
          ping_ms: ping ? parseInt(ping, 10) : null,
          tested_at: new Date().toISOString(),
        };
      }
      const { error } = await supabase.from("technician_assignments").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tech-assignments-self"] });
      qc.invalidateQueries({ queryKey: ["tech-assignment", id] });
      toast.success("Installation complétée — service activé!");
      setTimeout(() => navigate("/tech/assignments"), 800);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const markMissed = useMutation({
    mutationFn: async () => {
      const reason = window.prompt("Raison du rendez-vous manqué :", "");
      if (reason === null) return;
      if (!id) return;
      const { error } = await supabase
        .from("technician_assignments")
        .update({
          status: "missed",
          missed_at: new Date().toISOString(),
          technician_notes: reason,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tech-assignments-self"] });
      toast.success("Marqué comme manqué");
      navigate("/tech/assignments");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }
  if (!assignment) {
    return (
      <div>
        <TechTopBar title="Installation" back />
        <p className="text-center text-slate-400 py-12">Assignation introuvable.</p>
      </div>
    );
  }

  const currentStep = steps[stepIdx];
  const allMandatoryDone = doneMandatory >= mandatoryCount;
  const canComplete = allMandatoryDone && (assignment.service_type !== "internet" || !!coax);

  return (
    <div>
      <TechTopBar title={`Installation #${assignment.order_number ?? ""}`} back />
      <div className="px-4 py-4 space-y-4">
        {/* Client header */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <p className="text-base font-bold text-white">{assignment.client_name}</p>
          {assignment.client_address && (
            <p className="text-sm text-slate-400 mt-1">{assignment.client_address}</p>
          )}
          {assignment.client_phone && (
            <a href={`tel:${assignment.client_phone}`} className="text-sm text-violet-400 mt-2 inline-block">
              📞 {assignment.client_phone}
            </a>
          )}
          <p className="text-xs text-slate-500 mt-2 capitalize">
            {assignment.service_type} {assignment.category && `· ${assignment.category}`}
          </p>
        </section>

        {/* Progress */}
        {totalSteps > 0 && (
          <section>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Étape {stepIdx + 1} sur {totalSteps}</span>
              <span>{doneMandatory}/{mandatoryCount} obligatoires</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </section>
        )}

        {/* Current step */}
        {currentStep && (
          <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
            <div>
              <p className="text-xs text-violet-400 font-semibold uppercase mb-1">
                Étape {currentStep.step_order}
                {currentStep.is_mandatory && " · Obligatoire"}
              </p>
              <h3 className="text-lg font-bold text-white">{currentStep.title_fr}</h3>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">{currentStep.description_fr}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {currentStep.requires_photo && (
                <button className="min-h-[48px] flex-1 rounded-full bg-slate-800 border border-slate-700 px-4 text-sm font-medium text-white flex items-center justify-center gap-2">
                  <Camera className="h-4 w-4" /> Photo
                </button>
              )}
              {currentStep.requires_scan && (
                <button className="min-h-[48px] flex-1 rounded-full bg-slate-800 border border-slate-700 px-4 text-sm font-medium text-white flex items-center justify-center gap-2">
                  <ScanLine className="h-4 w-4" /> Scanner
                </button>
              )}
              {currentStep.requires_test && (
                <button className="min-h-[48px] flex-1 rounded-full bg-slate-800 border border-slate-700 px-4 text-sm font-medium text-white flex items-center justify-center gap-2">
                  <Gauge className="h-4 w-4" /> Test
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                disabled={stepIdx === 0}
                className="min-h-[48px] rounded-full bg-slate-800 text-white text-sm font-semibold disabled:opacity-40"
              >
                ← Précédent
              </button>
              <button
                onClick={() => {
                  setDoneSteps((s) => new Set(s).add(stepIdx));
                  if (stepIdx < totalSteps - 1) setStepIdx(stepIdx + 1);
                }}
                className="min-h-[48px] rounded-full bg-violet-600 text-white text-sm font-semibold"
              >
                {doneSteps.has(stepIdx) ? "✓ Fait" : "Marquer fait →"}
              </button>
            </div>
          </section>
        )}

        {/* Coaxial */}
        {(assignment.service_type === "internet" || assignment.service_type === "bundle") && (
          <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">État du câble coaxial</h3>
            <div className="grid grid-cols-2 gap-2">
              {COAX_OPTIONS.map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setCoax(opt.v)}
                  className={`min-h-[56px] rounded-xl border-2 text-sm font-semibold transition-all ${
                    coax === opt.v ? opt.c + " ring-2 ring-white/20" : "bg-slate-800/50 border-slate-700 text-slate-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Textarea
              value={coaxNotes}
              onChange={(e) => setCoaxNotes(e.target.value)}
              placeholder="Notes sur le coaxial..."
              rows={2}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </section>
        )}

        {/* Network test */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Test réseau</h3>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Download (Mbps)" value={download} onChange={setDownload} />
            <InputField label="Upload (Mbps)" value={upload} onChange={setUpload} />
            <InputField label="Ping (ms)" value={ping} onChange={setPing} />
            <InputField label="Signal (%)" value={signal} onChange={setSignal} />
          </div>
        </section>

        {/* Notes */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-2">Notes</h3>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes générales sur l'installation..."
            rows={3}
            className="bg-slate-800 border-slate-700 text-white"
          />
        </section>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            disabled={!canComplete || complete.isPending}
            onClick={() => {
              if (window.confirm("Confirmer la complétion de l'installation ?")) {
                complete.mutate();
              }
            }}
            className="w-full min-h-[60px] rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {complete.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
            Marquer l'installation complète
          </button>
          {!canComplete && (
            <p className="text-xs text-slate-400 text-center">
              Complétez toutes les étapes obligatoires{assignment.service_type === "internet" && " et l'état coaxial"}.
            </p>
          )}
          <button
            disabled={markMissed.isPending}
            onClick={() => markMissed.mutate()}
            className="w-full min-h-[56px] rounded-full bg-red-600/20 border border-red-600/50 text-red-300 text-base font-semibold flex items-center justify-center gap-2"
          >
            <AlertTriangle className="h-5 w-5" />
            Rendez-vous manqué
          </button>
        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-400 block mb-1">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[44px] rounded-lg bg-slate-800 border border-slate-700 text-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    </label>
  );
}
