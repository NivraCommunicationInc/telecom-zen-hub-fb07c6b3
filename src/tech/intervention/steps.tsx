import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, ChecklistItem, Equipment, TestResult, WifiConfig, MediaRow } from "@/tech/hooks/useInterventionSession";
import { SignaturePad } from "./SignaturePad";
import { SpeedTest } from "./SpeedTest";
import { MapPin, Camera, Wifi, Radio, Zap, ClipboardCheck, ScanLine, Loader2 } from "lucide-react";

// ==============================================================
// Shared step primitives
// ==============================================================
type BaseProps = {
  session: Session;
  onAdvance: (payload?: Record<string, unknown>) => Promise<void>;
  onRefetch: () => Promise<void>;
  disabled?: boolean;
};

function StageHeader({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="tk-stage__eyebrow">{eyebrow}</div>
      <h1 className="tk-stage__title">{title}</h1>
      <p className="tk-stage__lede">{lede}</p>
    </div>
  );
}

async function uploadToStorage(sessionId: string, technicianId: string, kind: string, blob: Blob, ext = "jpg"): Promise<string> {
  const path = `${technicianId}/${sessionId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("intervention-media").upload(path, blob, { contentType: blob.type || "application/octet-stream", upsert: false });
  if (error) throw error;
  await supabase.from("intervention_media").insert({
    session_id: sessionId, kind, storage_path: path, bytes: blob.size, content_type: blob.type,
  });
  return path;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl); return res.blob();
}

// ==============================================================
// 1. ARRIVAL
// ==============================================================
export function ArrivalStep({ session, onAdvance }: BaseProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!file) return;
    setUploading(true); setErr(null);
    try {
      await uploadToStorage(session.id, session.technician_id, "facade", file);
      await onAdvance({ facade_uploaded: true });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erreur d'envoi");
    } finally { setUploading(false); }
  };

  const hasGps = session.arrival_gps_lat !== null;

  return (
    <div>
      <StageHeader eyebrow="Étape 1 sur 12" title="Arrivée sur site" lede="Confirme ta présence physique et documente la façade avant intervention." />

      <div className="tk-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <MapPin size={18} style={{ color: hasGps ? "hsl(var(--tk-ok))" : "hsl(var(--tk-warn))" }} />
          <div style={{ fontWeight: 700 }}>Position GPS</div>
          {hasGps
            ? <span className="tk-tag tk-tag--ok">Verrouillée</span>
            : <span className="tk-tag tk-tag--warn">Non capturée</span>}
        </div>
        <div style={{ color: "hsl(var(--tk-fg-mut))", fontSize: 13 }}>
          {hasGps
            ? `Lat ${session.arrival_gps_lat?.toFixed(5)} / Lng ${session.arrival_gps_lng?.toFixed(5)} · précision ±${Math.round(session.arrival_accuracy_m ?? 0)}m`
            : "La position sera enregistrée à la création de la session."}
        </div>
      </div>

      <div className="tk-card" style={{ marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <Camera size={18} />
          <div style={{ fontWeight: 700 }}>Photo de la façade</div>
        </div>
        <label htmlFor="facade-input" className="tk-photo-preview" style={{ cursor: "pointer" }}>
          {file ? <img src={URL.createObjectURL(file)} alt="Aperçu façade" /> : <div style={{ textAlign: "center", padding: 20 }}>Toucher pour prendre la photo</div>}
        </label>
        <input id="facade-input" type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {err && <div className="tk-alert tk-alert--danger" style={{ marginTop: 10 }}>{err}</div>}
      </div>

      <div className="tk-stage__foot">
        <button className="tk-btn" onClick={submit} disabled={!file || uploading}>
          {uploading ? <><Loader2 size={16} className="tk-spin" /> Envoi…</> : "Photo prise — passer à la checklist →"}
        </button>
      </div>
    </div>
  );
}

// ==============================================================
// 2. CHECKLIST
// ==============================================================
export function ChecklistStep({ session, onAdvance, onRefetch, checklist }: BaseProps & { checklist: ChecklistItem[] }) {
  const [saving, setSaving] = useState<string | null>(null);

  const toggle = async (item: ChecklistItem) => {
    setSaving(item.id);
    await supabase.from("intervention_checklist_items").update({
      checked: !item.checked, checked_at: !item.checked ? new Date().toISOString() : null,
    }).eq("id", item.id);
    await onRefetch();
    setSaving(null);
  };

  const missing = checklist.filter((c) => c.required && !c.checked).length;

  return (
    <div>
      <StageHeader eyebrow="Étape 2 sur 12" title="Vérifications initiales" lede="Confirme chaque point avant de commencer. Les items obligatoires bloquent la progression." />
      <div style={{ display: "grid", gap: 8 }}>
        {checklist.map((c) => (
          <label key={c.id} className="tk-checklist-item" data-checked={c.checked}>
            <input type="checkbox" checked={c.checked} onChange={() => toggle(c)} disabled={saving === c.id} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.label}</div>
              {c.required && <div style={{ fontSize: 11, color: "hsl(var(--tk-fg-dim))", marginTop: 2 }}>Obligatoire</div>}
            </div>
          </label>
        ))}
      </div>
      <div className="tk-stage__foot">
        <button className="tk-btn" onClick={() => onAdvance({ items: checklist.length })} disabled={missing > 0}>
          {missing > 0 ? `Encore ${missing} item(s) obligatoire(s)` : "Vérifications complètes — Équipement →"}
        </button>
      </div>
    </div>
  );
}

// ==============================================================
// 3. EQUIPMENT (scan + manual entry)
// ==============================================================
const MAC_RE = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

export function EquipmentStep({ session, onAdvance, onRefetch, equipment }: BaseProps & { equipment: Equipment[] }) {
  const [kind, setKind] = useState("borne_wifi");
  const [serial, setSerial] = useState("");
  const [mac, setMac] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const add = async () => {
    setErr(null);
    const s = serial.trim();
    if (s.length < 4) { setErr("Numéro de série trop court"); return; }
    if (mac && !MAC_RE.test(mac.trim())) { setErr("Adresse MAC invalide (format AA:BB:CC:DD:EE:FF)"); return; }
    setSaving(true);
    const { error } = await supabase.from("intervention_equipment").insert({
      session_id: session.id, kind, serial: s.toUpperCase(), mac: mac.trim() || null, verified: true, scanned_via: "manual",
    });
    if (error) { setErr(error.message); setSaving(false); return; }
    setSerial(""); setMac("");
    await onRefetch();
    setSaving(false);
  };

  const remove = async (id: string) => {
    await supabase.from("intervention_equipment").delete().eq("id", id);
    await onRefetch();
  };

  return (
    <div>
      <StageHeader eyebrow="Étape 3 sur 12" title="Scan équipement" lede="Enregistre chaque équipement installé (borne Wi-Fi, terminal TV, POD, SIM)." />

      <div className="tk-card">
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ fontSize: 12, color: "hsl(var(--tk-fg-mut))", fontWeight: 600 }}>Type d'équipement</label>
          <select className="tk-input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="borne_wifi">Borne Wi-Fi</option>
            <option value="tv_terminal">Terminal TV</option>
            <option value="pod_wifi">POD Wi-Fi</option>
            <option value="sim">Carte SIM</option>
            <option value="other">Autre</option>
          </select>
          <label style={{ fontSize: 12, color: "hsl(var(--tk-fg-mut))", fontWeight: 600 }}>Numéro de série</label>
          <input className="tk-input tk-input--mono" placeholder="SN0000000" value={serial} onChange={(e) => setSerial(e.target.value)} />
          <label style={{ fontSize: 12, color: "hsl(var(--tk-fg-mut))", fontWeight: 600 }}>Adresse MAC (optionnel)</label>
          <input className="tk-input tk-input--mono" placeholder="AA:BB:CC:DD:EE:FF" value={mac} onChange={(e) => setMac(e.target.value)} />
          {err && <div className="tk-alert tk-alert--danger">{err}</div>}
          <button className="tk-btn" onClick={add} disabled={saving}><ScanLine size={16} />{saving ? "Enregistrement…" : "Ajouter l'équipement"}</button>
        </div>
      </div>

      {equipment.length > 0 && (
        <div className="tk-card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Équipements enregistrés ({equipment.length})</div>
          <div style={{ display: "grid", gap: 8 }}>
            {equipment.map((eq) => (
              <div key={eq.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, background: "hsl(var(--tk-bg-2))", borderRadius: 8, border: "1px solid hsl(var(--tk-line))" }}>
                <span className="tk-tag tk-tag--info">{eq.kind}</span>
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}>{eq.serial}</div>
                {eq.mac && <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "hsl(var(--tk-fg-mut))" }}>{eq.mac}</div>}
                <button className="tk-btn tk-btn--ghost tk-btn--sm" style={{ marginLeft: "auto" }} onClick={() => remove(eq.id)}>Retirer</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tk-stage__foot">
        <button className="tk-btn" onClick={() => onAdvance({ count: equipment.length })} disabled={equipment.length === 0}>
          {equipment.length === 0 ? "Ajoute au moins 1 équipement" : "Équipement scanné — Test Internet →"}
        </button>
      </div>
    </div>
  );
}

// ==============================================================
// 4-6. TESTS (Internet / Wi-Fi / TV) — factorized
// ==============================================================
type TestKind = "internet" | "wifi" | "tv";
const TEST_META: Record<TestKind, { title: string; eyebrow: string; lede: string; icon: typeof Radio; step: number }> = {
  internet: { title: "Test Internet", eyebrow: "Étape 4 sur 12", lede: "Mesure du débit descendant, montant et latence via le réseau du client.", icon: Zap, step: 4 },
  wifi:     { title: "Test Wi-Fi",    eyebrow: "Étape 5 sur 12", lede: "Vérifie la couverture Wi-Fi et note les canaux 2.4/5 GHz.", icon: Wifi, step: 5 },
  tv:       { title: "Test TV",       eyebrow: "Étape 6 sur 12", lede: "Vérifie le signal et confirme la réception des canaux principaux.", icon: Radio, step: 6 },
};

export function TestStep({ session, onAdvance, onRefetch, kind, tests }: BaseProps & { kind: TestKind; tests: TestResult[] }) {
  const meta = TEST_META[kind];
  const existing = tests.find((t) => t.kind === kind);
  const [ssid, setSsid] = useState((existing?.payload as { ssid?: string })?.ssid ?? "");
  const [notes, setNotes] = useState((existing?.payload as { notes?: string })?.notes ?? "");
  const [signalDbm, setSignalDbm] = useState<number | "">((existing?.payload as { signal_dbm?: number })?.signal_dbm ?? "");
  const [channels, setChannels] = useState<number>((existing?.payload as { channels?: number })?.channels ?? 0);
  const [saved, setSaved] = useState(!!existing);

  const saveInternetMetrics = async (m: { downloadMbps: number; uploadMbps: number; latencyMs: number }) => {
    const passed = m.downloadMbps > 5 && m.latencyMs < 200;
    await supabase.from("intervention_tests").upsert({
      session_id: session.id, kind: "internet", payload: m, passed,
    }, { onConflict: "session_id,kind" });
    await onRefetch(); setSaved(true);
  };

  const saveManual = async () => {
    const payload = kind === "wifi"
      ? { ssid, notes, signal_dbm: signalDbm === "" ? null : Number(signalDbm) }
      : { channels: Number(channels) || 0, notes };
    const passed = kind === "wifi" ? Number(signalDbm || -100) > -75 : Number(channels) > 0;
    await supabase.from("intervention_tests").upsert({
      session_id: session.id, kind, payload, passed,
    }, { onConflict: "session_id,kind" });
    await onRefetch(); setSaved(true);
  };

  return (
    <div>
      <StageHeader eyebrow={meta.eyebrow} title={meta.title} lede={meta.lede} />
      <div className="tk-card">
        {kind === "internet" ? (
          <SpeedTest onDone={saveInternetMetrics} />
        ) : kind === "wifi" ? (
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ fontSize: 12, color: "hsl(var(--tk-fg-mut))", fontWeight: 600 }}>SSID détecté</label>
            <input className="tk-input" placeholder="Nom du réseau observé" value={ssid} onChange={(e) => setSsid(e.target.value)} />
            <label style={{ fontSize: 12, color: "hsl(var(--tk-fg-mut))", fontWeight: 600 }}>Signal (dBm) — plus proche de 0 = meilleur</label>
            <input className="tk-input" type="number" placeholder="-60" value={signalDbm} onChange={(e) => setSignalDbm(e.target.value === "" ? "" : Number(e.target.value))} />
            <label style={{ fontSize: 12, color: "hsl(var(--tk-fg-mut))", fontWeight: 600 }}>Notes</label>
            <textarea className="tk-input tk-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button className="tk-btn" onClick={saveManual}>Enregistrer le test Wi-Fi</button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ fontSize: 12, color: "hsl(var(--tk-fg-mut))", fontWeight: 600 }}>Nombre de canaux reçus correctement</label>
            <input className="tk-input" type="number" min={0} value={channels} onChange={(e) => setChannels(Number(e.target.value))} />
            <label style={{ fontSize: 12, color: "hsl(var(--tk-fg-mut))", fontWeight: 600 }}>Notes</label>
            <textarea className="tk-input tk-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button className="tk-btn" onClick={saveManual}>Enregistrer le test TV</button>
          </div>
        )}
        {saved && <div className="tk-alert tk-alert--ok" style={{ marginTop: 12 }}>Test enregistré.</div>}
      </div>

      <div className="tk-stage__foot">
        <button className="tk-btn" onClick={() => onAdvance({ kind })} disabled={!saved}>Test suivant →</button>
      </div>
    </div>
  );
}

// ==============================================================
// 7. ACTIVATION
// ==============================================================
export function ActivationStep({ session, onAdvance }: BaseProps & { activate: () => Promise<{ ok: boolean }> }) {
  const [running, setRunning] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setRunning(true); setErr(null);
    try {
      const { data, error } = await supabase.rpc("fn_activate_service_for_intervention", { p_session_id: session.id });
      if (error) throw error;
      setOk((data as { ok: boolean })?.ok ?? true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erreur d'activation");
    } finally { setRunning(false); }
  };

  return (
    <div>
      <StageHeader eyebrow="Étape 7 sur 12" title="Activation du service" lede="Bascule le service côté opérateur. Le journal enregistre l'action et l'horodatage." />
      <div className="tk-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "hsl(var(--tk-accent) / 0.15)", color: "hsl(var(--tk-accent))", display: "grid", placeItems: "center" }}><Zap /></div>
          <div>
            <div style={{ fontWeight: 700 }}>Service : {session.service_kind}</div>
            <div style={{ color: "hsl(var(--tk-fg-mut))", fontSize: 13 }}>Commande #{session.order_id?.slice(0, 8) ?? "non liée"}</div>
          </div>
        </div>
        <button className="tk-btn" style={{ marginTop: 16 }} onClick={run} disabled={running || ok}>
          {ok ? "Service activé ✓" : running ? "Activation en cours…" : "Activer maintenant"}
        </button>
        {err && <div className="tk-alert tk-alert--danger" style={{ marginTop: 12 }}>{err}</div>}
        {ok && <div className="tk-alert tk-alert--ok" style={{ marginTop: 12 }}>Activation enregistrée dans le journal.</div>}
      </div>
      <div className="tk-stage__foot">
        <button className="tk-btn" onClick={() => onAdvance({ activated: ok })} disabled={!ok}>Continuer vers la configuration Wi-Fi →</button>
      </div>
    </div>
  );
}

// ==============================================================
// 8. WIFI CONFIG
// ==============================================================
export function WifiConfigStep({ session, onAdvance, onRefetch, wifi }: BaseProps & { wifi: WifiConfig | null }) {
  const [ssid, setSsid] = useState(wifi?.ssid ?? "");
  const [password, setPassword] = useState(wifi?.password ?? "");
  const [band, setBand] = useState(wifi?.band ?? "dual");
  const [saved, setSaved] = useState(!!wifi);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    if (ssid.trim().length < 2) { setErr("SSID trop court"); return; }
    if (password.length < 8) { setErr("Mot de passe : 8 caractères minimum"); return; }
    const { error } = await supabase.from("intervention_wifi_config").upsert({
      session_id: session.id, ssid: ssid.trim(), password, band, security: "WPA2",
    }, { onConflict: "session_id" });
    if (error) { setErr(error.message); return; }
    await onRefetch(); setSaved(true);
  };

  return (
    <div>
      <StageHeader eyebrow="Étape 8 sur 12" title="Configuration Wi-Fi" lede="Ces identifiants seront communiqués au client par email et remis en PDF à la fin." />
      <div className="tk-card" style={{ display: "grid", gap: 10 }}>
        <label style={{ fontSize: 12, color: "hsl(var(--tk-fg-mut))", fontWeight: 600 }}>SSID (nom du réseau)</label>
        <input className="tk-input" value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="Nivra-Home" />
        <label style={{ fontSize: 12, color: "hsl(var(--tk-fg-mut))", fontWeight: 600 }}>Mot de passe</label>
        <input className="tk-input tk-input--mono" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 caractères minimum" />
        <label style={{ fontSize: 12, color: "hsl(var(--tk-fg-mut))", fontWeight: 600 }}>Bande</label>
        <select className="tk-input" value={band} onChange={(e) => setBand(e.target.value)}>
          <option value="dual">Dual-band (2.4 + 5 GHz)</option>
          <option value="2.4">2.4 GHz seulement</option>
          <option value="5">5 GHz seulement</option>
          <option value="6">Wi-Fi 6E (6 GHz)</option>
        </select>
        {err && <div className="tk-alert tk-alert--danger">{err}</div>}
        <button className="tk-btn" onClick={save}>{saved ? "Mettre à jour" : "Enregistrer la configuration"}</button>
        {saved && <div className="tk-alert tk-alert--ok">Configuration enregistrée.</div>}
      </div>
      <div className="tk-stage__foot">
        <button className="tk-btn" onClick={() => onAdvance({ ssid })} disabled={!saved}>Configuration prête — Validation client →</button>
      </div>
    </div>
  );
}

// ==============================================================
// 9. CLIENT VALIDATION
// ==============================================================
export function ClientValidationStep({ onAdvance }: BaseProps) {
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  return (
    <div>
      <StageHeader eyebrow="Étape 9 sur 12" title="Validation par le client" lede="Le client confirme que le service fonctionne et que les tests ont été effectués en sa présence." />
      <div className="tk-card" style={{ display: "grid", gap: 12 }}>
        <label style={{ fontSize: 12, color: "hsl(var(--tk-fg-mut))", fontWeight: 600 }}>Nom du client présent</label>
        <input className="tk-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom Prénom" />
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 22, height: 22, accentColor: "hsl(var(--tk-accent))", marginTop: 2 }} />
          <span style={{ fontSize: 14 }}>Je confirme que les services ont été testés en ma présence et fonctionnent correctement.</span>
        </label>
      </div>
      <div className="tk-stage__foot">
        <button className="tk-btn" onClick={() => onAdvance({ name, agreed })} disabled={!agreed || name.trim().length < 2}>Client a validé — Photos →</button>
      </div>
    </div>
  );
}

// ==============================================================
// 10. PHOTOS
// ==============================================================
export function PhotosStep({ session, onAdvance, onRefetch, media }: BaseProps & { media: MediaRow[] }) {
  const [uploading, setUploading] = useState(false);
  const beforeCount = media.filter((m) => m.kind === "before").length;
  const afterCount = media.filter((m) => m.kind === "after").length;

  const upload = async (kind: "before" | "after", file: File) => {
    setUploading(true);
    try { await uploadToStorage(session.id, session.technician_id, kind, file); await onRefetch(); }
    finally { setUploading(false); }
  };

  return (
    <div>
      <StageHeader eyebrow="Étape 10 sur 12" title="Photos avant / après" lede="Au moins une photo de chaque catégorie est requise." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="tk-card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Avant</div>
          <label htmlFor="before-input" className="tk-photo-preview" style={{ cursor: "pointer" }}>
            <div style={{ textAlign: "center", padding: 12, fontSize: 13 }}>{beforeCount} photo(s)<br />+ Ajouter</div>
          </label>
          <input id="before-input" type="file" accept="image/*" capture="environment" style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && upload("before", e.target.files[0])} />
        </div>
        <div className="tk-card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Après</div>
          <label htmlFor="after-input" className="tk-photo-preview" style={{ cursor: "pointer" }}>
            <div style={{ textAlign: "center", padding: 12, fontSize: 13 }}>{afterCount} photo(s)<br />+ Ajouter</div>
          </label>
          <input id="after-input" type="file" accept="image/*" capture="environment" style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && upload("after", e.target.files[0])} />
        </div>
      </div>
      {uploading && <div className="tk-alert tk-alert--info" style={{ marginTop: 12 }}>Envoi…</div>}
      <div className="tk-stage__foot">
        <button className="tk-btn" onClick={() => onAdvance({ before: beforeCount, after: afterCount })} disabled={beforeCount === 0 || afterCount === 0}>
          {beforeCount === 0 || afterCount === 0 ? "1 photo avant ET 1 photo après requises" : "Photos complètes — Signature →"}
        </button>
      </div>
    </div>
  );
}

// ==============================================================
// 11. SIGNATURE
// ==============================================================
export function SignatureStep({ session, onAdvance, onRefetch, media }: BaseProps & { media: MediaRow[] }) {
  const [saved, setSaved] = useState(media.some((m) => m.kind === "signature"));
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (dataUrl: string) => {
    try {
      setErr(null);
      const blob = await dataUrlToBlob(dataUrl);
      await uploadToStorage(session.id, session.technician_id, "signature", blob, "png");
      await onRefetch(); setSaved(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erreur d'enregistrement");
    }
  };

  return (
    <div>
      <StageHeader eyebrow="Étape 11 sur 12" title="Signature du client" lede="Le client signe pour attester la conformité de l'intervention." />
      <div className="tk-card">
        <SignaturePad onSubmit={onSubmit} disabled={saved} />
        {saved && <div className="tk-alert tk-alert--ok" style={{ marginTop: 12 }}>Signature enregistrée. Elle sera intégrée au PDF final.</div>}
        {err && <div className="tk-alert tk-alert--danger" style={{ marginTop: 12 }}>{err}</div>}
      </div>
      <div className="tk-stage__foot">
        <button className="tk-btn" onClick={() => onAdvance({})} disabled={!saved}>Clôturer l'intervention →</button>
      </div>
    </div>
  );
}

// ==============================================================
// 12. CLOSED
// ==============================================================
export function ClosedStep({ session }: { session: Session }) {
  return (
    <div>
      <StageHeader eyebrow="Terminée" title="Intervention clôturée" lede="Le rapport, la signature et la configuration Wi-Fi seront envoyés au client automatiquement." />
      <div className="tk-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "hsl(var(--tk-ok) / 0.15)", color: "hsl(var(--tk-ok))", display: "grid", placeItems: "center" }}><ClipboardCheck size={26} /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Bon travail.</div>
            <div style={{ color: "hsl(var(--tk-fg-mut))", fontSize: 13 }}>Session terminée le {session.completed_at?.slice(0, 16)}</div>
          </div>
        </div>
      </div>
      <div className="tk-stage__foot">
        <a href="/tech" className="tk-btn tk-btn--ghost">Retour à l'accueil</a>
      </div>
    </div>
  );
}
