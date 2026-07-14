import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useInterventionSession } from "@/tech/hooks/useInterventionSession";
import { nextStep, type Step } from "@/tech/lib/steps";
import { StepRail, MobileProgress } from "@/tech/intervention/StepRail";
import {
  ArrivalStep, ChecklistStep, EquipmentStep, TestStep, ActivationStep,
  WifiConfigStep, ClientValidationStep, PhotosStep, SignatureStep, ClosedStep,
} from "@/tech/intervention/steps";
import { Loader2 } from "lucide-react";

export default function InterventionRunner() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const nav = useNavigate();
  const ctx = useInterventionSession(sessionId);
  const [transitionErr, setTransitionErr] = useState<string | null>(null);

  const doAdvance = useMemo(() => async (payload: Record<string, unknown> = {}) => {
    if (!ctx.session) return;
    const from = ctx.session.current_step;
    const to = nextStep(from);
    if (!to) return;
    setTransitionErr(null);
    try { await ctx.advance(from, to, payload); }
    catch (e: unknown) { setTransitionErr(e instanceof Error ? e.message : "Erreur de transition"); }
  }, [ctx]);

  const closeNow = async () => {
    setTransitionErr(null);
    try { await ctx.closeSession(); }
    catch (e: unknown) { setTransitionErr(e instanceof Error ? e.message : "Erreur de clôture"); }
  };

  if (ctx.loading) return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "60vh", color: "hsl(var(--tk-fg-mut))" }}>
      <Loader2 className="tk-spin" size={22} /> Chargement de l'intervention…
    </div>
  );
  if (ctx.error || !ctx.session) return (
    <div className="tk-alert tk-alert--danger" style={{ maxWidth: 640, margin: "40px auto" }}>
      Session introuvable ou accès refusé. {ctx.error}
      <button className="tk-btn tk-btn--ghost tk-btn--sm" style={{ marginLeft: 12 }} onClick={() => nav("/tech")}>Retour</button>
    </div>
  );

  const s = ctx.session;
  const step = s.current_step;

  const base = { session: s, onAdvance: doAdvance, onRefetch: ctx.refetch };

  return (
    <div className="tk-runner">
      <StepRail current={step} />
      <div>
        <MobileProgress current={step} />
        <div className="tk-stage">
          {transitionErr && <div className="tk-alert tk-alert--danger" style={{ marginBottom: 16 }}>{transitionErr}</div>}

          {step === "arrival" && <ArrivalStep {...base} />}
          {step === "checklist" && <ChecklistStep {...base} checklist={ctx.checklist} />}
          {step === "equipment" && <EquipmentStep {...base} equipment={ctx.equipment} />}
          {step === "test_internet" && <TestStep {...base} kind="internet" tests={ctx.tests} />}
          {step === "test_wifi" && <TestStep {...base} kind="wifi" tests={ctx.tests} />}
          {step === "test_tv" && <TestStep {...base} kind="tv" tests={ctx.tests} />}
          {step === "activation" && <ActivationStep {...base} activate={ctx.activateService} />}
          {step === "wifi_config" && <WifiConfigStep {...base} wifi={ctx.wifi} />}
          {step === "client_validation" && <ClientValidationStep {...base} />}
          {step === "photos" && <PhotosStep {...base} media={ctx.media} />}
          {step === "signature" && (
            <SignatureStep
              {...base}
              media={ctx.media}
              onAdvance={async () => {
                await closeNow();
              }}
            />
          )}
          {step === "closed" && <ClosedStep session={s} />}
        </div>
      </div>
    </div>
  );
}
