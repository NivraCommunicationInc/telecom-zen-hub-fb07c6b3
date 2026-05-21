/**
 * TechInstallation — Mobile-first installation wizard for one assignment.
 * Includes: camera photo capture, QR/barcode scanner, signature pad,
 * step-by-step progression, network test, coaxial state, technician notes,
 * offline indicator, reschedule dialog, and post-completion summary.
 */
import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Camera, ScanLine, Gauge, CheckCircle2, AlertTriangle, Loader2,
  PackageCheck, X, MapPin, Phone, Clock, Wrench, Truck, RotateCcw,
  PenTool, FileText,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TechTopBar from "../components/TechTopBar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useTechAssignment, useInstallationSteps } from "../lib/useTechAssignments";
import PhotoCapture from "../components/PhotoCapture";
import QRScanner from "../components/QRScanner";
import SignaturePad from "../components/SignaturePad";
import OfflineIndicator from "../components/OfflineIndicator";
import { queueTechEmail } from "../lib/queueTechEmail";

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
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [coax, setCoax] = useState<string>(assignment?.coaxial_status ?? "");
  const [coaxNotes, setCoaxNotes] = useState<string>(assignment?.coaxial_notes ?? "");
  const [notes, setNotes] = useState<string>(assignment?.technician_notes ?? "");
  const [download, setDownload] = useState("");
  const [upload, setUpload] = useState("");
  const [ping, setPing] = useState("");
  const [signal, setSignal] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [scannedEquipment, setScannedEquipment] = useState<any[]>([]);
  const [photos, setPhotos] = useState<{ url: string; step: string; at: string }[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("09:00");
  const [missingFor, setMissingFor] = useState(false);
  const [missReason, setMissReason] = useState("");
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [summary, setSummary] = useState<null | Record<string, any>>(null);

  const totalSteps = steps.length;
  const progress = totalSteps ? Math.round(((stepIdx + 1) / totalSteps) * 100) : 0;

  const mandatoryCount = useMemo(
    () => steps.filter((s: any) => s.is_mandatory).length,
    [steps],
  );
  const doneMandatory = useMemo(
    () => Array.from(completedSteps).filter((i) => steps[i]?.is_mandatory).length,
    [completedSteps, steps],
  );

  const existingScanned = useMemo(
    () => Array.isArray(assignment?.equipment_scanned) ? assignment.equipment_scanned : [],
    [assignment?.equipment_scanned],
  );

  useEffect(() => {
    if (!assignment) return;
    setCoax(assignment.coaxial_status ?? "");
    setCoaxNotes(assignment.coaxial_notes ?? "");
    setNotes(assignment.technician_notes ?? "");
    setDownload(assignment.download_speed ? String(assignment.download_speed) : "");
    setUpload(assignment.upload_speed ? String(assignment.upload_speed) : "");
    setPing(assignment.ping_ms ? String(assignment.ping_ms) : "");
    setSignal(assignment.signal_strength ? String(assignment.signal_strength) : "");
  }, [assignment?.id]);

  const allScannedEquipment = useMemo(
    () => [...existingScanned, ...scannedEquipment],
    [existingScanned, scannedEquipment],
  );

  const serviceLabels = useMemo(
    () => [
      assignment?.service_type,
      assignment?.category,
      ...(assignment?.order_items ?? []).map((item: any) => item.plan_name || item.description).filter(Boolean),
    ].filter(Boolean),
    [assignment?.service_type, assignment?.category, assignment?.order_items],
  );

  const plannedEquipment = useMemo(() => {
    if (Array.isArray(assignment?.equipment_details)) return assignment.equipment_details;
    if (assignment?.equipment_details) return [assignment.equipment_details];
    return [];
  }, [assignment?.equipment_details]);

  const setFieldStatus = useMutation({
    mutationFn: async ({ status, note, eta }: { status: string; note?: string | null; eta?: string | null }) => {
      if (!id) throw new Error("ID manquant");
      const { error } = await (supabase.rpc as any)("tech_update_assignment_status", {
        p_assignment_id: id,
        p_status: status,
        p_note: note ?? null,
        p_eta: eta ?? null,
      });
      if (error) throw error;

      // Queue corresponding email to the client
      if (assignment?.order_id) {
        if (status === "en_route") {
          await queueTechEmail({
            assignmentId: id, orderId: assignment.order_id,
            templateKey: "tech_en_route", extraVars: { eta: eta || "30-45 minutes" },
          });
        } else if (status === "arrived") {
          await queueTechEmail({
            assignmentId: id, orderId: assignment.order_id,
            templateKey: "tech_arrived",
            extraVars: { arrival_time: new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) },
          });
        } else if (status === "in_progress") {
          if (!startedAt) setStartedAt(new Date().toISOString());
          await queueTechEmail({
            assignmentId: id, orderId: assignment.order_id,
            templateKey: "tech_in_progress",
            extraVars: { start_time: new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) },
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tech-assignments-all"] });
      qc.invalidateQueries({ queryKey: ["tech-assignment", id] });
      toast.success("Statut rendez-vous mis à jour");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const handleManualScan = async () => {
    const code = scanCode.trim();
    if (!code) return;
    if (allScannedEquipment.some((e: any) => e.serial_number === code || e.mac_address === code || e.serial === code)) {
      toast.info("Équipement déjà scanné");
      setScanCode("");
      return;
    }
    // Try inventory match; otherwise store as raw serial
    const { data } = await supabase
      .from("equipment_inventory")
      .select("id, catalog_name, category, serial_number, mac_address, status")
      .or(`serial_number.eq.${code},mac_address.eq.${code}`)
      .maybeSingle();

    const entry = data
      ? { ...data, scanned_at: new Date().toISOString(), source: "installation" }
      : { serial: code, serial_number: code, catalog_name: "Équipement", scanned_at: new Date().toISOString(), source: "manual" };

    setScannedEquipment((items) => [...items, entry]);
    setScanCode("");
    toast.success("✅ Équipement associé au compte");
  };

  const handleQrScan = (value: string) => {
    setShowScanner(false);
    if (!value) return;
    const stepTitle = steps[stepIdx]?.title_fr || "Étape";
    if (allScannedEquipment.some((e: any) => e.serial_number === value || e.serial === value || e.mac_address === value)) {
      toast.info("Équipement déjà scanné");
      return;
    }
    setScannedEquipment((items) => [
      ...items,
      { serial: value, serial_number: value, step: stepTitle, scanned_at: new Date().toISOString(), source: "qr_scan" },
    ]);
    toast.success("✅ Équipement associé au compte");
  };

  const onPhotoCaptured = (url: string) => {
    const stepTitle = steps[stepIdx]?.title_fr || "Étape";
    setPhotos((p) => [...p, { url, step: stepTitle, at: new Date().toISOString() }]);
  };

  const complete = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("ID manquant");
      const finishedAt = new Date().toISOString();
      const payload: any = {
        technician_notes: notes || null,
        coaxial_status: coax || null,
        coaxial_notes: coaxNotes || null,
        installation_steps: Array.from(completedSteps).map((i) => ({
          step_order: steps[i]?.step_order,
          title: steps[i]?.title_fr,
          completed_at: finishedAt,
        })),
        equipment_scanned: allScannedEquipment,
        installation_photos: [
          ...(Array.isArray((assignment as any)?.installation_photos) ? (assignment as any).installation_photos : []),
          ...photos,
          ...(signature ? [{ url: signature, step: "Signature client", at: finishedAt, kind: "signature" }] : []),
        ],
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
          tested_at: finishedAt,
        };
      }
      const { error } = await supabase.from("technician_assignments").update(payload).eq("id", id);
      if (error) throw error;

      const { error: statusError } = await (supabase.rpc as any)("tech_update_assignment_status", {
        p_assignment_id: id,
        p_status: "completed",
        p_note: notes || null,
        p_eta: null,
      });
      if (statusError) throw statusError;

      // Queue tech_completed email with Google Review CTA
      if (assignment?.order_id) {
        await queueTechEmail({
          assignmentId: id,
          orderId: assignment.order_id,
          templateKey: "tech_completed",
          extraVars: {
            plan_name: serviceLabels[0] ?? "Forfait Nivra",
            speed: download ? `${download} Mbps` : "Optimale",
          },
        });
      }
      return finishedAt;
    },
    onSuccess: (finishedAt) => {
      qc.invalidateQueries({ queryKey: ["tech-assignments-all"] });
      qc.invalidateQueries({ queryKey: ["tech-assignment", id] });
      toast.success("Installation complétée — service activé!");
      setSummary({
        client: assignment?.client_name,
        address: assignment?.client_address,
        service: serviceLabels.join(" · "),
        equipment_count: allScannedEquipment.length,
        photos_count: photos.length,
        coax,
        network: { download, upload, ping, signal },
        startedAt,
        finishedAt,
        signature: !!signature,
      });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const reschedule = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("ID manquant");
      if (!rescheduleDate || !rescheduleTime) throw new Error("Date et heure requises");
      const [hh, mm] = rescheduleTime.split(":").map((x) => parseInt(x, 10));
      const endMinutes = hh * 60 + mm + 120;
      const endH = String(Math.floor(endMinutes / 60) % 24).padStart(2, "0");
      const endM = String(endMinutes % 60).padStart(2, "0");
      const endTime = `${endH}:${endM}`;
      const { error } = await supabase
        .from("technician_assignments")
        .update({
          status: "rescheduled",
          scheduled_date: rescheduleDate,
          scheduled_time_start: rescheduleTime,
          scheduled_time_end: endTime,
          missed_at: new Date().toISOString(),
          technician_notes: missReason || notes || null,
        })
        .eq("id", id);
      if (error) throw error;
      if (assignment?.order_id) {
        await queueTechEmail({
          assignmentId: id,
          orderId: assignment.order_id,
          templateKey: "tech_rescheduled",
          extraVars: { new_date: rescheduleDate, new_time: rescheduleTime, scheduled_date: rescheduleDate },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tech-assignments-all"] });
      toast.success("Rendez-vous replanifié — client notifié ✅");
      setShowReschedule(false);
      setMissingFor(false);
      navigate("/tech/assignments");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const confirmMissedOnly = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("ID manquant");
      const { error } = await (supabase.rpc as any)("tech_update_assignment_status", {
        p_assignment_id: id,
        p_status: "missed",
        p_note: missReason || "Client absent / rendez-vous manqué",
        p_eta: null,
      });
      if (error) throw error;
      if (assignment?.order_id) {
        await queueTechEmail({
          assignmentId: id,
          orderId: assignment.order_id,
          templateKey: "tech_missed",
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tech-assignments-all"] });
      toast.success("Marqué comme manqué");
      setMissingFor(false);
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
  const networkOk = assignment.service_type !== "internet" || (!!download && !!upload);
  const canComplete =
    allMandatoryDone &&
    (assignment.service_type !== "internet" || !!coax) &&
    networkOk;

  const minRescheduleDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  // Summary screen after completion
  if (summary) {
    return (
      <div>
        <TechTopBar title="Récapitulatif" back />
        <OfflineIndicator />
        <div className="px-4 py-6 space-y-4">
          <div className="rounded-2xl bg-emerald-600/15 border-2 border-emerald-500/40 p-5 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-2" />
            <h2 className="text-lg font-bold text-white">Installation complétée!</h2>
            <p className="text-sm text-emerald-200 mt-1">Service activé — client notifié.</p>
          </div>
          <SummaryRow label="Client" value={summary.client ?? "—"} />
          <SummaryRow label="Adresse" value={summary.address ?? "—"} />
          <SummaryRow label="Service" value={summary.service ?? "—"} />
          <SummaryRow label="Équipement scanné" value={`${summary.equipment_count} appareil(s)`} />
          <SummaryRow label="Photos prises" value={`${summary.photos_count}`} />
          <SummaryRow label="État coaxial" value={summary.coax || "N/A"} />
          {summary.network?.download && (
            <SummaryRow label="Test réseau" value={`↓${summary.network.download} / ↑${summary.network.upload} Mbps · ${summary.network.ping}ms`} />
          )}
          <SummaryRow label="Durée" value={fmtDuration(summary.startedAt, summary.finishedAt)} />
          <SummaryRow label="Signature client" value={summary.signature ? "✅ Confirmée" : "❌ Non signée"} />
          <button
            onClick={() => navigate("/tech/assignments")}
            className="w-full min-h-[56px] rounded-full bg-violet-600 hover:bg-violet-700 text-white text-base font-bold mt-4"
          >
            Retour aux missions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TechTopBar title={`Installation #${assignment.order_number ?? ""}`} back />
      <OfflineIndicator />
      <div className="px-4 py-4 space-y-4">
        {/* Mission command center */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-4 shadow-lg shadow-slate-950/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-bold text-white">{assignment.client_name || "Client"}</p>
              <p className="text-xs text-slate-500 mt-1">
                {assignment.appointment_number ? `RDV ${assignment.appointment_number}` : "Rendez-vous"}
                {assignment.order_number ? ` · Commande #${assignment.order_number}` : ""}
              </p>
            </div>
            <span className="rounded-full border border-violet-500/40 bg-violet-500/15 px-2.5 py-1 text-[10px] font-bold uppercase text-violet-300">
              {assignment.appointment_status || assignment.status}
            </span>
          </div>

          <div className="grid gap-2 text-sm">
            <p className="flex items-start gap-2 text-slate-300 leading-relaxed">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-slate-500" />
              <span>{assignment.client_address || "Adresse non disponible"}</span>
            </p>
            <p className="flex items-center gap-2 text-slate-400">
              <Clock className="h-4 w-4 shrink-0 text-slate-500" />
              <span>{assignment.scheduled_date} · {assignment.scheduled_time_start?.slice(0, 5)} – {assignment.scheduled_time_end?.slice(0, 5)}</span>
            </p>
            {assignment.client_phone && (
              <a href={`tel:${assignment.client_phone}`} className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-full border border-slate-700 bg-slate-800/70 px-3 text-sm font-semibold text-violet-300">
                <Phone className="h-4 w-4" /> {assignment.client_phone}
              </a>
            )}
          </div>

          <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-300">
              <Wrench className="h-4 w-4" /> Services / matériel à installer
            </div>
            <div className="flex flex-wrap gap-2">
              {serviceLabels.length ? serviceLabels.slice(0, 6).map((label, idx) => (
                <span key={`${label}-${idx}`} className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200">
                  {String(label)}
                </span>
              )) : <span className="text-xs text-slate-500">Aucun détail de service</span>}
            </div>
            {plannedEquipment.length > 0 && (
              <ul className="space-y-1 pt-1">
                {plannedEquipment.slice(0, 5).map((item: any, idx: number) => (
                  <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                    <PackageCheck className="h-3.5 w-3.5 mt-0.5 text-emerald-400" />
                    <span>{item.catalog_name || item.name || item.category || item.sku || "Équipement prévu"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => {
              const eta = window.prompt("Heure d'arrivée estimée (ex: 14h30)", "");
              if (eta !== null) setFieldStatus.mutate({ status: "en_route", eta });
            }} className="min-h-[48px] rounded-full bg-orange-600/20 border border-orange-600/40 text-orange-300 text-sm font-semibold flex items-center justify-center gap-2">
              <Truck className="h-4 w-4" /> En route
            </button>
            <button onClick={() => setFieldStatus.mutate({ status: "arrived" })} className="min-h-[48px] rounded-full bg-blue-600/20 border border-blue-600/40 text-blue-300 text-sm font-semibold flex items-center justify-center gap-2">
              <MapPin className="h-4 w-4" /> 📍 Je suis arrivé
            </button>
            <button onClick={() => setFieldStatus.mutate({ status: "in_progress" })} className="min-h-[48px] rounded-full bg-violet-600 text-white text-sm font-semibold flex items-center justify-center gap-2">
              Démarrer
            </button>
            <button onClick={() => { setMissingFor(true); }} className="min-h-[48px] rounded-full bg-purple-600/20 border border-purple-600/40 text-purple-300 text-sm font-semibold flex items-center justify-center gap-2">
              <RotateCcw className="h-4 w-4" /> Replanifier
            </button>
          </div>
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

            {currentStep.requires_photo && (
              <PhotoCapture onCapture={onPhotoCaptured} label="📷 Prendre une photo" />
            )}

            {currentStep.requires_scan && (
              <button
                onClick={() => setShowScanner(true)}
                className="w-full min-h-[56px] rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <ScanLine className="h-5 w-5" /> Scanner l'équipement
              </button>
            )}

            {currentStep.requires_test && (
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <Gauge className="h-4 w-4" /> Test réseau requis — voir la section ci-dessous.
              </p>
            )}

            <button
              onClick={() => {
                setCompletedSteps((s) => new Set(s).add(stepIdx));
                toast.success("✅ Étape complétée");
                if (stepIdx < totalSteps - 1) setStepIdx(stepIdx + 1);
              }}
              className={`w-full min-h-[52px] rounded-full text-sm font-bold flex items-center justify-center gap-2 ${
                completedSteps.has(stepIdx)
                  ? "bg-emerald-600 text-white"
                  : "bg-violet-600 hover:bg-violet-700 text-white"
              }`}
            >
              {completedSteps.has(stepIdx) ? "✅ Étape complétée" : "Marquer l'étape complétée"}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                disabled={stepIdx === 0}
                className="min-h-[44px] rounded-full bg-slate-800 text-white text-xs font-semibold disabled:opacity-40"
              >
                ← Précédent
              </button>
              <button
                onClick={() => setStepIdx((i) => Math.min(totalSteps - 1, i + 1))}
                disabled={stepIdx >= totalSteps - 1}
                className="min-h-[44px] rounded-full bg-slate-800 text-white text-xs font-semibold disabled:opacity-40"
              >
                Suivant →
              </button>
            </div>
          </section>
        )}

        {/* Equipment scan */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Équipement installé</h3>
              <p className="text-xs text-slate-400 mt-1">Scanner ou entrer le numéro de série / MAC.</p>
            </div>
            <span className="shrink-0 rounded-full bg-violet-600/20 px-3 py-1 text-xs font-bold text-violet-300">{allScannedEquipment.length}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowScanner(true)}
              className="min-h-[48px] rounded-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold flex items-center justify-center gap-2"
            >
              <Camera className="h-4 w-4" /> Scanner QR
            </button>
            <button
              onClick={handleManualScan}
              disabled={!scanCode.trim()}
              className="min-h-[48px] rounded-full bg-slate-800 border border-slate-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <ScanLine className="h-4 w-4" /> Ajouter
            </button>
          </div>
          <input
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualScan()}
            placeholder="S/N ou MAC manuellement..."
            className="w-full min-h-[48px] rounded-full bg-slate-800 border border-slate-700 text-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          {allScannedEquipment.length > 0 && (
            <ul className="space-y-2">
              {allScannedEquipment.map((item: any, idx: number) => (
                <li key={`${item.id || item.serial_number || item.serial}-${idx}`} className="flex items-start gap-3 rounded-xl bg-slate-800/70 border border-slate-700 p-3">
                  <PackageCheck className="h-5 w-5 text-emerald-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{item.catalog_name || item.category || "Équipement"}</p>
                    <p className="text-xs text-slate-400">S/N: {item.serial_number || item.serial || "—"}</p>
                    {item.mac_address && <p className="text-xs text-slate-400">MAC: {item.mac_address}</p>}
                  </div>
                  {idx >= existingScanned.length && (
                    <button onClick={() => setScannedEquipment((items) => items.filter((_, i) => i !== idx - existingScanned.length))} className="h-10 w-10 rounded-full text-slate-400 hover:bg-slate-700" aria-label="Retirer équipement">
                      <X className="h-4 w-4 mx-auto" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Photos taken */}
        {photos.length > 0 && (
          <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Camera className="h-4 w-4 text-violet-400" /> Photos prises ({photos.length})
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <img key={i} src={p.url} alt={p.step} className="w-full h-20 object-cover rounded-lg border border-slate-700" />
              ))}
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

        {/* Technician notes */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-400" /> Notes du technicien
          </h3>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observations, problèmes rencontrés, équipement remplacé..."
            rows={4}
            className="bg-slate-800 border-slate-700 text-white text-base"
          />
        </section>

        {/* Signature */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <PenTool className="h-4 w-4 text-violet-400" /> Signature du client
          </h3>
          {signature ? (
            <div className="space-y-2">
              <div className="rounded-xl border-2 border-emerald-500/50 bg-white p-2">
                <img src={signature} alt="Signature" className="w-full h-32 object-contain" />
              </div>
              <button
                onClick={() => { setSignature(null); setShowSignature(true); }}
                className="text-xs text-violet-400 underline"
              >
                Recommencer la signature
              </button>
            </div>
          ) : showSignature ? (
            <SignaturePad onConfirm={(b64) => { setSignature(b64); setShowSignature(false); toast.success("Signature confirmée ✅"); }} />
          ) : (
            <button
              onClick={() => setShowSignature(true)}
              className="w-full min-h-[52px] rounded-full bg-slate-800 border border-slate-700 text-white text-sm font-semibold flex items-center justify-center gap-2"
            >
              <PenTool className="h-4 w-4" /> Demander la signature client
            </button>
          )}
        </section>

        {/* Actions */}
        <div className="space-y-3 pt-2 pb-8">
          <button
            disabled={!canComplete || complete.isPending}
            onClick={() => {
              if (window.confirm("Confirmer la complétion de l'installation ?")) {
                complete.mutate();
              }
            }}
            className="w-full min-h-[60px] rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {complete.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            Marquer l'installation complète
          </button>
          {!canComplete && (
            <p className="text-xs text-slate-400 text-center">
              Complétez toutes les étapes obligatoires
              {assignment.service_type === "internet" && " + état coaxial + test réseau"}.
            </p>
          )}
          <button
            disabled={confirmMissedOnly.isPending}
            onClick={() => setMissingFor(true)}
            className="w-full min-h-[56px] rounded-full bg-red-600/20 border border-red-600/50 text-red-300 text-base font-semibold flex items-center justify-center gap-2"
          >
            <AlertTriangle className="h-5 w-5" />
            Rendez-vous manqué
          </button>
        </div>
      </div>

      {showScanner && <QRScanner onScan={handleQrScan} onClose={() => setShowScanner(false)} />}

      {/* Missed → Reschedule dialog */}
      <Dialog open={missingFor && !showReschedule} onOpenChange={(o) => !o && setMissingFor(false)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Rendez-vous manqué</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-300">Voulez-vous replanifier ce rendez-vous?</p>
          <Textarea
            placeholder="Raison (ex: client absent, accès refusé...)"
            value={missReason}
            onChange={(e) => setMissReason(e.target.value)}
            className="min-h-[80px] bg-slate-950 border-slate-700 text-white"
          />
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <button
              onClick={() => setShowReschedule(true)}
              disabled={!missReason.trim()}
              className="min-h-[48px] px-5 rounded-full bg-violet-600 text-white text-sm font-bold disabled:opacity-40"
            >
              Replanifier
            </button>
            <button
              onClick={() => confirmMissedOnly.mutate()}
              disabled={!missReason.trim() || confirmMissedOnly.isPending}
              className="min-h-[48px] px-5 rounded-full bg-red-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              Non, laisser comme manqué
            </button>
            <button
              onClick={() => setMissingFor(false)}
              className="min-h-[48px] px-5 rounded-full bg-slate-800 text-slate-200 text-sm font-semibold"
            >
              Annuler
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule date/time picker */}
      <Dialog open={showReschedule} onOpenChange={(o) => !o && setShowReschedule(false)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Replanifier le rendez-vous</DialogTitle>
          </DialogHeader>
          <label className="block">
            <span className="text-xs text-slate-400">Nouvelle date</span>
            <input
              type="date"
              min={minRescheduleDate}
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="mt-1 w-full min-h-[48px] rounded-lg bg-slate-950 border border-slate-700 text-white px-3 text-base"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400">Nouvelle heure (9h-18h)</span>
            <input
              type="time"
              min="09:00"
              max="18:00"
              value={rescheduleTime}
              onChange={(e) => setRescheduleTime(e.target.value)}
              className="mt-1 w-full min-h-[48px] rounded-lg bg-slate-950 border border-slate-700 text-white px-3 text-base"
            />
          </label>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowReschedule(false)}
              className="min-h-[48px] px-5 rounded-full bg-slate-800 text-slate-200 text-sm font-semibold"
            >
              Annuler
            </button>
            <button
              onClick={() => reschedule.mutate()}
              disabled={!rescheduleDate || !rescheduleTime || reschedule.isPending}
              className="min-h-[48px] px-5 rounded-full bg-violet-600 text-white text-sm font-bold disabled:opacity-40"
            >
              {reschedule.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Replanifier"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-900 border border-slate-800 px-4 py-3">
      <span className="text-xs text-slate-400 uppercase font-semibold">{label}</span>
      <span className="text-sm text-white font-semibold text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}

function fmtDuration(start: string | null, end: string): string {
  if (!start) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return h > 0 ? `${h}h ${rest}min` : `${m} min`;
}
