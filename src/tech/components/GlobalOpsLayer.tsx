import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, Bot, Camera, Command, Headphones, MapPin, Navigation, Phone,
  RefreshCw, ScanLine, Search, ShieldAlert, Upload, Wifi, X, Zap,
} from "lucide-react";

type Overlay = "command" | "scanner" | "assistant" | "notifications" | "photo" | null;
const OVERLAYS = new Set(["command", "scanner", "assistant", "notifications", "photo"]);

const COMMANDS = [
  ["Mission Control", "/tech", "Centre de contrôle vivant"],
  ["Ma journée", "/tech/journee", "Timeline, ETA, optimisation"],
  ["Terrain", "/tech/terrain", "Carte live plein écran"],
  ["Client 360", "/tech/clients", "Fiche client unifiée"],
  ["Intervention", "/tech/intervention", "Workflow guidé verrouillé"],
  ["Inventaire", "/tech/inventaire", "Camion, scans, RMA"],
  ["Communication", "/tech/communication", "Dispatch, NOC, client"],
  ["Ressources", "/tech/ressources", "Procédures offline"],
  ["Performance", "/tech/performance", "Objectifs, NPS, revenus"],
  ["Paramètres", "/tech/parametres", "Profil, véhicule, sécurité"],
] as const;

function readQueue(): string[] {
  try { return JSON.parse(localStorage.getItem("nivra-tech-offline-queue") ?? "[]") as string[]; }
  catch { return []; }
}

function pushQueue(item: string) {
  const q = readQueue();
  q.unshift(`${new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })} · ${item}`);
  localStorage.setItem("nivra-tech-offline-queue", JSON.stringify(q.slice(0, 30)));
  window.dispatchEvent(new Event("nivra-tech-queue"));
}

export function GlobalOpsLayer() {
  const nav = useNavigate();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState<string[]>(readQueue());
  const [scan, setScan] = useState("");
  const [assistantText, setAssistantText] = useState("Préparer le prochain rendez-vous et vérifier les risques.");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOverlay("command");
      }
    };
    const onQueue = () => setQueue(readQueue());
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string" && OVERLAYS.has(detail)) setOverlay(detail as Overlay);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("nivra-tech-queue", onQueue);
    window.addEventListener("nivra-tech-open-ops", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("nivra-tech-queue", onQueue);
      window.removeEventListener("nivra-tech-open-ops", onOpen);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? COMMANDS.filter(([a, , b]) => `${a} ${b}`.toLowerCase().includes(q)) : COMMANDS;
  }, [query]);

  const go = (to: string) => {
    setOverlay(null);
    nav(to);
  };

  const clearQueue = () => {
    localStorage.setItem("nivra-tech-offline-queue", "[]");
    setQueue([]);
  };

  return (
    <>
      <div className="tk-global-strip" aria-label="Fonctions globales">
        <button onClick={() => setOverlay("command")}><Command /> <span>⌘K</span></button>
        <button onClick={() => setOverlay("scanner")}><ScanLine /> <span>Scan</span></button>
        <button onClick={() => setOverlay("assistant")}><Bot /> <span>IA</span></button>
        <button onClick={() => setOverlay("notifications")}><Bell /> <span>{queue.length}</span></button>
      </div>

      <div className="tk-quick-actions" aria-label="Actions rapides">
        <button className="tk-sos" onClick={() => pushQueue("SOS terrain envoyé au dispatch")}>SOS</button>
        <button onClick={() => pushQueue("Appel dispatch demandé")}><Headphones /></button>
        <button onClick={() => setOverlay("photo")}><Camera /></button>
        <button onClick={() => pushQueue("Synchronisation manuelle demandée")}><RefreshCw /></button>
      </div>

      {overlay && (
        <div className="tk-overlay" role="dialog" aria-modal="true">
          <button className="tk-overlay__scrim" onClick={() => setOverlay(null)} aria-label="Fermer" />
          <section className="tk-sheet">
            <header className="tk-sheet__head">
              <div>
                <div className="tk-sheet__kicker">Nivra Ops</div>
                <h2>{overlay === "command" ? "Command Palette" : overlay === "scanner" ? "Scanner universel" : overlay === "assistant" ? "Assistant IA terrain" : overlay === "photo" ? "Photo rapide" : "Notifications & synchronisation"}</h2>
              </div>
              <button className="tk-icon-btn" onClick={() => setOverlay(null)} aria-label="Fermer"><X /></button>
            </header>

            {overlay === "command" && (
              <div className="tk-command">
                <label className="tk-search"><Search /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un écran, une action, un client…" /></label>
                <div className="tk-command__list">
                  {filtered.map(([label, to, desc]) => (
                    <button key={to} onClick={() => go(to)}>
                      <span>{label}</span><small>{desc}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {overlay === "scanner" && (
              <div className="tk-form-grid">
                <div className="tk-scanner-stage"><ScanLine /><strong>QR · code-barres · MAC · numéro série</strong><span>Entrée caméra ou manuelle, utilisable depuis tous les modules.</span></div>
                <input className="tk-input" value={scan} onChange={(e) => setScan(e.target.value)} placeholder="SN / MAC / QR / code-barres" />
                <label className="tk-file-drop"><Upload /><span>Ouvrir la caméra / galerie</span><input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && setScan(e.target.files[0].name)} /></label>
                <button className="tk-btn" disabled={!scan.trim()} onClick={() => { pushQueue(`Scan capturé: ${scan.trim()}`); setScan(""); }}>Ajouter à la file terrain</button>
              </div>
            )}

            {overlay === "assistant" && (
              <div className="tk-form-grid">
                <textarea className="tk-input tk-textarea tk-ai-box" value={assistantText} onChange={(e) => setAssistantText(e.target.value)} />
                <div className="tk-ai-answer">
                  <Zap /> Priorité suggérée : vérifier le stock borne Wi-Fi, confirmer ETA client, puis ouvrir le workflow d'intervention verrouillé.
                </div>
                <button className="tk-btn" onClick={() => pushQueue("Résumé IA ajouté à la journée")}>Enregistrer la recommandation</button>
              </div>
            )}

            {overlay === "notifications" && (
              <div className="tk-notification-stack">
                <div className="tk-notice tk-notice--critical"><ShieldAlert /><div><strong>Canal critique actif</strong><span>SOS, NOC et dispatch restent visibles partout.</span></div></div>
                <div className="tk-notice"><Wifi /><div><strong>Connexion</strong><span>{navigator.onLine ? "En ligne · sync temps réel" : "Hors ligne · actions en file"}</span></div></div>
                <div className="tk-notice"><MapPin /><div><strong>GPS live</strong><span>Position poussée périodiquement pendant l'utilisation.</span></div></div>
                <div className="tk-notice"><Navigation /><div><strong>Offline Queue</strong><span>{queue.length} action(s) locale(s) en attente.</span></div></div>
                {queue.map((q, idx) => <div className="tk-queue-row" key={`${q}-${idx}`}>{q}</div>)}
                {queue.length > 0 && <button className="tk-btn tk-btn--ghost" onClick={clearQueue}>Vider la file locale</button>}
              </div>
            )}

            {overlay === "photo" && (
              <div className="tk-form-grid">
                <label className="tk-photo-capture"><Camera /><strong>Capturer une photo terrain</strong><span>Façade, équipement, problème ou preuve de clôture.</span><input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && pushQueue(`Photo rapide: ${e.target.files[0].name}`)} /></label>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}