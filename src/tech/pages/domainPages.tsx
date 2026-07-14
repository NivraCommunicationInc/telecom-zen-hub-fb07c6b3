import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, BadgeCheck, BarChart3, Bell, Boxes,
  Camera, Car, CheckCircle2, Clock, FileText, GraduationCap,
  Headphones, Mail, MapPin, MessageSquare, Navigation, PackageCheck, Phone,
  QrCode, Radio, RefreshCw, RotateCcw, Search, Send, Settings, Shield, Signature,
  Smartphone, Truck, Upload, UserRound, Wifi, Wrench, XCircle, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OpsMap } from "@/tech/components/OpsMap";
import { useMyDay, type DayAssignment } from "@/tech/hooks/useMyDay";
import { useTechnicianLocation } from "@/tech/hooks/useTechnicianLocation";
import { useServiceIncidents } from "@/tech/hooks/useServiceIncidents";
import { useTruckStock } from "@/tech/hooks/useTruckStock";
import { STEP_META, STEP_ORDER, type Step } from "@/tech/lib/steps";
import MaJournee from "./MaJournee";

type QueueItem = { at: string; label: string };
type ChatMessage = { id: string; channel: string; body: string; at: string; mine: boolean };
type Movement = { id: string; type: string; ref: string; note: string; at: string };

function useLocalList<T>(key: string, seed: T[] = []) {
  const [items, setItems] = useState<T[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? seed; }
    catch { return seed; }
  });
  const save = (next: T[]) => {
    setItems(next);
    localStorage.setItem(key, JSON.stringify(next));
  };
  return [items, save] as const;
}

function queue(label: string) {
  const at = new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
  const current = JSON.parse(localStorage.getItem("nivra-tech-offline-queue") ?? "[]") as string[];
  localStorage.setItem("nivra-tech-offline-queue", JSON.stringify([`${at} · ${label}`, ...current].slice(0, 30)));
  window.dispatchEvent(new Event("nivra-tech-queue"));
}

function cx(...parts: Array<string | false | null | undefined>) { return parts.filter(Boolean).join(" "); }

async function getGps() {
  return new Promise<GeolocationCoordinates | null>((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), () => resolve(null), { enableHighAccuracy: true, timeout: 8000 });
  });
}

function ShellHeader({ label, title, subtitle, action }: { label: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="tk-product-head">
      <div>
        <div className="tk-product-label">{label}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action && <div className="tk-product-actions">{action}</div>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="tk-empty-state">
      <Icon />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function AssignmentPill({ item, active, onClick }: { item: DayAssignment; active?: boolean; onClick?: () => void }) {
  return (
    <button className={cx("tk-work-pill", active && "is-active")} onClick={onClick}>
      <span>{item.time_start?.slice(0, 5) || "--:--"}</span>
      <strong>{item.client_full_name || "Client"}</strong>
      <small>{item.address_line || item.city || "Adresse à confirmer"}</small>
    </button>
  );
}

export const DayPage = () => <MaJournee />;

export function TerrainPage() {
  const { items } = useMyDay();
  const me = useTechnicianLocation(true);
  const { items: incidents } = useServiceIncidents();
  const [selected, setSelected] = useState<DayAssignment | null>(null);

  return (
    <div className="tk-terrain-screen">
      <OpsMap assignments={items} incidents={incidents} me={me} mode="fullscreen" />
      <div className="tk-map-command-panel">
        <ShellHeader
          label="Terrain live"
          title="Carte opérationnelle"
          subtitle="GPS technicien, RDV, incidents NOC, ETA et dispatch sur la même surface."
        />
        <div className="tk-map-stats">
          <div><strong>{items.length}</strong><span>RDV</span></div>
          <div><strong>{incidents.length}</strong><span>Incidents</span></div>
          <div><strong>{me.lat ? "Live" : "GPS"}</strong><span>Position</span></div>
        </div>
        <div className="tk-map-list">
          {items.map((a) => <AssignmentPill key={a.assignment_id} item={a} active={selected?.assignment_id === a.assignment_id} onClick={() => setSelected(a)} />)}
          {items.length === 0 && <EmptyState icon={MapPin} title="Aucun arrêt" text="La carte reste prête pour les interventions dispatchées." />}
        </div>
        <div className="tk-map-actions">
          <button className="tk-btn" onClick={() => selected ? queue(`ETA partagé avec ${selected.client_full_name || "client"}`) : queue("ETA partagé client")}>Partager ETA client</button>
          <button className="tk-btn tk-btn--ghost" onClick={() => queue("Dispatch demandé depuis carte")}>Dispatch</button>
        </div>
      </div>
    </div>
  );
}

export function CustomersPage() {
  const { items } = useMyDay();
  const [selectedId, setSelectedId] = useState(items[0]?.assignment_id ?? "");
  const selected = items.find((i) => i.assignment_id === selectedId) ?? items[0] ?? null;
  const [notes, setNotes] = useLocalList<QueueItem>("nivra-tech-client360-notes", []);
  const [note, setNote] = useState("");
  const addNote = () => {
    if (!note.trim()) return;
    const at = new Date().toLocaleString("fr-CA");
    setNotes([{ at, label: note.trim() }, ...notes]);
    queue(`Note Client 360 ajoutée: ${note.trim()}`);
    setNote("");
  };

  return (
    <div className="tk-product-page">
      <ShellHeader label="Client 360" title="Fiche client unifiée" subtitle="Une seule page scrollable : identité, services, factures, paiements, commandes, tickets, équipement, docs, appels, emails et chat." />
      <div className="tk-c360-layout">
        <aside className="tk-c360-search">
          <label className="tk-search"><Search /><input placeholder="Nom, téléphone, adresse, SN…" /></label>
          <div className="tk-c360-results">
            {items.map((item) => <AssignmentPill key={item.assignment_id} item={item} active={(selected?.assignment_id ?? selectedId) === item.assignment_id} onClick={() => setSelectedId(item.assignment_id)} />)}
            {items.length === 0 && <EmptyState icon={UserRound} title="Aucun client du jour" text="La recherche universelle reste disponible." />}
          </div>
        </aside>
        <main className="tk-c360-main">
          <section className="tk-client-hero">
            <div className="tk-avatar-xl"><UserRound /></div>
            <div>
              <h2>{selected?.client_full_name || "Client à sélectionner"}</h2>
              <p>{selected?.address_line || "Adresse non liée"}{selected?.city ? `, ${selected.city}` : ""}</p>
              <div className="tk-inline-actions">
                <button onClick={() => queue("Appel client démarré")}><Phone /> Appel</button>
                <button onClick={() => queue("SMS client préparé")}><Smartphone /> SMS</button>
                <button onClick={() => queue("Email client préparé")}><Mail /> Email</button>
                <button onClick={() => queue("Chat client ouvert")}><MessageSquare /> Chat</button>
              </div>
            </div>
          </section>
          <div className="tk-c360-grid">
            <InfoPanel icon={Wifi} title="Services" rows={[selected?.service_type || "Internet", selected?.intervention_status || "À traiter", selected?.scheduled_date || "Date non confirmée"]} />
            <InfoPanel icon={Wrench} title="Équipement" rows={["Borne Wi-Fi", "MAC / SN via scanner universel", "Photos avant/après liées au rapport"]} />
            <InfoPanel icon={FileText} title="Factures & paiements" rows={["Solde mensuel consolidé", "Paiements récents", "Ajustements Core visibles"]} />
            <InfoPanel icon={PackageCheck} title="Commandes" rows={[selected?.order_id ? `Commande ${selected.order_id.slice(0, 8)}` : "Commande terrain", "Rendez-vous installation", "Bon de livraison"]} />
            <InfoPanel icon={Headphones} title="Tickets" rows={["Support actif", "Escalade NOC possible", "Historique appels"]} />
            <InfoPanel icon={Signature} title="Documents" rows={["Photos", "Signatures", "Rapport PDF intervention"]} />
          </div>
          <section className="tk-timeline-panel">
            <div className="tk-panel-title">Timeline consolidée</div>
            {["Commande reçue", "Rendez-vous planifié", "Technicien assigné", "ETA partagé", "Intervention prête"].map((x, i) => <div className="tk-history-row" key={x}><span>{i + 1}</span><strong>{x}</strong><small>{selected?.time_start?.slice(0, 5) || "--:--"}</small></div>)}
            {notes.map((n, i) => <div className="tk-history-row" key={`${n.at}-${i}`}><span>+</span><strong>{n.label}</strong><small>{n.at}</small></div>)}
          </section>
          <section className="tk-note-composer">
            <textarea className="tk-input tk-textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ajouter une note interne visible dans le contexte terrain…" />
            <button className="tk-btn" onClick={addNote}>Ajouter la note</button>
          </section>
        </main>
      </div>
    </div>
  );
}

function InfoPanel({ icon: Icon, title, rows }: { icon: LucideIcon; title: string; rows: string[] }) {
  return <section className="tk-info-panel"><div><Icon /><strong>{title}</strong></div>{rows.map((r) => <span key={r}>{r}</span>)}</section>;
}

export function InterventionHubPage() {
  const nav = useNavigate();
  const { items, reload } = useMyDay();
  const [starting, setStarting] = useState<string | null>(null);
  const active = items.filter((i) => i.intervention_status === "active" || i.intervention_session_id);
  const proofRows: Array<[LucideIcon, string]> = [
    [Camera, "Photo façade obligatoire"],
    [QrCode, "Scan équipement MAC/SN"],
    [Wifi, "Nom réseau + mot de passe"],
    [Signature, "Signature client"],
    [FileText, "Rapport PDF"],
    [Mail, "Email automatique"],
  ];

  const start = async (a?: DayAssignment) => {
    if (!a) {
      queue("Intervention manuelle demandée — sélectionner un RDV ou dispatch requis");
      return;
    }
    setStarting(a?.assignment_id ?? "manual");
    try {
      const gps = await getGps();
      const { data, error } = await supabase.rpc("fn_start_intervention", {
        p_assignment_id: a.assignment_id,
        p_service_kind: a.service_type ?? "internet",
        p_gps_lat: gps?.latitude ?? null,
        p_gps_lng: gps?.longitude ?? null,
        p_gps_accuracy: gps?.accuracy ?? null,
      });
      if (error) throw error;
      await reload();
      nav(`/tech/intervention/${(data as { id: string }).id}`);
    } catch (e) {
      queue(e instanceof Error ? `Erreur démarrage intervention: ${e.message}` : "Erreur démarrage intervention");
    } finally { setStarting(null); }
  };

  return (
    <div className="tk-product-page">
      <ShellHeader label="Intervention" title="Workflow verrouillé de bout en bout" subtitle="Arrivée → GPS → façade → checklist → scan MAC/SN → tests → activation → Wi-Fi → validation → photos → signature → PDF/email → clôture." action={<button className="tk-btn" onClick={() => start()} disabled={!!starting}>Démarrer sans RDV</button>} />
      <div className="tk-intervention-board">
        <section className="tk-procedure-lane">
          {STEP_ORDER.map((step, idx) => <div key={step} className="tk-procedure-step"><span>{idx + 1}</span><strong>{STEP_META[step as Step].short}</strong><small>{idx === 0 ? "GPS + photo" : idx < 6 ? "Validation terrain" : idx < 10 ? "Activation client" : "Preuves finales"}</small></div>)}
        </section>
        <section className="tk-run-list">
          <div className="tk-panel-title">Interventions à exécuter</div>
          {items.map((a) => (
            <div className="tk-run-card" key={a.assignment_id}>
              <div><strong>{a.client_full_name || "Client"}</strong><span>{a.time_start?.slice(0, 5)} · {a.address_line || a.city}</span></div>
              <button className="tk-btn tk-btn--sm" onClick={() => a.intervention_session_id ? nav(`/tech/intervention/${a.intervention_session_id}`) : start(a)} disabled={starting === a.assignment_id}>{a.intervention_session_id ? "Reprendre" : "Démarrer"}</button>
            </div>
          ))}
          {items.length === 0 && <EmptyState icon={Wrench} title="Aucun RDV" text="Démarre une intervention manuelle ou attends le dispatch." />}
        </section>
        <section className="tk-proof-stack">
          <div className="tk-panel-title">Preuves générées</div>
          {proofRows.map(([Icon, label]) => <div className="tk-proof-row" key={label}><Icon />{label}</div>)}
          <div className="tk-alert tk-alert--info">{active.length} intervention(s) active(s) suivie(s) en temps réel.</div>
        </section>
      </div>
    </div>
  );
}

export function InventoryPage() {
  const { items } = useTruckStock();
  const [movements, setMovements] = useLocalList<Movement>("nivra-tech-inventory-moves", []);
  const [scan, setScan] = useState("");
  const movementActions: Array<[string, LucideIcon]> = [
    ["Transfert", Truck], ["Retour", RotateCcw], ["RMA", Shield],
    ["Casse", XCircle], ["Perte", AlertTriangle], ["Demande stock", Boxes],
  ];
  const addMovement = (type: string) => {
    const ref = scan.trim() || "SCAN-MANUEL";
    const next = [{ id: crypto.randomUUID(), type, ref, note: `${type} · ${ref}`, at: new Date().toLocaleString("fr-CA") }, ...movements];
    setMovements(next); setScan(""); queue(`Inventaire: ${type} ${ref}`);
  };
  const low = items.length < 3;

  return (
    <div className="tk-product-page">
      <ShellHeader label="Inventaire" title="Mon camion" subtitle="Scanner universel, mouvements, transferts, retours, RMA, casse, pertes, demandes de stock et seuils." />
      <div className="tk-inventory-grid">
        <section className="tk-scan-console">
          <QrCode /><h2>Scanner universel</h2><p>Code-barres, QR, MAC, numéro de série.</p>
          <input className="tk-input tk-input--mono" value={scan} onChange={(e) => setScan(e.target.value)} placeholder="SN / MAC / SKU" />
          <label className="tk-file-drop"><Upload /><span>Caméra / galerie</span><input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && setScan(e.target.files[0].name)} /></label>
          <div className="tk-action-grid">
            {movementActions.map(([label, Icon]) => <button key={label} onClick={() => addMovement(label)}><Icon />{label}</button>)}
          </div>
        </section>
        <section className="tk-stock-board">
          <div className="tk-panel-title">Stock camion temps réel</div>
          {low && <div className="tk-alert tk-alert--warn">Seuil bas — créer une demande de réapprovisionnement.</div>}
          {items.map((item) => <div className="tk-stock-row" key={item.id}><PackageCheck /><div><strong>{item.catalog_name}</strong><span>{item.category} · {item.serial_number || item.sku || "sans référence"}</span></div><small>{item.status}</small></div>)}
          {items.length === 0 && <EmptyState icon={Boxes} title="Camion vide" text="Les scans et demandes restent enregistrés en file offline." />}
        </section>
        <section className="tk-movement-log">
          <div className="tk-panel-title">Historique complet</div>
          {movements.map((m) => <div className="tk-history-row" key={m.id}><span>{m.type[0]}</span><strong>{m.ref}</strong><small>{m.at}</small></div>)}
          {movements.length === 0 && <EmptyState icon={Clock} title="Aucun mouvement" text="Scanne un item pour créer le premier mouvement." />}
        </section>
      </div>
    </div>
  );
}

export function CommsPage() {
  const [channel, setChannel] = useState("dispatch");
  const [body, setBody] = useState("");
  const [messages, setMessages] = useLocalList<ChatMessage>("nivra-tech-comms", [
    { id: "seed-1", channel: "dispatch", body: "Dispatch: confirme ton ETA dès que tu pars.", at: "08:10", mine: false },
    { id: "seed-2", channel: "noc", body: "NOC: surveillance incidents active sur les zones assignées.", at: "08:12", mine: false },
  ]);
  const send = () => {
    if (!body.trim()) return;
    setMessages([{ id: crypto.randomUUID(), channel, body: body.trim(), at: new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }), mine: true }, ...messages]);
    queue(`Message ${channel}: ${body.trim()}`); setBody("");
  };
  const visible = messages.filter((m) => m.channel === channel);
  const channels: Array<[string, LucideIcon]> = [["dispatch", Headphones], ["noc", Radio], ["client", MessageSquare], ["sms", Smartphone], ["emails", Mail]];
  return (
    <div className="tk-product-page tk-comms-page">
      <ShellHeader label="Communication" title="Centre de communication" subtitle="Chat dispatch, NOC, client, SMS, appels, emails, pièces jointes et escalade depuis un seul écran." />
      <div className="tk-comms-layout">
        <aside className="tk-channel-list">
          {channels.map(([id, Icon]) => <button className={cx(channel === id && "is-active")} onClick={() => setChannel(id)} key={id}><Icon />{id}</button>)}
          <button className="tk-escalate" onClick={() => queue("Escalade NOC ouverte")}>Escalade NOC</button>
        </aside>
        <main className="tk-chat-window">
          <div className="tk-chat-feed">
            {visible.map((m) => <div key={m.id} className={cx("tk-chat-bubble", m.mine && "mine")}><span>{m.at}</span>{m.body}</div>)}
          </div>
          <div className="tk-chat-compose">
            <button onClick={() => queue("Appel lancé depuis communication")}><Phone /></button>
            <button onClick={() => queue("Pièce jointe ajoutée") }><Upload /></button>
            <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Message ${channel}…`} />
            <button onClick={send}><Send /></button>
          </div>
        </main>
      </div>
    </div>
  );
}

export function ResourcesPage() {
  const docs: Array<[string, string, string, LucideIcon]> = [
    ["Installation borne Wi-Fi", "procédure", "Checklist câblage, test signal, placement optimal", Wifi],
    ["Terminal TV", "fiche technique", "Activation, synchronisation télécommande, validation chaînes", Radio],
    ["POD Wi-Fi", "vidéo", "Placement, mesh, retour en cas de panne", GraduationCap],
    ["Escalade NOC", "FAQ", "Quand escalader, quelles preuves joindre", Headphones],
    ["Rapport intervention", "procédure", "Photos, signature, PDF, email client", FileText],
  ] as const;
  const [q, setQ] = useState("");
  const filtered = docs.filter(([t, k, d]) => `${t} ${k} ${d}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="tk-product-page">
      <ShellHeader label="Ressources" title="Bibliothèque terrain offline" subtitle="Documentation, procédures, vidéos, formations, FAQ, fiches techniques et recherche locale." action={<button className="tk-btn tk-btn--ghost" onClick={() => queue("Ressources mises en cache offline")}>Mettre offline</button>} />
      <label className="tk-search tk-resource-search"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher procédure, équipement, panne…" /></label>
      <div className="tk-resource-grid">
        {filtered.map(([title, kind, desc, Icon]) => <article className="tk-resource-card" key={title}><Icon /><span>{kind}</span><h2>{title}</h2><p>{desc}</p><button onClick={() => queue(`Ressource ouverte: ${title}`)}>Ouvrir <ArrowRight /></button></article>)}
      </div>
    </div>
  );
}

export function PerformancePage() {
  const { items } = useMyDay();
  const done = items.filter((i) => i.intervention_status === "completed").length;
  const active = items.filter((i) => i.intervention_status === "active").length;
  const score = items.length ? Math.round((done / items.length) * 100) : 0;
  const analytics: Array<[LucideIcon, string, string]> = [
    [BarChart3, "Objectifs", `${Math.max(items.length, 1)} interventions planifiées`],
    [BadgeCheck, "Taux réussite", `${score}% aujourd'hui`],
    [Navigation, "Temps déplacement", "Calculé via ETA live"],
    [Clock, "Temps moyen", "Mesuré par session"],
    [Zap, "Revenus", "Liés aux interventions clôturées"],
    [GraduationCap, "Classement", "Équipe terrain"],
  ];
  return (
    <div className="tk-product-page">
      <ShellHeader label="Performance" title="Tableau de bord technicien" subtitle="Objectifs, commissions, revenus, NPS, temps moyen, déplacement, réussite et classement." />
      <div className="tk-performance-hero">
        <div><span>Progression jour</span><strong>{score}%</strong><small>{done}/{items.length} interventions terminées</small></div>
        <div><span>Interventions actives</span><strong>{active}</strong><small>À reprendre maintenant</small></div>
        <div><span>NPS estimé</span><strong>—</strong><small>Après signature client</small></div>
      </div>
      <div className="tk-analytics-grid">
        {analytics.map(([Icon, title, val]) => <section className="tk-info-panel" key={title}><div><Icon /><strong>{title}</strong></div><span>{val}</span></section>)}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [settingsState, saveSettings] = useLocalList<QueueItem>("nivra-tech-settings-log", []);
  const save = (label: string) => { saveSettings([{ at: new Date().toLocaleString("fr-CA"), label }, ...settingsState]); queue(`Paramètre modifié: ${label}`); };
  const settingsTiles: Array<[LucideIcon, string, string]> = [
    [UserRound, "Profil", "Nom, rôle, contact urgence"], [Car, "Véhicule", "Plaque, capacité, kilométrage"], [Bell, "Notifications", "Dispatch, NOC, client"],
    [Wifi, "Offline", "Cache local, file de sync"], [RefreshCw, "Synchronisation", "Forcer reprise de file"], [Shield, "Sécurité", "Biométrie, verrouillage"],
  ];
  return (
    <div className="tk-product-page">
      <ShellHeader label="Paramètres" title="Configuration terrain" subtitle="Profil, véhicule, équipement, notifications, offline, cache, synchronisation, sécurité et biométrie." />
      <div className="tk-settings-grid">
        {settingsTiles.map(([Icon, title, desc]) => <button className="tk-settings-tile" key={title} onClick={() => save(title)}><Icon /><strong>{title}</strong><span>{desc}</span></button>)}
      </div>
      <section className="tk-timeline-panel">
        <div className="tk-panel-title">Journal local</div>
        {settingsState.map((s, i) => <div className="tk-history-row" key={`${s.at}-${i}`}><span><CheckCircle2 size={14} /></span><strong>{s.label}</strong><small>{s.at}</small></div>)}
        {settingsState.length === 0 && <EmptyState icon={Settings} title="Aucun changement" text="Les modifications seront journalisées ici." />}
      </section>
    </div>
  );
}